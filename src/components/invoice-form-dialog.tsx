"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Eye,
  GripVertical,
  HelpCircle,
  MessageSquare,
  Paperclip,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { FormDatePicker } from "@/components/form-date-picker";
import { ProductClassSelect } from "@/components/product-class-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SplitActionButton } from "@/components/split-action-button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CustomerFormDialog, type CustomerFormValues } from "@/components/customer-form-dialog";
import { createCustomerViaApi } from "@/lib/customers/api";
import { InvoiceStatusTimeline as InvoiceStatusTimelinePanel } from "@/components/invoice-status-timeline";
import { SendInvoiceDialog, type SendInvoicePayload } from "@/components/send-invoice-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  getInvoiceById,
  getReceivablesSnapshot,
  recordInvoiceViewed,
  subscribeMockStore,
} from "@/lib/mock-data";
import {
  frequencyLabelToInterval,
  nextRecurringDates,
} from "@/lib/mock-data/recurring-transactions";
import { createRecurringTemplateViaApi } from "@/lib/recurring-templates/api";
import { invoiceStatusHeadline, resolveInvoiceStatusTimeline } from "@/lib/invoice-status";
import type { InvoiceAttachment } from "@/lib/mock-data/types";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

export type InvoiceLineItem = {
  id: string;
  serviceDate: string;
  productService: string;
  sku: string;
  description: string;
  qty: number;
  rate: number;
  className: string;
};

export type InvoiceFormValues = {
  customerId: string;
  number: string;
  terms: string;
  invoiceDate: string;
  dueDate: string;
  tags: string;
  location: string;
  taxSetting: string;
  lines: InvoiceLineItem[];
  noteToCustomer: string;
  memoOnStatement: string;
  discountEnabled: boolean;
  discountPercent: number;
  depositEnabled: boolean;
  depositAmount: number;
  shippingEnabled: boolean;
  shippingAmount: number;
  attachments: InvoiceAttachment[];
};

type CustomerOption = { id: string; name: string; email?: string; currency?: string };

const ADD_CUSTOMER_VALUE = "__add_customer__";

const RECURRING_FREQUENCIES = ["Weekly", "Monthly", "Quarterly", "Yearly"] as const;

const TERMS = ["Due on receipt", "Net 15", "Net 30", "Net 60"];
const LOCATIONS = [
  "Head Office - Puerto Princesa City",
  "Manila Branch",
  "Cebu Branch",
];
const TAX_SETTINGS = ["Out of Scope of Tax", "Tax exclusive", "Tax inclusive"];
const PRODUCT_SUGGESTIONS = [
  "Consulting services",
  "Freight delivery",
  "Office supplies",
  "Monthly retainer",
  "Installation labor",
];

/** Match table header padding (px-2) so column labels align with field text. */
const LINE_TABLE_CELL = "px-2 py-1.5 align-middle";
const LINE_TABLE_FIELD = "h-9 w-full border-0 bg-transparent px-2 text-sm shadow-none";
const LINE_TABLE_DATE_FIELD =
  "h-9 min-w-[7.25rem] border-0 bg-transparent px-2 text-sm shadow-none tabular-nums leading-normal";
const LINE_TABLE_CENTER_HEADER = "px-2 py-2 text-center align-middle font-medium";
const LINE_TABLE_CENTER_CELL = "px-2 py-1.5 text-center align-middle";
const LINE_TABLE_CENTER_FIELD =
  "h-9 min-w-[5rem] border-0 bg-transparent px-2 text-center shadow-none tabular-nums text-sm";
const LINE_TABLE_SELECT = cn(
  LINE_TABLE_FIELD,
  "text-left [&>span]:truncate [&>span]:text-left",
);

function todayShort() {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

function newLine(id?: string): InvoiceLineItem {
  return {
    id: id ?? `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    serviceDate: todayShort(),
    productService: "",
    sku: "",
    description: "",
    qty: 1,
    rate: 0,
    className: "",
  };
}

function Field({
  label,
  className,
  children,
  hint,
}: {
  label: string;
  className?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SidebarSection({
  title,
  open,
  onOpenChange,
  children,
  badge,
  muted,
}: {
  title: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
  badge?: string;
  /** QBO-style subtle fill on status header cards. */
  muted?: boolean;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div
        className={cn(
          "rounded-md border bg-card shadow-sm overflow-hidden",
          muted && !open && "bg-muted/35",
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold transition-colors",
              open ? "bg-card" : muted ? "bg-muted/35 hover:bg-muted/45" : "hover:bg-muted/30",
            )}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="truncate">{title}</span>
              {badge ? (
                <Badge className="text-[10px] px-1.5 py-0 h-[18px] font-semibold bg-sky-100 text-sky-700 hover:bg-sky-100 border-0 rounded-sm">
                  {badge}
                </Badge>
              ) : null}
            </span>
            {open ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {open ? (
            <div className="border-t px-4 pb-4 pt-3 space-y-3">{children}</div>
          ) : null}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

const qboSwitchClass =
  "data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-muted-foreground/25 h-[22px] w-[38px] [&>span]:h-[18px] [&>span]:w-[18px] [&>span]:data-[state=checked]:translate-x-4";

type InvoiceFormDialogMode = "create" | "view" | "edit";

type InvoiceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  customers: CustomerOption[];
  onSave: (values: InvoiceFormValues) => boolean | void | Promise<boolean | void>;
  /** Called after save when user chooses Save and new; return the next invoice number. */
  onSaveAndNew?: () => string;
  mode?: InvoiceFormDialogMode;
  prefill?: InvoiceFormValues | null;
  /** Invoice being edited — drives live status timeline in the sidebar. */
  editingInvoiceId?: string | null;
  /** Header Receive payment action (edit mode). */
  onReceivePayment?: () => void;
};

function defaultFormState(invoiceNumber: string): InvoiceFormValues {
  return {
    customerId: "",
    number: invoiceNumber,
    terms: "Due on receipt",
    invoiceDate: todayShort(),
    dueDate: todayShort(),
    tags: "",
    location: LOCATIONS[0],
    taxSetting: TAX_SETTINGS[0],
    lines: [newLine("line-1")],
    noteToCustomer: "Thank you for making business with us!",
    memoOnStatement: "",
    discountEnabled: true,
    discountPercent: 0,
    depositEnabled: true,
    depositAmount: 0,
    shippingEnabled: false,
    shippingAmount: 0,
    attachments: [],
  };
}

export function InvoiceFormDialog({
  open,
  onOpenChange,
  invoiceNumber,
  customers,
  onSave,
  onSaveAndNew,
  mode = "create",
  prefill = null,
  editingInvoiceId = null,
  onReceivePayment,
}: InvoiceFormDialogProps) {
  const readOnly = mode === "view";
  const prefillAppliedRef = useRef(false);
  const { toast } = useToast();
  const router = useRouter();
  const paymentSectionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [schedulingOpen, setSchedulingOpen] = useState(false);
  const [editingTotals, setEditingTotals] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<(typeof RECURRING_FREQUENCIES)[number]>("Monthly");
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>(
    () => prefill?.attachments?.map((a) => ({ ...a })) ?? [],
  );
  const [previewAttachment, setPreviewAttachment] = useState<InvoiceAttachment | null>(null);
  const [customerSelectOpen, setCustomerSelectOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [ccBccOpen, setCcBccOpen] = useState(false);
  const [ccEmails, setCcEmails] = useState("");
  const [bccEmails, setBccEmails] = useState("");
  const receivables = useSyncExternalStore(subscribeMockStore, getReceivablesSnapshot, getReceivablesSnapshot);
  const editingInvoice = useMemo(() => {
    if (!editingInvoiceId) return null;
    return receivables.invoices.find((inv) => inv.id === editingInvoiceId) ?? getInvoiceById(editingInvoiceId) ?? null;
  }, [editingInvoiceId, receivables.invoices]);
  const statusHeadline = useMemo(() => {
    if (!editingInvoice) return null;
    const timeline = resolveInvoiceStatusTimeline(editingInvoice);
    return invoiceStatusHeadline(timeline, editingInvoice);
  }, [editingInvoice]);
  const [form, setForm] = useState(() =>
    prefill
      ? {
          ...prefill,
          number: prefill.number || invoiceNumber,
          attachments: prefill.attachments ?? [],
        }
      : {
          customerId: "",
          number: invoiceNumber,
          terms: "Due on receipt",
          invoiceDate: todayShort(),
          dueDate: todayShort(),
          tags: "",
          location: LOCATIONS[0],
          taxSetting: TAX_SETTINGS[0],
          lines: [newLine("line-1")],
          noteToCustomer: "Thank you for making business with us!",
          memoOnStatement: "",
          discountEnabled: true,
          discountPercent: 0,
          depositEnabled: true,
          depositAmount: 0,
          shippingEnabled: false,
          shippingAmount: 0,
          attachments: [],
        },
  );

  const customerList: CustomerOption[] = useMemo(() => {
    const fromStore = receivables.customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      currency: c.currency,
    }));
    const byId = new Map(fromStore.map((c) => [c.id, c]));
    for (const c of customers) {
      if (!byId.has(c.id)) byId.set(c.id, c);
    }
    // Imported invoices may only have a display name (import:Name) — keep it selectable.
    const selectedId = form.customerId || prefill?.customerId || "";
    if (selectedId.startsWith("import:") && !byId.has(selectedId)) {
      byId.set(selectedId, {
        id: selectedId,
        name: selectedId.slice("import:".length),
        currency: "PHP",
      });
    }
    return Array.from(byId.values());
  }, [receivables.customers, customers, form.customerId, prefill?.customerId]);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && prefill) {
        if (!prefillAppliedRef.current) {
          setForm({
            ...prefill,
            number: prefill.number || invoiceNumber,
            attachments: prefill.attachments ?? [],
          });
          setAttachments(prefill.attachments?.map((a) => ({ ...a })) ?? []);
          prefillAppliedRef.current = true;
        }
      } else if (mode === "create") {
        // Duplicate (and any other create-with-prefill) must apply copied fields.
        if (prefill) {
          if (!prefillAppliedRef.current) {
            setForm({
              ...prefill,
              number: prefill.number || invoiceNumber,
              attachments: prefill.attachments ?? [],
            });
            setAttachments(prefill.attachments?.map((a) => ({ ...a })) ?? []);
            prefillAppliedRef.current = true;
          }
        } else {
          setForm(defaultFormState(invoiceNumber));
          setAttachments([]);
          prefillAppliedRef.current = false;
        }
      } else if (mode === "view" && prefill) {
        setForm({
          ...prefill,
          number: prefill.number || invoiceNumber,
          attachments: prefill.attachments ?? [],
        });
        setAttachments(prefill.attachments?.map((a) => ({ ...a })) ?? []);
        prefillAppliedRef.current = true;
      }
    } else {
      prefillAppliedRef.current = false;
      setForm(defaultFormState(invoiceNumber));
      setPaymentOpen(mode === "edit");
      setEditingTotals(false);
      setReviewOpen(false);
      setRecurringOpen(false);
      setAttachments([]);
      setPreviewAttachment(null);
      setCustomerEmail("");
      setCcBccOpen(false);
      setCcEmails("");
      setBccEmails("");
    }
  }, [open, invoiceNumber, mode, prefill]);

  const selectedCustomer = useMemo(
    () => customerList.find((c) => c.id === form.customerId) ?? customers.find((c) => c.id === form.customerId),
    [customerList, customers, form.customerId],
  );

  useEffect(() => {
    if (!open || !form.customerId) return;
    const known =
      customerList.some((c) => c.id === form.customerId) ||
      customers.some((c) => c.id === form.customerId);
    if (known) return;

    if (form.customerId.startsWith("import:")) {
      // Keep synthetic import ids — customerList adds a provisional option for display.
      return;
    }

    // Orphan UUID / seed id: recover a displayable import: name from prefill when possible.
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        form.customerId,
      )
    ) {
      const fallbackName =
        (prefill?.customerId?.startsWith("import:")
          ? prefill.customerId.slice("import:".length)
          : "") ||
        selectedCustomer?.name ||
        "";
      if (fallbackName.trim()) {
        setForm((f) => ({ ...f, customerId: `import:${fallbackName.trim()}` }));
        return;
      }
    }

    // Seed-style or other non-list ids cannot be shown or saved to the uuid FK.
    setForm((f) => ({ ...f, customerId: "" }));
  }, [open, form.customerId, customerList, customers, prefill?.customerId, selectedCustomer?.name]);

  useEffect(() => {
    if (!form.customerId) {
      setCustomerEmail("");
      setCcBccOpen(false);
      setCcEmails("");
      setBccEmails("");
      return;
    }
    setCustomerEmail(selectedCustomer?.email?.trim() ?? "");
  }, [form.customerId, selectedCustomer?.email]);

  const subtotal = useMemo(
    () => form.lines.reduce((sum, line) => sum + line.qty * line.rate, 0),
    [form.lines],
  );

  const discountAmount = form.discountEnabled ? (subtotal * form.discountPercent) / 100 : 0;
  const shippingAmount = form.shippingEnabled ? form.shippingAmount : 0;
  const invoiceTotal = Math.max(0, subtotal - discountAmount + shippingAmount);
  const balanceDue = Math.max(0, invoiceTotal - (form.depositEnabled ? form.depositAmount : 0));

  const sendInvoicePayload = useMemo((): SendInvoicePayload | null => {
    if (!form.customerId && !form.number) return null;
    return {
      invoiceId: editingInvoiceId,
      number: form.number,
      customerName: selectedCustomer?.name ?? "Customer",
      customerEmail: customerEmail.trim() || selectedCustomer?.email,
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate,
      terms: form.terms,
      noteToCustomer: form.noteToCustomer,
      lines: form.lines.map((l) => ({
        productService: l.productService,
        qty: l.qty,
        rate: l.rate,
      })),
      discountEnabled: form.discountEnabled,
      discountPercent: form.discountPercent,
      shippingEnabled: form.shippingEnabled,
      shippingAmount: form.shippingAmount,
      depositEnabled: form.depositEnabled,
      depositAmount: form.depositAmount,
    };
  }, [
    editingInvoiceId,
    form,
    selectedCustomer,
    customerEmail,
  ]);

  function updateLine(id: string, patch: Partial<InvoiceLineItem>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }

  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, newLine()] }));
  }

  function clearLines() {
    setForm((prev) => ({ ...prev, lines: [newLine()] }));
  }

  function removeLine(id: string) {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return { ...prev, lines: prev.lines.filter((l) => l.id !== id) };
    });
  }

  function buildValues(): InvoiceFormValues {
    return {
      customerId: form.customerId,
      number: form.number,
      terms: form.terms,
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate,
      tags: form.tags,
      location: form.location,
      taxSetting: form.taxSetting,
      lines: form.lines,
      noteToCustomer: form.noteToCustomer,
      memoOnStatement: form.memoOnStatement,
      discountEnabled: form.discountEnabled,
      discountPercent: form.discountPercent,
      depositEnabled: form.depositEnabled,
      depositAmount: form.depositAmount,
      shippingEnabled: form.shippingEnabled,
      shippingAmount: form.shippingAmount,
      attachments,
    };
  }

  function validateForm(): boolean {
    if (!form.customerId) {
      toast({
        title: "Customer required",
        description: "Select a customer from the list before saving.",
        variant: "destructive",
      });
      return false;
    }
    if (
      !customerList.some((c) => c.id === form.customerId) &&
      !customers.some((c) => c.id === form.customerId)
    ) {
      toast({
        title: "Customer required",
        description: "Select a valid customer before saving.",
        variant: "destructive",
      });
      return false;
    }
    const hasAmount = form.lines.some((l) => l.qty * l.rate > 0);
    if (!hasAmount) {
      toast({
        title: "Add line items",
        description: "Enter at least one product or service with an amount.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  }

  async function persistInvoice(): Promise<boolean> {
    setSaving(true);
    try {
      const result = await onSave(buildValues());
      return result !== false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(closeAfter = true) {
    if (!validateForm()) return;
    const saved = await persistInvoice();
    if (!saved) return;
    if (closeAfter) onOpenChange(false);
    else toast({ title: "Invoice saved", description: `Invoice ${form.number} saved.` });
  }

  async function handleSaveAndNew() {
    if (!validateForm()) return;
    const saved = await persistInvoice();
    if (!saved) return;
    const nextNumber = onSaveAndNew?.() ?? invoiceNumber;
    setForm(defaultFormState(nextNumber));
    setAttachments([]);
    toast({ title: "Invoice saved", description: `Starting invoice ${nextNumber}.` });
  }

  function scrollToPaymentOptions() {
    setPaymentOpen(true);
    requestAnimationFrame(() => {
      paymentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function maybeRecordCustomerView() {
    if (!editingInvoiceId) return;
    const invoice = getInvoiceById(editingInvoiceId);
    if (!invoice) return;
    const timeline = resolveInvoiceStatusTimeline(invoice);
    if (timeline.sentAt) {
      void recordInvoiceViewed(editingInvoiceId);
    }
  }

  function openPrintPreview(downloadAsPdf = false) {
    if (!readOnly && !validateForm()) return;
    maybeRecordCustomerView();
    const customerName = selectedCustomer?.name ?? "Customer";
    const linesHtml = form.lines
      .filter((l) => l.productService || l.qty * l.rate > 0)
      .map(
        (l) =>
          `<tr><td>${l.productService || "—"}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${formatPHP(l.rate)}</td><td style="text-align:right">${formatPHP(l.qty * l.rate)}</td></tr>`,
      )
      .join("");
    const win = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
    if (!win) {
      toast({
        title: "Pop-up blocked",
        description: "Allow pop-ups to print or download this invoice.",
        variant: "destructive",
      });
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Invoice ${form.number}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}th{font-size:12px;color:#555}.totals{margin-top:16px;max-width:280px;margin-left:auto}.totals div{display:flex;justify-content:space-between;padding:4px 0}.bold{font-weight:600;border-top:1px solid #111;padding-top:8px}</style></head><body>
      <h1>Invoice ${form.number}</h1>
      <p><strong>Customer:</strong> ${customerName}</p>
      <p><strong>Date:</strong> ${form.invoiceDate} &nbsp; <strong>Due:</strong> ${form.dueDate}</p>
      <p><strong>Terms:</strong> ${form.terms}</p>
      <table><thead><tr><th>Product/service</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${linesHtml}</tbody></table>
      <div class="totals">
        <div><span>Subtotal</span><span>${formatPHP(subtotal)}</span></div>
        ${form.discountEnabled ? `<div><span>Discount (${form.discountPercent}%)</span><span>${formatPHP(discountAmount)}</span></div>` : ""}
        ${form.shippingEnabled ? `<div><span>Shipping</span><span>${formatPHP(shippingAmount)}</span></div>` : ""}
        <div class="bold"><span>Total</span><span>${formatPHP(invoiceTotal)}</span></div>
        <div><span>Balance due</span><span>${formatPHP(balanceDue)}</span></div>
      </div>
      ${form.noteToCustomer ? `<p style="margin-top:24px"><strong>Note:</strong> ${form.noteToCustomer}</p>` : ""}
      </body></html>`);
    win.document.close();
    win.focus();
    if (downloadAsPdf) {
      toast({
        title: "Save as PDF",
        description: "In the print dialog, choose Save as PDF as the destination.",
      });
    }
    win.print();
  }

  function handleMakeRecurring() {
    if (!validateForm()) return;
    setRecurringOpen(true);
  }

  function confirmRecurring() {
    if (!validateForm()) return;
    void persistInvoice().then(async (saved) => {
      if (!saved) return;
      const interval = frequencyLabelToInterval(recurringFrequency);
      const dates = nextRecurringDates(interval);
      const customerName = selectedCustomer?.name ?? "Customer";
      try {
        await createRecurringTemplateViaApi({
          templateName: `Invoice ${form.number} — ${customerName}`,
          scheduleType: "Scheduled",
          txnType: "Invoice",
          interval,
          previousDate: dates.previousDate,
          nextDate: form.dueDate || dates.nextDate,
          customerSupplier: customerName,
          amount: invoiceTotal,
          location: form.location || undefined,
        });
      } catch (error) {
        toast({
          title: "Could not save recurring template",
          description: error instanceof Error ? error.message : "Save failed.",
          variant: "destructive",
        });
        return;
      }
      setRecurringOpen(false);
      toast({
        title: "Recurring invoice scheduled",
        description: `Invoice ${form.number} will repeat ${recurringFrequency.toLowerCase()}.`,
      });
      router.push("/accounting/recurring-transactions");
    });
  }

  function openReviewSend() {
    if (!validateForm()) return;
    setReviewOpen(true);
  }

  async function handleCreateCustomer(values: CustomerFormValues) {
    try {
      const customer = await createCustomerViaApi(values);
      setForm((f) => ({ ...f, customerId: customer.id }));
      setCustomerEmail(values.email?.trim() ?? "");
      setNewCustomerOpen(false);
      toast({ title: "Customer added", description: `${values.name} is ready for this invoice.` });
    } catch (error) {
      toast({
        title: "Could not save customer",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  function handleAttachments(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    const oversized = list.filter((f) => f.size > 20 * 1024 * 1024);
    if (oversized.length > 0) {
      toast({
        title: "File too large",
        description: "Each attachment must be 20 MB or less.",
        variant: "destructive",
      });
      return;
    }

    list.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const attachment: InvoiceAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          dataUrl: reader.result as string,
          addedAt: new Date().toISOString(),
        };
        setAttachments((prev) => [...prev, attachment]);
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

    toast({
      title: "Attachments added",
      description: `${list.length} file${list.length === 1 ? "" : "s"} attached.`,
    });
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setPreviewAttachment((current) => (current?.id === id ? null : current));
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[98vh] flex-col gap-0 overflow-hidden p-0",
          "h-[min(920px,98vh)] w-[min(1600px,calc(100vw-2rem))] max-w-[min(1600px,calc(100vw-2rem))]",
          "[&>button]:hidden",
        )}
      >
        <DialogHeader className="relative shrink-0 flex-row items-center space-y-0 border-b pl-5 pr-3 py-2 min-h-[48px]">
          <div className="flex items-center gap-6 min-w-0 pr-44 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight truncate">
              {readOnly
                ? `View invoice ${form.number}`
                : mode === "edit"
                  ? `Invoice ${form.number}`
                  : "Create invoice"}
            </DialogTitle>
            {!readOnly && (
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium text-primary border-b-2 border-primary pb-2 mb-[-9px]">
                  Edit
                </span>
              </div>
            )}
          </div>
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0">
            {mode === "edit" && onReceivePayment && !readOnly ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-8 mr-1"
                onClick={onReceivePayment}
              >
                <CircleDollarSign className="h-4 w-4 mr-1.5" />
                Receive payment
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8"
              onClick={scrollToPaymentOptions}
            >
              <Settings2 className="h-4 w-4 mr-1.5" />
              Manage
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label="Help"
              onClick={() =>
                toast({
                  title: "Invoice help",
                  description: "Use Save and close to add the invoice to your books. Review and send emails a copy to your customer.",
                })
              }
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label="Feedback"
              onClick={() => {
                const msg = window.prompt("Send feedback about this invoice screen:");
                if (msg?.trim()) {
                  toast({ title: "Thanks for your feedback", description: "Your note was recorded." });
                }
              }}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 -mr-1" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          <fieldset
            disabled={readOnly}
            className="contents min-w-0 border-0 p-0 m-0"
          >
          <div className="flex-1 min-w-0 overflow-y-auto px-5 pt-4 pb-10 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Invoice</p>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Balance due</p>
                <p className="text-lg font-semibold tabular-nums">{formatPHP(balanceDue)}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Customer</Label>
              <Select
                open={customerSelectOpen}
                onOpenChange={setCustomerSelectOpen}
                value={form.customerId || undefined}
                onValueChange={(v) => {
                  if (v === ADD_CUSTOMER_VALUE) {
                    setCustomerSelectOpen(false);
                    setNewCustomerOpen(true);
                    return;
                  }
                  setForm((f) => ({ ...f, customerId: v }));
                }}
              >
                <SelectTrigger className="h-10 w-full text-primary data-placeholder:text-primary">
                  <SelectValue placeholder="Add customer">
                    {selectedCustomer ? (
                      <span className="flex w-full min-w-0 items-center justify-between gap-3">
                        <span className="truncate">
                          {selectedCustomer.name} - {selectedCustomer.currency ?? "PHP"}
                        </span>
                        <span className="shrink-0 text-xs italic text-muted-foreground">Customer</span>
                      </span>
                    ) : form.customerId.startsWith("import:") ? (
                      <span className="flex w-full min-w-0 items-center justify-between gap-3">
                        <span className="truncate">
                          {form.customerId.slice("import:".length)} - PHP
                        </span>
                        <span className="shrink-0 text-xs italic text-muted-foreground">Customer</span>
                      </span>
                    ) : null}
                  </SelectValue>
                </SelectTrigger>
                {customerSelectOpen ? (
                <SelectContent className="max-h-[min(360px,var(--radix-select-content-available-height))] p-0">
                  <SelectItem
                    value={ADD_CUSTOMER_VALUE}
                    className="rounded-none border-b border-border/60 bg-muted/40 py-2.5 pl-3 pr-8 text-primary font-medium focus:bg-muted/60 focus:text-primary"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4 shrink-0" />
                      Add new
                    </span>
                  </SelectItem>
                  {customerList.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="py-2.5 pl-3 pr-8">
                      <span className="flex w-full min-w-0 items-center justify-between gap-3">
                        <span className="truncate">
                          {c.name} - {c.currency ?? "PHP"}
                        </span>
                        <span className="shrink-0 text-xs italic text-muted-foreground">Customer</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
                ) : null}
              </Select>
              {form.customerId ? (
                <div className="space-y-1.5">
                  <Input
                    className="h-10"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@email.com"
                  />
                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setCcBccOpen((v) => !v)}
                    >
                      {ccBccOpen ? "Hide Cc/Bcc" : ccEmails || bccEmails ? "1 Cc/Bcc" : "Cc/Bcc"}
                    </button>
                    {ccBccOpen ? (
                      <div className="grid w-full gap-2 sm:grid-cols-2">
                        <Input
                          className="h-9"
                          type="email"
                          placeholder="Cc"
                          value={ccEmails}
                          onChange={(e) => setCcEmails(e.target.value)}
                        />
                        <Input
                          className="h-9"
                          type="email"
                          placeholder="Bcc"
                          value={bccEmails}
                          onChange={(e) => setBccEmails(e.target.value)}
                        />
                      </div>
                    ) : null}
                  </div>
                  {mode === "edit" && selectedCustomer ? (
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Bill to</p>
                      <p className="font-medium">{selectedCustomer.name}</p>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline mt-1"
                        onClick={() =>
                          toast({
                            title: "Edit customer",
                            description: "Open Customers to update billing details.",
                          })
                        }
                      >
                        Edit customer
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2 pt-0.5" aria-hidden>
                  <div className="h-3 rounded-sm bg-muted/50" />
                  <div className="h-3 w-4/5 rounded-sm bg-muted/40" />
                  <div className="h-3 w-3/5 rounded-sm bg-muted/30" />
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Invoice no.">
                <Input className="h-10" value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} />
              </Field>
              <Field label="Terms">
                <Select value={form.terms} onValueChange={(v) => setForm((f) => ({ ...f, terms: v }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Invoice date">
                <FormDatePicker
                  value={form.invoiceDate}
                  onChange={(invoiceDate) => setForm((f) => ({ ...f, invoiceDate }))}
                />
              </Field>
              <Field label="Due date">
                <FormDatePicker
                  value={form.dueDate}
                  onChange={(dueDate) => setForm((f) => ({ ...f, dueDate }))}
                />
              </Field>
            </div>

            <Field label="Tags">
              <Input className="h-10" placeholder="Start typing to add a tag" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Location" className="sm:col-span-2 lg:col-span-2">
                <Select value={form.location} onValueChange={(v) => setForm((f) => ({ ...f, location: v }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Invoice amounts are" className="sm:col-span-2 lg:col-span-2">
                <Select value={form.taxSetting} onValueChange={(v) => setForm((f) => ({ ...f, taxSetting: v }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_SETTINGS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Product or Services</h3>
              <div className="rounded-lg border">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[3%]" />
                    <col className="w-[3%]" />
                    <col className="w-[9%]" />
                    <col className="w-[16%]" />
                    <col className="w-[6%]" />
                    <col className="w-[14%]" />
                    <col className="w-[6%]" />
                    <col className="w-[8%]" />
                    <col className="w-[9%]" />
                    <col className="w-[14%]" />
                    <col className="w-[4%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-2 py-2" />
                      <th className="px-2 py-2 font-medium">#</th>
                      <th className="whitespace-nowrap px-2 py-2 font-medium">Service Date</th>
                      <th className="px-2 py-2 font-medium">Product/service</th>
                      <th className="px-2 py-2 font-medium">SKU</th>
                      <th className="px-2 py-2 font-medium">Description</th>
                      <th className={LINE_TABLE_CENTER_HEADER}>Qty</th>
                      <th className={LINE_TABLE_CENTER_HEADER}>Rate</th>
                      <th className={LINE_TABLE_CENTER_HEADER}>Amount</th>
                      <th className="px-2 py-2 font-medium">Class</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((line, index) => (
                      <tr key={line.id} className="border-b border-border/50 last:border-b-0">
                        <td className="px-2 py-1.5 text-muted-foreground/50">
                          <GripVertical className="h-4 w-4" />
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{index + 1}</td>
                        <td className={LINE_TABLE_CELL}>
                          <Input
                            className={cn(LINE_TABLE_DATE_FIELD, "w-full min-w-0")}
                            placeholder="MM/DD/YYYY"
                            value={line.serviceDate}
                            onChange={(e) => updateLine(line.id, { serviceDate: e.target.value })}
                          />
                        </td>
                        <td className={LINE_TABLE_CELL}>
                          <Input
                            className={LINE_TABLE_FIELD}
                            list="invoice-products"
                            placeholder="Select product/service"
                            value={line.productService}
                            onChange={(e) => updateLine(line.id, { productService: e.target.value })}
                          />
                        </td>
                        <td className={LINE_TABLE_CELL}>
                          <Input
                            className={LINE_TABLE_FIELD}
                            value={line.sku}
                            onChange={(e) => updateLine(line.id, { sku: e.target.value })}
                          />
                        </td>
                        <td className={LINE_TABLE_CELL}>
                          <Input
                            className={LINE_TABLE_FIELD}
                            value={line.description}
                            onChange={(e) => updateLine(line.id, { description: e.target.value })}
                          />
                        </td>
                        <td className={LINE_TABLE_CENTER_CELL}>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            className={cn(LINE_TABLE_CENTER_FIELD, "w-full min-w-0")}
                            value={line.qty || ""}
                            onChange={(e) =>
                              updateLine(line.id, { qty: Number.parseFloat(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className={LINE_TABLE_CENTER_CELL}>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className={cn(LINE_TABLE_CENTER_FIELD, "w-full min-w-0")}
                            value={line.rate || ""}
                            onChange={(e) =>
                              updateLine(line.id, { rate: Number.parseFloat(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className={cn(LINE_TABLE_CENTER_CELL, "tabular-nums font-medium")}>
                          {formatPHP(line.qty * line.rate)}
                        </td>
                        <td className={LINE_TABLE_CELL}>
                          <ProductClassSelect
                            value={line.className}
                            onValueChange={(v) => updateLine(line.id, { className: v })}
                            triggerClassName={LINE_TABLE_SELECT}
                            placeholder="Assign a class"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex justify-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              aria-label="Delete line"
                              disabled={form.lines.length <= 1}
                              onClick={() => removeLine(line.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id="invoice-products">
                  {PRODUCT_SUGGESTIONS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" />
                Add product or service
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearLines}>
                Clear all lines
              </Button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
              <div className="space-y-4">
                <Field label="Note to customer">
                  <Textarea className="min-h-[88px] resize-y" value={form.noteToCustomer} onChange={(e) => setForm((f) => ({ ...f, noteToCustomer: e.target.value }))} />
                </Field>
                <Field label="Memo on statement (hidden)" hint="This memo will not appear on the invoice.">
                  <Textarea className="min-h-[72px] resize-y" value={form.memoOnStatement} onChange={(e) => setForm((f) => ({ ...f, memoOnStatement: e.target.value }))} />
                </Field>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Attachments</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleAttachments(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 hover:bg-muted/30"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-primary">Add attachment</span>
                    <span className="text-xs text-muted-foreground">Max file size: 20 MB</span>
                  </button>
                  {attachments.length > 0 && (
                    <ul className="space-y-1.5 text-xs">
                      {attachments.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-2"
                        >
                          <span className="min-w-0 truncate" title={a.name}>
                            {a.name}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => setPreviewAttachment(a)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Preview
                            </Button>
                            <button
                              type="button"
                              className="px-1 text-muted-foreground hover:text-foreground"
                              onClick={() => removeAttachment(a.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-muted/10 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums font-medium">{formatPHP(subtotal)}</span>
                </div>
                {form.discountEnabled && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      Discount
                      <Input
                        className="h-7 w-12 text-xs text-center px-1"
                        type="number"
                        min={0}
                        max={100}
                        value={form.discountPercent || ""}
                        onChange={(e) => setForm((f) => ({ ...f, discountPercent: Number(e.target.value) || 0 }))}
                      />
                      <span className="text-xs">%</span>
                    </span>
                    <span className="tabular-nums">{formatPHP(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Invoice total</span>
                  <span className="tabular-nums">{formatPHP(invoiceTotal)}</span>
                </div>
                {form.shippingEnabled && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    {editingTotals ? (
                      <Input
                        className="h-7 w-24 text-xs text-right"
                        type="number"
                        min={0}
                        value={form.shippingAmount || ""}
                        onChange={(e) => setForm((f) => ({ ...f, shippingAmount: Number(e.target.value) || 0 }))}
                      />
                    ) : (
                      <span className="tabular-nums">{formatPHP(shippingAmount)}</span>
                    )}
                  </div>
                )}
                {form.depositEnabled && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-muted-foreground">Deposit</span>
                    {editingTotals ? (
                      <Input
                        className="h-7 w-24 text-xs text-right"
                        type="number"
                        min={0}
                        value={form.depositAmount || ""}
                        onChange={(e) => setForm((f) => ({ ...f, depositAmount: Number(e.target.value) || 0 }))}
                      />
                    ) : (
                      <span className="tabular-nums">{formatPHP(form.depositAmount)}</span>
                    )}
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Balance due</span>
                  <span className="tabular-nums">{formatPHP(balanceDue)}</span>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs justify-start"
                  onClick={() => setEditingTotals((v) => !v)}
                >
                  {editingTotals ? "Done editing totals" : "Edit totals"}
                </Button>
              </div>
            </div>

          </div>

          <aside className="w-[300px] shrink-0 border-l bg-muted/20 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b bg-card">
              <p className="text-sm font-semibold">
                {mode === "create" ? "New invoice" : `Invoice ${form.number}`}
              </p>
              {mode === "create" ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Suggested no. {form.number}
                </p>
              ) : null}
              <button
                type="button"
                className="text-xs text-primary hover:underline mt-0.5"
                onClick={() => setCustomOpen(true)}
              >
                Edit default settings
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {editingInvoice && statusHeadline ? (
                <SidebarSection
                  title={`Status: ${statusHeadline}`}
                  open={statusOpen}
                  onOpenChange={setStatusOpen}
                  muted
                >
                  <InvoiceStatusTimelinePanel invoice={editingInvoice} />
                </SidebarSection>
              ) : null}
              <SidebarSection title="Customisation" open={customOpen} onOpenChange={setCustomOpen}>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Customise invoice fields, labels, and layout for this template.
                </p>
              </SidebarSection>
              <div ref={paymentSectionRef}>
                <SidebarSection
                  title="Payment options"
                  open={paymentOpen}
                  onOpenChange={setPaymentOpen}
                  badge="NEW"
                >
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    More options
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">Deposit</span>
                      <button
                        type="button"
                        className="text-sm text-primary hover:underline shrink-0"
                        onClick={() => {
                          setForm((f) => ({ ...f, depositEnabled: true }));
                          setEditingTotals(true);
                        }}
                      >
                        Manage
                      </button>
                    </div>
                    <Switch
                      checked={form.depositEnabled}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, depositEnabled: v }))}
                      className={qboSwitchClass}
                      aria-label="Deposit"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">Discount</span>
                    <Switch
                      checked={form.discountEnabled}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, discountEnabled: v }))}
                      className={qboSwitchClass}
                      aria-label="Discount"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">Shipping fee</span>
                    <Switch
                      checked={form.shippingEnabled}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, shippingEnabled: v }))}
                      className={qboSwitchClass}
                      aria-label="Shipping fee"
                    />
                  </div>
                </SidebarSection>
              </div>
              <SidebarSection title="Design" open={designOpen} onOpenChange={setDesignOpen}>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choose logo, colours, and font for customer-facing invoices.
                </p>
              </SidebarSection>
              <SidebarSection title="Scheduling" open={schedulingOpen} onOpenChange={setSchedulingOpen}>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Set automatic reminders before and after the due date.
                </p>
              </SidebarSection>
            </div>
          </aside>
          </fieldset>
        </div>

        {readOnly ? (
          <div className="shrink-0 border-t bg-background px-6 py-3 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => openPrintPreview(false)}>
              Print
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
        <div className="shrink-0 border-t bg-background px-6 py-3 grid grid-cols-3 items-center gap-4">
          <div />
          <div className="flex items-center justify-center gap-2">
            <SplitActionButton
              variant="outline"
              menuAlign="center"
              label="Print or download"
              onClick={() => openPrintPreview(false)}
              menuItems={[
                { label: "Print invoice", onClick: () => openPrintPreview(false) },
                { label: "Download PDF", onClick: () => openPrintPreview(true) },
              ]}
            />
            <SplitActionButton
              variant="outline"
              menuAlign="center"
              label="Make recurring"
              onClick={handleMakeRecurring}
              menuItems={RECURRING_FREQUENCIES.map((f) => ({
                label: `Repeat ${f.toLowerCase()}`,
                onClick: () => {
                  setRecurringFrequency(f);
                  handleMakeRecurring();
                },
              }))}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <SplitActionButton
              label={saving ? "Saving…" : "Save and close"}
              onClick={() => void handleSave(true)}
              menuItems={[
                { label: "Save", onClick: () => void handleSave(false) },
                ...(onSaveAndNew
                  ? [{ label: "Save and new", onClick: () => void handleSaveAndNew() }]
                  : []),
              ]}
            />
            <SplitActionButton
              label="Review and send"
              onClick={openReviewSend}
              menuItems={[
                { label: "Review and send", onClick: openReviewSend },
                {
                  label: "Preview only",
                  onClick: () => {
                    if (!validateForm()) return;
                    openPrintPreview(false);
                  },
                },
                { kind: "separator" },
                {
                  label: "Schedule send",
                  onClick: () => {
                    if (!validateForm()) return;
                    void persistInvoice().then((saved) => {
                      if (!saved) return;
                      toast({
                        title: "Send scheduled",
                        description: `Invoice ${form.number} will be sent on ${form.dueDate}.`,
                      });
                    });
                  },
                },
              ]}
            />
          </div>
        </div>
        )}

      </DialogContent>
    </Dialog>

    <SendInvoiceDialog
      open={reviewOpen}
      onOpenChange={setReviewOpen}
      payload={sendInvoicePayload}
      onBeforeSend={async () => persistInvoice()}
      onSent={() => onOpenChange(false)}
    />

    <CustomerFormDialog
      open={newCustomerOpen}
      onOpenChange={setNewCustomerOpen}
      onSave={handleCreateCustomer}
    />

    <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Make recurring</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Invoice {form.number} for {formatPHP(invoiceTotal)} will be created on a schedule.
        </p>
        <Field label="Frequency">
          <Select
            value={recurringFrequency}
            onValueChange={(v) => setRecurringFrequency(v as (typeof RECURRING_FREQUENCIES)[number])}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECURRING_FREQUENCIES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Next date">
          <FormDatePicker
            value={form.dueDate}
            onChange={(dueDate) => setForm((f) => ({ ...f, dueDate }))}
          />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setRecurringOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={confirmRecurring}>
            Create schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      open={!!previewAttachment}
      onOpenChange={(next) => {
        if (!next) setPreviewAttachment(null);
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{previewAttachment?.name ?? "Attachment preview"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/20 p-2">
          {previewAttachment?.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewAttachment.dataUrl}
              alt={previewAttachment.name}
              className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
            />
          ) : previewAttachment?.mimeType === "application/pdf" ||
            previewAttachment?.name.toLowerCase().endsWith(".pdf") ? (
            <iframe
              title={previewAttachment.name}
              src={previewAttachment.dataUrl}
              className="h-[70vh] w-full rounded-sm bg-background"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                Preview isn&apos;t available for this file type. You can open it in a new tab.
              </p>
              <Button type="button" variant="outline" asChild>
                <a href={previewAttachment?.dataUrl} target="_blank" rel="noreferrer">
                  Open file
                </a>
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setPreviewAttachment(null)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
