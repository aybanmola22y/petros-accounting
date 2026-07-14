"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  BookUser,
  Download,
  FileText,
  MapPin,
  Paperclip,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPHP } from "@/views/financial-report-shared";
import {
  formatSupplierAddress,
  getExpenseCategoriesSnapshot,
  getSuppliersSnapshot,
  subscribeMockStore,
  type MockSupplier,
} from "@/lib/mock-data";

type SupplierProfileDialogProps = {
  supplierId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (supplier: MockSupplier) => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="grid gap-0.5 sm:grid-cols-[140px_1fr] sm:gap-4 py-2 border-b border-border/50 last:border-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof BookUser;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 border-b px-4 py-3 bg-muted/20">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="px-4 py-2">{children}</div>
    </section>
  );
}

export function SupplierProfileDialog({
  supplierId,
  open,
  onOpenChange,
  onEdit,
}: SupplierProfileDialogProps) {
  const suppliers = useSyncExternalStore(
    subscribeMockStore,
    getSuppliersSnapshot,
    getSuppliersSnapshot,
  );
  const expenseCategories = useSyncExternalStore(
    subscribeMockStore,
    getExpenseCategoriesSnapshot,
    getExpenseCategoriesSnapshot,
  );

  const supplier = useMemo(
    () => (supplierId ? suppliers.find((s) => s.id === supplierId) : undefined),
    [supplierId, suppliers],
  );

  const profile = supplier?.profile;
  const address = formatSupplierAddress(profile);
  const categoryLabel = profile?.defaultExpenseCategory
    ? expenseCategories.find((c) => c.name === profile.defaultExpenseCategory)?.displayName ??
      profile.defaultExpenseCategory
    : undefined;

  const contactName = [profile?.title, profile?.firstName, profile?.middleName, profile?.lastName, profile?.suffix]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!supplier) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Supplier profile</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">Supplier not found.</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl [&>button]:hidden">
        <DialogHeader className="shrink-0 space-y-0 border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">{supplier.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{supplier.companyName}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(supplier);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 px-4 py-3">
              <p className="text-xs text-muted-foreground">Open balance</p>
              <p className="text-lg font-semibold tabular-nums">{formatPHP(supplier.openBalance)}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-4 py-3">
              <p className="text-xs text-muted-foreground">Currency</p>
              <p className="text-lg font-semibold">{supplier.currency}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-4 py-3">
              <p className="text-xs text-muted-foreground">Payment terms</p>
              <p className="text-lg font-semibold">{profile?.paymentTerms || "—"}</p>
            </div>
          </div>

          <Section title="Name and contact" icon={BookUser}>
            <dl>
              <DetailRow label="Contact name" value={contactName || undefined} />
              <DetailRow label="Email" value={supplier.email} />
              <DetailRow label="Phone" value={supplier.phone} />
              <DetailRow label="Mobile" value={profile?.mobile} />
              <DetailRow label="Fax" value={profile?.fax} />
              <DetailRow label="Cc" value={profile?.cc} />
              <DetailRow label="Bcc" value={profile?.bcc} />
              <DetailRow label="Website" value={profile?.website} />
              <DetailRow label="Other" value={profile?.other} />
            </dl>
          </Section>

          {address && (
            <Section title="Address" icon={MapPin}>
              <pre className="whitespace-pre-wrap text-sm py-2 font-sans">{address}</pre>
            </Section>
          )}

          {(profile?.notes || (profile?.attachments?.length ?? 0) > 0) && (
            <Section title="Notes and attachments" icon={Pencil}>
              {profile?.notes && (
                <p className="text-sm whitespace-pre-wrap py-2">{profile.notes}</p>
              )}
              {profile?.attachments && profile.attachments.length > 0 && (
                <ul className="space-y-2 py-2">
                  {profile.attachments.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
                        <a href={file.dataUrl} download={file.name}>
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {(profile?.businessId ||
            profile?.billingRate ||
            profile?.accountNo ||
            categoryLabel ||
            profile?.openingBalanceAsOf) && (
            <Section title="Additional info" icon={FileText}>
              <dl>
                <DetailRow label="Business ID" value={profile?.businessId} />
                <DetailRow label="Billing rate" value={profile?.billingRate ? `${profile.billingRate} /hr` : undefined} />
                <DetailRow label="Account no." value={profile?.accountNo} />
                <DetailRow label="Default expense category" value={categoryLabel} />
                <DetailRow label="Opening balance as of" value={profile?.openingBalanceAsOf} />
              </dl>
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
