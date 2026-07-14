"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  BookUser,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  MapPin,
  Paperclip,
  Pencil,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  formatSupplierAddress,
  getExpenseCategoriesSnapshot,
  subscribeMockStore,
  type MockSupplier,
  type SupplierAttachment,
  type SupplierProfile,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export type SupplierFormValues = {
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  currency: string;
  openingBalance: number;
  profile: SupplierProfile;
};

const CURRENCY_OPTIONS = [
  { value: "PHP", label: "PHP Philippine Peso" },
  { value: "USD", label: "USD US Dollar" },
] as const;

const PAYMENT_TERMS = ["Due on receipt", "Net 15", "Net 30", "Net 60", "Net 90"];
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

type SectionKey = "nameContact" | "address" | "notes" | "additional";

type FormState = {
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  displayName: string;
  companyName: string;
  email: string;
  phone: string;
  cc: string;
  bcc: string;
  mobile: string;
  fax: string;
  other: string;
  website: string;
  currency: string;
  street1: string;
  street2: string;
  street3: string;
  street4: string;
  showExtraAddressLines: boolean;
  city: string;
  province: string;
  zip: string;
  country: string;
  notes: string;
  businessId: string;
  billingRate: string;
  paymentTerms: string;
  accountNo: string;
  defaultExpenseCategory: string;
  openingBalance: string;
  openingBalanceAsOf: string;
  attachments: SupplierAttachment[];
};

const HEADER_ACTIONS: { icon: LucideIcon; label: string; section: SectionKey }[] = [
  { icon: BookUser, label: "Contact", section: "nameContact" },
  { icon: MapPin, label: "Address", section: "address" },
  { icon: Pencil, label: "Notes", section: "notes" },
  { icon: FileText, label: "Additional info", section: "additional" },
];

function todayInputValue() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function emptyForm(): FormState {
  return {
    title: "",
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    displayName: "",
    companyName: "",
    email: "",
    phone: "",
    cc: "",
    bcc: "",
    mobile: "",
    fax: "",
    other: "",
    website: "",
    currency: "PHP",
    street1: "",
    street2: "",
    street3: "",
    street4: "",
    showExtraAddressLines: false,
    city: "",
    province: "",
    zip: "",
    country: "Philippines",
    notes: "",
    businessId: "",
    billingRate: "",
    paymentTerms: "",
    accountNo: "",
    defaultExpenseCategory: "",
    openingBalance: "",
    openingBalanceAsOf: todayInputValue(),
    attachments: [],
  };
}

function formFromSupplier(supplier: MockSupplier): FormState {
  const p = supplier.profile ?? {};
  const street3 = p.street3 ?? "";
  const street4 = p.street4 ?? "";
  return {
    ...emptyForm(),
    title: p.title ?? "",
    firstName: p.firstName ?? "",
    middleName: p.middleName ?? "",
    lastName: p.lastName ?? "",
    suffix: p.suffix ?? "",
    displayName: supplier.name,
    companyName: supplier.companyName,
    email: supplier.email,
    phone: supplier.phone,
    cc: p.cc ?? "",
    bcc: p.bcc ?? "",
    mobile: p.mobile ?? "",
    fax: p.fax ?? "",
    other: p.other ?? "",
    website: p.website ?? "",
    currency: supplier.currency,
    street1: p.street1 ?? "",
    street2: p.street2 ?? "",
    street3,
    street4,
    showExtraAddressLines: Boolean(street3.trim() || street4.trim()),
    city: p.city ?? "",
    province: p.province ?? "",
    zip: p.zip ?? "",
    country: p.country ?? "Philippines",
    notes: p.notes ?? "",
    businessId: p.businessId ?? "",
    billingRate: p.billingRate ?? "",
    paymentTerms: p.paymentTerms ?? "",
    accountNo: p.accountNo ?? "",
    defaultExpenseCategory: p.defaultExpenseCategory ?? "",
    openingBalance: supplier.openBalance > 0 ? String(supplier.openBalance) : "",
    openingBalanceAsOf: p.openingBalanceAsOf ?? todayInputValue(),
    attachments: p.attachments ? [...p.attachments] : [],
  };
}

function Field({
  id,
  label,
  required,
  className,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function FormSection({
  sectionId,
  title,
  icon: Icon,
  open,
  onOpenChange,
  children,
}: {
  sectionId: SectionKey;
  title: string;
  icon: LucideIcon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div
        id={`supplier-section-${sectionId}`}
        className="rounded-lg border bg-card shadow-sm scroll-mt-3"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-2.5">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{title}</span>
            </div>
            {open ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-4 pb-4 pt-3">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

const defaultSections = (): Record<SectionKey, boolean> => ({
  nameContact: true,
  address: false,
  notes: false,
  additional: false,
});

type SupplierFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: MockSupplier | null;
  onSave: (values: SupplierFormValues) => void | Promise<void>;
};

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSave,
}: SupplierFormDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(supplier);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sections, setSections] = useState(defaultSections);
  const [addressPreviewOpen, setAddressPreviewOpen] = useState(false);

  const expenseCategories = useSyncExternalStore(
    subscribeMockStore,
    getExpenseCategoriesSnapshot,
    getExpenseCategoriesSnapshot,
  );

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setSections(defaultSections());
      setAddressPreviewOpen(false);
      return;
    }
    setForm(supplier ? formFromSupplier(supplier) : emptyForm());
    setSections(defaultSections());
  }, [open, supplier]);

  const displayNameOptions = useMemo(() => {
    const options: string[] = [];
    const company = form.companyName.trim();
    const parts = [form.firstName, form.middleName, form.lastName].map((p) => p.trim()).filter(Boolean);
    const fullName = parts.join(" ");
    const lastFirst =
      form.lastName.trim() && form.firstName.trim()
        ? `${form.lastName.trim()}, ${form.firstName.trim()}`
        : "";

    if (company) options.push(company);
    if (fullName) options.push(fullName);
    if (lastFirst) options.push(lastFirst);
    if (form.displayName.trim() && !options.includes(form.displayName.trim())) {
      options.unshift(form.displayName.trim());
    }
    return options.length > 0 ? options : [""];
  }, [form.companyName, form.firstName, form.middleName, form.lastName, form.displayName]);

  useEffect(() => {
    if (!open || isEdit) return;
    const preferred = displayNameOptions.find((o) => o.length > 0);
    if (preferred && !form.displayName.trim()) {
      setForm((f) => ({ ...f, displayName: preferred }));
    }
  }, [displayNameOptions, form.displayName, open, isEdit]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function jumpToSection(key: SectionKey) {
    setSections((prev) => ({ ...prev, [key]: true }));
    requestAnimationFrame(() => {
      document.getElementById(`supplier-section-${key}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function buildAddressProfile(): Pick<
    SupplierProfile,
    "street1" | "street2" | "street3" | "street4" | "city" | "province" | "zip" | "country"
  > {
    return {
      street1: form.street1.trim() || undefined,
      street2: form.street2.trim() || undefined,
      street3: form.street3.trim() || undefined,
      street4: form.street4.trim() || undefined,
      city: form.city.trim() || undefined,
      province: form.province.trim() || undefined,
      zip: form.zip.trim() || undefined,
      country: form.country.trim() || undefined,
    };
  }

  function formatAddressPreview() {
    const text = formatSupplierAddress(buildAddressProfile());
    return text || "No address entered yet.";
  }

  function parseOpeningBalance(): number {
    const raw = form.openingBalance.replace(/,/g, "").trim();
    if (!raw) return 0;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function buildProfile(): SupplierProfile {
    return {
      title: form.title.trim() || undefined,
      firstName: form.firstName.trim() || undefined,
      middleName: form.middleName.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
      suffix: form.suffix.trim() || undefined,
      cc: form.cc.trim() || undefined,
      bcc: form.bcc.trim() || undefined,
      mobile: form.mobile.trim() || undefined,
      fax: form.fax.trim() || undefined,
      other: form.other.trim() || undefined,
      website: form.website.trim() || undefined,
      ...buildAddressProfile(),
      notes: form.notes.trim() || undefined,
      businessId: form.businessId.trim() || undefined,
      billingRate: form.billingRate.trim() || undefined,
      paymentTerms: form.paymentTerms.trim() || undefined,
      accountNo: form.accountNo.trim() || undefined,
      defaultExpenseCategory: form.defaultExpenseCategory.trim() || undefined,
      openingBalanceAsOf: form.openingBalanceAsOf.trim() || undefined,
      attachments: form.attachments.length > 0 ? form.attachments : undefined,
    };
  }

  function handleFileSelect(fileList: FileList | null) {
    if (!fileList?.length) return;
    Array.from(fileList).forEach((file) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the 20 MB limit.`,
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const attachment: SupplierAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          dataUrl: reader.result as string,
          addedAt: new Date().toISOString(),
        };
        setForm((prev) => ({ ...prev, attachments: [...prev.attachments, attachment] }));
        toast({ title: "Attachment added", description: file.name });
      };
      reader.onerror = () => {
        toast({
          title: "Upload failed",
          description: `Could not read ${file.name}.`,
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(id: string) {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.id !== id),
    }));
  }

  async function handleSave() {
    const name = form.displayName.trim() || displayNameOptions.find((o) => o.trim())?.trim() || "";
    if (!name) {
      toast({
        title: "Display name required",
        description: "Enter or select a supplier display name.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name,
        companyName: form.companyName.trim() || name,
        phone: form.phone.trim() || form.mobile.trim(),
        currency: form.currency,
        email: form.email.trim() || undefined,
        openingBalance: parseOpeningBalance(),
        profile: buildProfile(),
      });
      onOpenChange(false);
    } catch {
      // Parent shows the error toast; keep the dialog open for corrections.
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl [&>button]:hidden">
          <DialogHeader className="relative shrink-0 flex-row items-center space-y-0 border-b px-6 py-4">
            <DialogTitle className="text-xl font-semibold tracking-tight text-left pr-36">
              {isEdit ? "Edit supplier" : "Supplier"}
            </DialogTitle>
            <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              {HEADER_ACTIONS.map(({ icon: Icon, label, section }) => (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  aria-label={label}
                  title={label}
                  onClick={() => jumpToSection(section)}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              ))}
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground ml-1"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <Field label="Currency">
              <Select value={form.currency} onValueChange={(v) => update("currency", v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <FormSection
              sectionId="nameContact"
              title="Name and contact"
              icon={BookUser}
              open={sections.nameContact}
              onOpenChange={(v) => setSections((s) => ({ ...s, nameContact: v }))}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <Field id="sup-title" label="Title" className="sm:col-span-1">
                    <Input id="sup-title" className="h-9" value={form.title} onChange={(e) => update("title", e.target.value)} />
                  </Field>
                  <Field id="sup-first" label="First name" className="sm:col-span-1">
                    <Input id="sup-first" className="h-9" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
                  </Field>
                  <Field id="sup-middle" label="Middle name" className="sm:col-span-1">
                    <Input id="sup-middle" className="h-9" value={form.middleName} onChange={(e) => update("middleName", e.target.value)} />
                  </Field>
                  <Field id="sup-last" label="Last name" className="sm:col-span-1">
                    <Input id="sup-last" className="h-9" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
                  </Field>
                  <Field id="sup-suffix" label="Suffix" className="sm:col-span-1">
                    <Input id="sup-suffix" className="h-9" value={form.suffix} onChange={(e) => update("suffix", e.target.value)} />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="sup-display" label="Supplier display name" required>
                    <div className="relative">
                      <Input
                        id="sup-display"
                        className="h-10 pr-9"
                        list="supplier-display-name-options"
                        placeholder="Select or enter display name"
                        value={form.displayName}
                        onChange={(e) => update("displayName", e.target.value)}
                      />
                      <datalist id="supplier-display-name-options">
                        {displayNameOptions.filter((o) => o.length > 0).map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </Field>
                  <Field id="sup-company" label="Company name">
                    <Input id="sup-company" className="h-10" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="sup-email" label="Email">
                    <Input id="sup-email" type="email" className="h-10" value={form.email} onChange={(e) => update("email", e.target.value)} />
                  </Field>
                  <Field id="sup-phone" label="Phone number">
                    <Input id="sup-phone" className="h-10" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="sup-cc" label="Cc">
                    <Input id="sup-cc" className="h-10" value={form.cc} onChange={(e) => update("cc", e.target.value)} />
                  </Field>
                  <Field id="sup-bcc" label="Bcc">
                    <Input id="sup-bcc" className="h-10" value={form.bcc} onChange={(e) => update("bcc", e.target.value)} />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="sup-mobile" label="Mobile number">
                    <Input id="sup-mobile" className="h-10" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} />
                  </Field>
                  <Field id="sup-fax" label="Fax">
                    <Input id="sup-fax" className="h-10" value={form.fax} onChange={(e) => update("fax", e.target.value)} />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="sup-other" label="Other">
                    <Input id="sup-other" className="h-10" value={form.other} onChange={(e) => update("other", e.target.value)} />
                  </Field>
                  <Field id="sup-website" label="Website">
                    <Input id="sup-website" className="h-10" value={form.website} onChange={(e) => update("website", e.target.value)} />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection
              sectionId="address"
              title="Address"
              icon={MapPin}
              open={sections.address}
              onOpenChange={(v) => setSections((s) => ({ ...s, address: v }))}
            >
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="sup-street1" label="Street address 1">
                    <Input id="sup-street1" className="h-10" value={form.street1} onChange={(e) => update("street1", e.target.value)} />
                  </Field>
                  <Field id="sup-street2" label="Street address 2">
                    <Input id="sup-street2" className="h-10" value={form.street2} onChange={(e) => update("street2", e.target.value)} />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs gap-1"
                  onClick={() => update("showExtraAddressLines", !form.showExtraAddressLines)}
                >
                  Add lines
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", form.showExtraAddressLines && "rotate-180")} />
                </Button>
                {form.showExtraAddressLines && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="sup-street3" label="Street address 3">
                      <Input id="sup-street3" className="h-10" value={form.street3} onChange={(e) => update("street3", e.target.value)} />
                    </Field>
                    <Field id="sup-street4" label="Street address 4">
                      <Input id="sup-street4" className="h-10" value={form.street4} onChange={(e) => update("street4", e.target.value)} />
                    </Field>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="sup-city" label="City">
                    <Input id="sup-city" className="h-10" value={form.city} onChange={(e) => update("city", e.target.value)} />
                  </Field>
                  <Field id="sup-province" label="Province">
                    <Input id="sup-province" className="h-10" value={form.province} onChange={(e) => update("province", e.target.value)} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="sup-zip" label="ZIP code">
                    <Input id="sup-zip" className="h-10" value={form.zip} onChange={(e) => update("zip", e.target.value)} />
                  </Field>
                  <Field id="sup-country" label="Country">
                    <Input id="sup-country" className="h-10" value={form.country} onChange={(e) => update("country", e.target.value)} />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => setAddressPreviewOpen(true)}
                >
                  Preview address
                </Button>
              </div>
            </FormSection>

            <FormSection
              sectionId="notes"
              title="Notes and attachments"
              icon={Pencil}
              open={sections.notes}
              onOpenChange={(v) => setSections((s) => ({ ...s, notes: v }))}
            >
              <div className="space-y-4">
                <Field id="sup-notes" label="Notes">
                  <Textarea
                    id="sup-notes"
                    className="min-h-[100px] resize-y"
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                  />
                </Field>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Attachments</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                  <button
                    type="button"
                    className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/35 bg-muted/20 px-4 py-6 text-center hover:bg-muted/40 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-primary">Add attachment</span>
                    <span className="text-xs text-muted-foreground">Max file size: 20 MB</span>
                  </button>
                  {form.attachments.length > 0 && (
                    <ul className="space-y-2 pt-2">
                      {form.attachments.map((file) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <a
                              href={file.dataUrl}
                              download={file.name}
                              className="text-sm font-medium text-primary hover:underline truncate block"
                            >
                              {file.name}
                            </a>
                            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${file.name}`}
                            onClick={() => removeAttachment(file.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </FormSection>

            <FormSection
              sectionId="additional"
              title="Additional info"
              icon={FileText}
              open={sections.additional}
              onOpenChange={(v) => setSections((s) => ({ ...s, additional: v }))}
            >
              <div className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Sales tax</p>
                  <Field id="sup-business-id" label="Business ID No. / Social Insurance No.">
                    <Input
                      id="sup-business-id"
                      className="h-10"
                      value={form.businessId}
                      onChange={(e) => update("businessId", e.target.value)}
                    />
                  </Field>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-semibold">Expense rates</p>
                  <Field id="sup-billing-rate" label="Billing rate (/hr)">
                    <Input
                      id="sup-billing-rate"
                      className="h-10"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.billingRate}
                      onChange={(e) => update("billingRate", e.target.value)}
                    />
                  </Field>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-semibold">Payments</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Terms">
                      <Select value={form.paymentTerms || undefined} onValueChange={(v) => update("paymentTerms", v)}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select terms" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TERMS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id="sup-account-no" label="Account no.">
                      <Input
                        id="sup-account-no"
                        className="h-10"
                        value={form.accountNo}
                        onChange={(e) => update("accountNo", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-semibold">Accounting</p>
                  <Field label="Default expense category">
                    <Select
                      value={form.defaultExpenseCategory || undefined}
                      onValueChange={(v) => update("defaultExpenseCategory", v)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Choose account" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {expenseCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold">Opening balance</p>
                    <button
                      type="button"
                      className="text-muted-foreground"
                      aria-label="About opening balance"
                      title="Balance owed to this supplier before your start date."
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="sup-opening-balance" label="Opening balance">
                      <Input
                        id="sup-opening-balance"
                        className="h-10"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={form.openingBalance}
                        onChange={(e) => update("openingBalance", e.target.value)}
                      />
                    </Field>
                    <Field id="sup-opening-as-of" label="As of">
                      <Input
                        id="sup-opening-as-of"
                        className="h-10"
                        placeholder="MM/DD/YYYY"
                        value={form.openingBalanceAsOf}
                        onChange={(e) => update("openingBalanceAsOf", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </FormSection>
          </div>

          <div className="shrink-0 border-t bg-muted/20 px-6 py-4 flex items-center justify-between">
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() =>
                toast({
                  title: "Privacy",
                  description: "Supplier data is stored in this session until Supabase is connected.",
                })
              }
            >
              Privacy
            </button>
            <Button
              type="button"
              className="min-w-[100px] bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addressPreviewOpen} onOpenChange={setAddressPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Address preview</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans">
            {formatAddressPreview()}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
