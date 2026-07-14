"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookUser,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  HelpCircle,
  MapPin,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  StickyNote,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

export type CustomerFormValues = {
  name: string;
  companyName: string;
  phone: string;
  currency: string;
  email?: string;
};

const CURRENCY_OPTIONS = [
  { value: "PHP", label: "PHP Philippine Peso" },
  { value: "USD", label: "USD US Dollar" },
] as const;

type SectionKey =
  | "nameContact"
  | "comm"
  | "addresses"
  | "notes"
  | "payments"
  | "additional"
  | "custom";

const HEADER_ACTIONS: { icon: LucideIcon; label: string; section: SectionKey }[] = [
  { icon: BookUser, label: "Contact", section: "nameContact" },
  { icon: MessageSquare, label: "Messages", section: "comm" },
  { icon: MapPin, label: "Address", section: "addresses" },
  { icon: StickyNote, label: "Notes", section: "notes" },
  { icon: CreditCard, label: "Payments", section: "payments" },
  { icon: Paperclip, label: "Attachments", section: "notes" },
  { icon: Settings, label: "Settings", section: "additional" },
];

const PAYMENT_METHODS = ["Cash", "Check", "Credit card", "Bank transfer", "GCash / Maya"];
const PAYMENT_TERMS = ["Due on receipt", "Net 15", "Net 30", "Net 60"];
const DELIVERY_OPTIONS = ["Email", "Print later", "None"];
const INVOICE_LANGUAGES = ["English", "Filipino"];

function todayInputValue() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
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
        id={`customer-section-${sectionId}`}
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

const emptyForm = () => ({
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
  isSubCustomer: false,
  emailMarketing: false,
  emailTransactional: true,
  billingStreet1: "",
  billingStreet2: "",
  billingCity: "",
  billingProvince: "",
  billingZip: "",
  billingCountry: "Philippines",
  showExtraAddressLines: false,
  shippingSameAsBilling: true,
  shippingStreet1: "",
  shippingStreet2: "",
  shippingCity: "",
  shippingProvince: "",
  shippingZip: "",
  shippingCountry: "Philippines",
  notes: "",
  primaryPaymentMethod: "",
  paymentTerms: "",
  deliveryOption: "",
  invoiceLanguage: "English",
  salesTaxRegistration: "",
  openingBalance: "",
  openingBalanceAsOf: todayInputValue(),
  customFields: [] as { label: string; value: string }[],
});

const defaultSections = (): Record<SectionKey, boolean> => ({
  nameContact: true,
  comm: false,
  addresses: false,
  notes: false,
  payments: false,
  additional: false,
  custom: false,
});

type CustomerFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: CustomerFormValues) => void | Promise<void>;
};

export function CustomerFormDialog({ open, onOpenChange, onSave }: CustomerFormDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [sections, setSections] = useState(defaultSections);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setSections(defaultSections());
    }
  }, [open]);

  const hasEmail = form.email.trim().length > 0;

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
    if (!open) return;
    const preferred = displayNameOptions.find((o) => o.length > 0);
    if (preferred && !form.displayName.trim()) {
      setForm((f) => ({ ...f, displayName: preferred }));
    }
  }, [displayNameOptions, form.displayName, open]);

  function update<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function jumpToSection(key: SectionKey) {
    setSections((prev) => ({ ...prev, [key]: true }));
    requestAnimationFrame(() => {
      document.getElementById(`customer-section-${key}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function formatBillingPreview() {
    const lines = [
      form.billingStreet1,
      form.billingStreet2,
      [form.billingCity, form.billingProvince].filter(Boolean).join(", "),
      [form.billingZip, form.billingCountry].filter(Boolean).join(" "),
    ].filter((l) => l.trim());
    return lines.length > 0 ? lines.join("\n") : "No billing address entered yet.";
  }

  async function handleSave() {
    const name = form.displayName.trim() || displayNameOptions.find((o) => o.trim())?.trim() || "";
    if (!name) {
      toast({
        title: "Display name required",
        description: "Enter or select a customer display name.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name,
        companyName: form.companyName.trim() || "None",
        phone: form.phone.trim() || form.mobile.trim(),
        currency: form.currency,
        email: form.email.trim() || undefined,
      });
      onOpenChange(false);
    } catch {
      // Parent shows the error toast; keep the dialog open for corrections.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl [&>button]:hidden">
        <DialogHeader className="relative shrink-0 flex-row items-center space-y-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold tracking-tight text-left pr-36">
            Customer
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
                <Field id="cust-title" label="Title" className="sm:col-span-1">
                  <Input id="cust-title" className="h-9" value={form.title} onChange={(e) => update("title", e.target.value)} />
                </Field>
                <Field id="cust-first" label="First name" className="sm:col-span-1">
                  <Input id="cust-first" className="h-9" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
                </Field>
                <Field id="cust-middle" label="Middle name" className="sm:col-span-1">
                  <Input id="cust-middle" className="h-9" value={form.middleName} onChange={(e) => update("middleName", e.target.value)} />
                </Field>
                <Field id="cust-last" label="Last name" className="sm:col-span-1">
                  <Input id="cust-last" className="h-9" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
                </Field>
                <Field id="cust-suffix" label="Suffix" className="sm:col-span-1">
                  <Input id="cust-suffix" className="h-9" value={form.suffix} onChange={(e) => update("suffix", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="cust-display" label="Customer display name" required>
                  <div className="relative">
                    <Input
                      id="cust-display"
                      className="h-10 pr-9"
                      list="customer-display-name-options"
                      placeholder="Select or enter display name"
                      value={form.displayName}
                      onChange={(e) => update("displayName", e.target.value)}
                    />
                    <datalist id="customer-display-name-options">
                      {displayNameOptions.filter((o) => o.length > 0).map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </Field>
                <Field id="cust-company" label="Company name">
                  <Input id="cust-company" className="h-10" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="cust-email" label="Email">
                  <Input id="cust-email" type="email" className="h-10" value={form.email} onChange={(e) => update("email", e.target.value)} />
                </Field>
                <Field id="cust-phone" label="Phone number">
                  <Input id="cust-phone" className="h-10" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="cust-cc" label="Cc">
                  <Input id="cust-cc" className="h-10" value={form.cc} onChange={(e) => update("cc", e.target.value)} />
                </Field>
                <Field id="cust-bcc" label="Bcc">
                  <Input id="cust-bcc" className="h-10" value={form.bcc} onChange={(e) => update("bcc", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="cust-mobile" label="Mobile number">
                  <Input id="cust-mobile" className="h-10" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} />
                </Field>
                <Field id="cust-fax" label="Fax">
                  <Input id="cust-fax" className="h-10" value={form.fax} onChange={(e) => update("fax", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="cust-other" label="Other">
                  <Input id="cust-other" className="h-10" value={form.other} onChange={(e) => update("other", e.target.value)} />
                </Field>
                <Field id="cust-website" label="Website">
                  <Input id="cust-website" className="h-10" value={form.website} onChange={(e) => update("website", e.target.value)} />
                </Field>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="cust-sub" checked={form.isSubCustomer} onCheckedChange={(v) => update("isSubCustomer", v === true)} />
                <Label htmlFor="cust-sub" className="text-sm font-normal cursor-pointer">
                  Is a sub-customer
                </Label>
              </div>
            </div>
          </FormSection>

          <FormSection
            sectionId="comm"
            title="Communication permissions"
            icon={MessageSquare}
            open={sections.comm}
            onOpenChange={(v) => setSections((s) => ({ ...s, comm: v }))}
          >
            {!hasEmail ? (
              <div className="py-10 px-2 text-center space-y-3">
                <ShieldCheck className="h-11 w-11 mx-auto text-muted-foreground/40" strokeWidth={1.25} />
                <p className="text-sm font-semibold">Enter an email to record customer consent.</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  If the customer has opted in to receive email marketing communications, acknowledge it here
                  once you&apos;ve added an email.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Record consent for <span className="font-medium text-foreground">{form.email}</span>
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="comm-tx"
                    checked={form.emailTransactional}
                    onCheckedChange={(v) => update("emailTransactional", v === true)}
                  />
                  <Label htmlFor="comm-tx" className="text-sm font-normal cursor-pointer leading-snug">
                    Send transactional emails (invoices, payment receipts, reminders)
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="comm-mkt"
                    checked={form.emailMarketing}
                    onCheckedChange={(v) => update("emailMarketing", v === true)}
                  />
                  <Label htmlFor="comm-mkt" className="text-sm font-normal cursor-pointer leading-snug">
                    Customer has opted in to marketing and promotional emails
                  </Label>
                </div>
              </div>
            )}
          </FormSection>

          <FormSection
            sectionId="addresses"
            title="Addresses"
            icon={MapPin}
            open={sections.addresses}
            onOpenChange={(v) => setSections((s) => ({ ...s, addresses: v }))}
          >
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold">Billing address</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="bill-street1" label="Street address 1">
                    <Input id="bill-street1" className="h-10" value={form.billingStreet1} onChange={(e) => update("billingStreet1", e.target.value)} />
                  </Field>
                  <Field id="bill-street2" label="Street address 2">
                    <Input id="bill-street2" className="h-10" value={form.billingStreet2} onChange={(e) => update("billingStreet2", e.target.value)} />
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
                    <Field id="bill-street3" label="Street address 3">
                      <Input id="bill-street3" className="h-10" />
                    </Field>
                    <Field id="bill-street4" label="Street address 4">
                      <Input id="bill-street4" className="h-10" />
                    </Field>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="bill-city" label="City">
                    <Input id="bill-city" className="h-10" value={form.billingCity} onChange={(e) => update("billingCity", e.target.value)} />
                  </Field>
                  <Field id="bill-province" label="Province">
                    <Input id="bill-province" className="h-10" value={form.billingProvince} onChange={(e) => update("billingProvince", e.target.value)} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="bill-zip" label="ZIP code">
                    <Input id="bill-zip" className="h-10" value={form.billingZip} onChange={(e) => update("billingZip", e.target.value)} />
                  </Field>
                  <Field id="bill-country" label="Country">
                    <Input id="bill-country" className="h-10" value={form.billingCountry} onChange={(e) => update("billingCountry", e.target.value)} />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() =>
                    toast({ title: "Billing address", description: formatBillingPreview() })
                  }
                >
                  Preview address
                </Button>
              </div>

              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-semibold">Shipping address</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ship-same"
                    checked={form.shippingSameAsBilling}
                    onCheckedChange={(v) => update("shippingSameAsBilling", v === true)}
                  />
                  <Label htmlFor="ship-same" className="text-sm font-normal cursor-pointer">
                    Same as billing address
                  </Label>
                </div>
                {!form.shippingSameAsBilling && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="ship-street1" label="Street address 1">
                      <Input id="ship-street1" className="h-10" value={form.shippingStreet1} onChange={(e) => update("shippingStreet1", e.target.value)} />
                    </Field>
                    <Field id="ship-street2" label="Street address 2">
                      <Input id="ship-street2" className="h-10" value={form.shippingStreet2} onChange={(e) => update("shippingStreet2", e.target.value)} />
                    </Field>
                    <Field id="ship-city" label="City">
                      <Input id="ship-city" className="h-10" value={form.shippingCity} onChange={(e) => update("shippingCity", e.target.value)} />
                    </Field>
                    <Field id="ship-province" label="Province">
                      <Input id="ship-province" className="h-10" value={form.shippingProvince} onChange={(e) => update("shippingProvince", e.target.value)} />
                    </Field>
                    <Field id="ship-zip" label="ZIP code">
                      <Input id="ship-zip" className="h-10" value={form.shippingZip} onChange={(e) => update("shippingZip", e.target.value)} />
                    </Field>
                    <Field id="ship-country" label="Country">
                      <Input id="ship-country" className="h-10" value={form.shippingCountry} onChange={(e) => update("shippingCountry", e.target.value)} />
                    </Field>
                  </div>
                )}
              </div>
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
              <Field id="cust-notes" label="Notes">
                <Textarea
                  id="cust-notes"
                  className="min-h-[100px] resize-y"
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </Field>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Attachments</Label>
                <button
                  type="button"
                  className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/35 bg-muted/20 px-4 py-6 text-center hover:bg-muted/40 transition-colors"
                  onClick={() =>
                    toast({
                      title: "Attachments",
                      description: "File upload will be available when document storage is connected.",
                    })
                  }
                >
                  <Paperclip className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-primary">Add attachment</span>
                  <span className="text-xs text-muted-foreground">Max file size: 20 MB</span>
                </button>
              </div>
            </div>
          </FormSection>

          <FormSection
            sectionId="payments"
            title="Payments"
            icon={CreditCard}
            open={sections.payments}
            onOpenChange={(v) => setSections((s) => ({ ...s, payments: v }))}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Primary payment method">
                <Select value={form.primaryPaymentMethod || undefined} onValueChange={(v) => update("primaryPaymentMethod", v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select a primary payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
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
              <Field label="Sales form delivery options">
                <Select value={form.deliveryOption || undefined} onValueChange={(v) => update("deliveryOption", v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select delivery option" />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Language to use when you send invoices">
                <Select value={form.invoiceLanguage} onValueChange={(v) => update("invoiceLanguage", v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_LANGUAGES.map((lang) => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
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
                <Field id="sales-tax-reg" label="Sales tax registration">
                  <Input
                    id="sales-tax-reg"
                    className="h-10"
                    value={form.salesTaxRegistration}
                    onChange={(e) => update("salesTaxRegistration", e.target.value)}
                  />
                </Field>
              </div>
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold">Opening balance</p>
                  <button type="button" className="text-muted-foreground" aria-label="About opening balance" title="Balance owed before your start date in Ledger.">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="opening-balance" label="Opening balance">
                    <Input
                      id="opening-balance"
                      className="h-10"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.openingBalance}
                      onChange={(e) => update("openingBalance", e.target.value)}
                    />
                  </Field>
                  <Field id="opening-as-of" label="As of">
                    <Input
                      id="opening-as-of"
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

          <FormSection
            sectionId="custom"
            title="Custom fields"
            icon={Settings}
            open={sections.custom}
            onOpenChange={(v) => setSections((s) => ({ ...s, custom: v }))}
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Add customer details. Sort, filter, and track. Create reports your business needs.
              </p>
              {form.customFields.map((field, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-2">
                  <Field label="Field label">
                    <Input
                      className="h-10"
                      value={field.label}
                      onChange={(e) => {
                        const next = [...form.customFields];
                        next[index] = { ...next[index], label: e.target.value };
                        update("customFields", next);
                      }}
                    />
                  </Field>
                  <Field label="Value">
                    <Input
                      className="h-10"
                      value={field.value}
                      onChange={(e) => {
                        const next = [...form.customFields];
                        next[index] = { ...next[index], value: e.target.value };
                        update("customFields", next);
                      }}
                    />
                  </Field>
                </div>
              ))}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 gap-1 text-primary"
                onClick={() =>
                  update("customFields", [...form.customFields, { label: "", value: "" }])
                }
              >
                <Plus className="h-4 w-4" />
                Add custom field
              </Button>
            </div>
          </FormSection>
        </div>

        <div className="shrink-0 border-t bg-muted/20 px-6 py-4 flex justify-end">
          <Button type="button" className="min-w-[100px]" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
