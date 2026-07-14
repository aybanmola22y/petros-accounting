"use client";

import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoiceActivitySheet } from "@/components/invoice-activity-sheet";
import { InvoiceTableRow } from "@/components/invoice-table-row";
import type { InvoiceFormValues } from "@/components/invoice-form-dialog";
import type { LinkSplitActionMenuEntry } from "@/components/link-split-action";
import { InvoicesSummaryCard } from "@/components/invoices-summary-card";
import { InvoiceStatusFilterSelect } from "@/components/invoice-status-filter-select";

const InvoiceFormDialog = dynamic(
  () =>
    import("@/components/invoice-form-dialog").then((m) => ({
      default: m.InvoiceFormDialog,
    })),
  { ssr: false },
);

const ReceivePaymentFormDialog = dynamic(
  () =>
    import("@/components/receive-payment-form-dialog").then((m) => ({
      default: m.ReceivePaymentFormDialog,
    })),
  { ssr: false },
);

const SendInvoiceDialog = dynamic(
  () =>
    import("@/components/send-invoice-dialog").then((m) => ({
      default: m.SendInvoiceDialog,
    })),
  { ssr: false },
);
import {
  INVOICE_DATE_FILTER_OPTIONS,
  invoiceMatchesDateFilter,
  type InvoiceDateFilter,
} from "@/lib/invoice-list-date-filters";
import {
  invoiceMatchesStatusFilter,
  normalizeInvoiceStatusFilter,
  type InvoiceStatusFilter,
} from "@/lib/invoice-list-status-filters";
import type { ReceivePaymentFormValues } from "@/components/receive-payment-form-dialog";
import type {
  SendInvoiceDialogMode,
  SendInvoicePayload,
} from "@/components/send-invoice-dialog";
import { VoidInvoiceDialog } from "@/components/void-invoice-dialog";
import { DeleteInvoiceDialog } from "@/components/delete-invoice-dialog";
import { useInvoicesBootstrap } from "@/hooks/use-invoices-bootstrap";
import { useMockReceivables } from "@/hooks/use-mock-receivables";
import { useMockSales } from "@/hooks/use-mock-sales";
import { useToast } from "@/hooks/use-toast";
import { deleteInvoiceViaApi, voidInvoiceViaApi } from "@/lib/invoices/api";
import {
  buildInvoicePrefillFromInvoice,
} from "@/lib/invoice-form-prefill";
import { openInvoicePrintPreview, openPackingSlipPrint } from "@/lib/invoice-print";
import {
  getDisplayInvoicesSnapshot,
  getInvoiceById,
  getNextInvoiceNumber,
  recordInvoiceCreation,
  recordInvoiceOpened,
  recordInvoiceUpdate,
  recordReceivePaymentAgainstInvoice,
  subscribeMockStore,
  type InvoiceViewRow,
} from "@/lib/mock-data";
import { buildReceivePaymentPrefillFromInvoice } from "@/lib/receive-payment-prefill";
import {
  INVOICES_PATH,
  INVOICE_STATUS_SEARCH_PARAM,
  NEW_INVOICE_SEARCH_PARAM,
} from "@/lib/invoice-navigation";
import { formatPHP } from "@/views/financial-report-shared";

type Invoice = InvoiceViewRow;

const EMPTY_INVOICES: InvoiceViewRow[] = [];

function useDisplayInvoices() {
  return useSyncExternalStore(
    subscribeMockStore,
    getDisplayInvoicesSnapshot,
    () => EMPTY_INVOICES,
  );
}


type InvoiceColumnKey = "invoiceNumber" | "balance" | "dueDate";

const INVOICE_COLUMN_OPTIONS: { key: InvoiceColumnKey; label: string }[] = [
  { key: "invoiceNumber", label: "Invoice number" },
  { key: "balance", label: "Balance" },
  { key: "dueDate", label: "Due date" },
];

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

type InvoiceTablePrefs = {
  columns: Record<InvoiceColumnKey, boolean>;
  pageSize: number;
};

const DEFAULT_INVOICE_TABLE_PREFS: InvoiceTablePrefs = {
  columns: {
    invoiceNumber: true,
    balance: false,
    dueDate: false,
  },
  pageSize: 50,
};

const INVOICE_TABLE_PREFS_KEY = "petrobook.invoices-table-prefs";

function loadInvoiceTablePrefs(): InvoiceTablePrefs {
  if (typeof window === "undefined") return DEFAULT_INVOICE_TABLE_PREFS;
  try {
    const raw = localStorage.getItem(INVOICE_TABLE_PREFS_KEY);
    if (!raw) return DEFAULT_INVOICE_TABLE_PREFS;
    const parsed = JSON.parse(raw) as Partial<InvoiceTablePrefs>;
    return {
      columns: { ...DEFAULT_INVOICE_TABLE_PREFS.columns, ...parsed.columns },
      pageSize: PAGE_SIZE_OPTIONS.includes(parsed.pageSize as (typeof PAGE_SIZE_OPTIONS)[number])
        ? (parsed.pageSize as number)
        : DEFAULT_INVOICE_TABLE_PREFS.pageSize,
    };
  } catch {
    return DEFAULT_INVOICE_TABLE_PREFS;
  }
}

function saveInvoiceTablePrefs(prefs: InvoiceTablePrefs) {
  localStorage.setItem(INVOICE_TABLE_PREFS_KEY, JSON.stringify(prefs));
}

export function Invoices() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  useInvoicesBootstrap();
  const { customers } = useMockReceivables();
  useMockSales();
  const allInvoices = useDisplayInvoices();
  const totalRecords = allInvoices.length;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<InvoiceDateFilter>("This year");
  const [page, setPage] = useState(1);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceDialogMode, setInvoiceDialogMode] = useState<"create" | "edit">("create");
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [invoicePrefill, setInvoicePrefill] = useState<InvoiceFormValues | null>(null);
  const [draftInvoiceNumber, setDraftInvoiceNumber] = useState(() => getNextInvoiceNumber());
  const [receivePaymentOpen, setReceivePaymentOpen] = useState(false);
  const [receivePaymentPrefill, setReceivePaymentPrefill] =
    useState<ReceivePaymentFormValues | null>(null);
  const [receivePaymentInvoiceId, setReceivePaymentInvoiceId] = useState<string | null>(null);
  const [sendInvoiceOpen, setSendInvoiceOpen] = useState(false);
  const [sendInvoicePayload, setSendInvoicePayload] = useState<SendInvoicePayload | null>(null);
  const [sendDialogMode, setSendDialogMode] = useState<SendInvoiceDialogMode>("invoice");
  const [voidInvoiceTarget, setVoidInvoiceTarget] = useState<InvoiceViewRow | null>(null);
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState<InvoiceViewRow | null>(null);
  const [activityInvoiceId, setActivityInvoiceId] = useState<string | null>(null);
  const [tablePrefs, setTablePrefs] = useState<InvoiceTablePrefs>(() => loadInvoiceTablePrefs());
  const [columnsOpen, setColumnsOpen] = useState(false);

  const pageSize = tablePrefs.pageSize;
  const visibleColumns = tablePrefs.columns;

  const activityRow = useMemo(
    () =>
      activityInvoiceId
        ? (allInvoices.find((inv) => inv.id === activityInvoiceId) ?? null)
        : null,
    [activityInvoiceId, allInvoices],
  );
  const activityInvoice = activityInvoiceId
    ? (getInvoiceById(activityInvoiceId) ?? null)
    : null;
  const activityPrefill = useMemo(() => {
    if (!activityInvoice || !activityRow) return null;
    return buildInvoicePrefillFromInvoice(activityInvoice, customers, activityRow);
  }, [activityInvoice, activityRow, customers]);
  const activityCustomerEmail = useMemo(() => {
    if (!activityPrefill) return undefined;
    return customers.find((c) => c.id === activityPrefill.customerId)?.email;
  }, [activityPrefill, customers]);

  useEffect(() => {
    const status = searchParams.get(INVOICE_STATUS_SEARCH_PARAM);
    if (status !== null) {
      setStatusFilter(normalizeInvoiceStatusFilter(status));
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get(NEW_INVOICE_SEARCH_PARAM) === "1") {
      openCreateInvoice();
      const params = new URLSearchParams(searchParams.toString());
      params.delete(NEW_INVOICE_SEARCH_PARAM);
      const q = params.toString();
      router.replace(q ? `${INVOICES_PATH}?${q}` : INVOICES_PATH, { scroll: false });
    }
  }, [searchParams, router]);

  const receivePaymentCustomers = useMemo(
    () =>
      customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        openBalance: c.openBalance,
      })),
    [customers],
  );

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        currency: c.currency,
      })),
    [customers],
  );

  function closeInvoiceDialog() {
    setInvoiceDialogOpen(false);
    setInvoicePrefill(null);
    setEditingInvoiceId(null);
    setInvoiceDialogMode("create");
  }

  function openCreateInvoice() {
    const nextNumber = getNextInvoiceNumber();
    startTransition(() => {
      setInvoiceDialogMode("create");
      setInvoicePrefill(null);
      setEditingInvoiceId(null);
      setDraftInvoiceNumber(nextNumber);
      setInvoiceDialogOpen(true);
    });
  }

  useEffect(() => {
    let cancelled = false;
    const warmDialogs = () => {
      if (cancelled) return;
      void import("@/components/invoice-form-dialog");
      void import("@/components/receive-payment-form-dialog");
      void import("@/components/send-invoice-dialog");
    };

    if (typeof window === "undefined") return;
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(warmDialogs, { timeout: 1200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(warmDialogs, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  function buildSendPayload(
    row: InvoiceViewRow,
    prefill: InvoiceFormValues,
    customerEmail?: string,
  ): SendInvoicePayload {
    return {
      invoiceId: row.id,
      number: prefill.number,
      customerName: row.customer,
      customerEmail,
      invoiceDate: prefill.invoiceDate,
      dueDate: prefill.dueDate,
      terms: prefill.terms,
      noteToCustomer: prefill.noteToCustomer,
      lines: prefill.lines.map((l) => ({
        productService: l.productService,
        qty: l.qty,
        rate: l.rate,
      })),
      discountEnabled: prefill.discountEnabled,
      discountPercent: prefill.discountPercent,
      shippingEnabled: prefill.shippingEnabled,
      shippingAmount: prefill.shippingAmount,
      depositEnabled: prefill.depositEnabled,
      depositAmount: prefill.depositAmount,
    };
  }

  function openSendInvoice(row: InvoiceViewRow, mode: SendInvoiceDialogMode = "invoice") {
    const invoice = getInvoiceById(row.id);
    if (!invoice) {
      toast({
        title: "Invoice not found",
        description: "This invoice could not be loaded.",
        variant: "destructive",
      });
      return;
    }
    if (invoice.voided) {
      toast({
        title: "Invoice voided",
        description: `Invoice ${row.number} was voided.`,
        variant: "destructive",
      });
      return;
    }
    void recordInvoiceOpened(row.id);
    const prefill = buildInvoicePrefillFromInvoice(invoice, customerOptions, row);
    const customer = customerOptions.find((c) => c.id === prefill.customerId);
    setSendDialogMode(mode);
    setSendInvoicePayload(buildSendPayload(row, prefill, customer?.email));
    setSendInvoiceOpen(true);
  }

  function sendReminder(row: InvoiceViewRow) {
    openSendInvoice(row, "reminder");
  }

  const openInvoiceEdit = useCallback((row: InvoiceViewRow) => {
    const invoice = getInvoiceById(row.id);
    if (!invoice) {
      toast({
        title: "Invoice not found",
        description: "This invoice could not be loaded.",
        variant: "destructive",
      });
      return;
    }
    if (invoice.voided) {
      toast({
        title: "Invoice voided",
        description: `Invoice ${row.number} was voided and cannot be edited.`,
        variant: "destructive",
      });
      return;
    }
    void recordInvoiceOpened(row.id);
    const prefill = buildInvoicePrefillFromInvoice(invoice, customerOptions, row);
    startTransition(() => {
      setInvoiceDialogMode("edit");
      setEditingInvoiceId(row.id);
      setInvoicePrefill(prefill);
      setDraftInvoiceNumber(row.number);
      setInvoiceDialogOpen(true);
    });
  }, [customerOptions, toast]);

  function duplicateInvoice(row: InvoiceViewRow) {
    const invoice = getInvoiceById(row.id);
    if (!invoice) return;
    const prefill = buildInvoicePrefillFromInvoice(invoice, customerOptions, row);
    const nextNumber = getNextInvoiceNumber();
    startTransition(() => {
      setInvoiceDialogMode("create");
      setEditingInvoiceId(null);
      setInvoicePrefill({ ...prefill, number: nextNumber });
      setDraftInvoiceNumber(nextNumber);
      setInvoiceDialogOpen(true);
    });
    toast({
      title: "Invoice duplicated",
      description: `Editing new invoice ${nextNumber} copied from ${row.number}.`,
    });
  }

  function printInvoiceRow(row: InvoiceViewRow, packingSlip = false) {
    const invoice = getInvoiceById(row.id);
    if (!invoice) return;
    const prefill = buildInvoicePrefillFromInvoice(invoice, customerOptions, row);
    const customer = customerOptions.find((c) => c.id === prefill.customerId);
    const printInput = {
      number: prefill.number,
      customerName: customer?.name ?? row.customer,
      invoiceDate: prefill.invoiceDate,
      dueDate: prefill.dueDate,
      terms: prefill.terms,
      noteToCustomer: prefill.noteToCustomer,
      lines: prefill.lines,
      discountEnabled: prefill.discountEnabled,
      discountPercent: prefill.discountPercent,
      shippingEnabled: prefill.shippingEnabled,
      shippingAmount: prefill.shippingAmount,
      depositEnabled: prefill.depositEnabled,
      depositAmount: prefill.depositAmount,
      status: row.status.kind as "paid" | "overdue" | "partial" | "open" | "void",
      balanceDueOverride: invoice.balanceDue,
      amountPaid: Math.max(0, invoice.amount - invoice.balanceDue),
    };
    const ok = packingSlip
      ? openPackingSlipPrint(printInput)
      : openInvoicePrintPreview(printInput);
    if (!ok) {
      toast({
        title: "Pop-up blocked",
        description: "Allow pop-ups to print this invoice.",
        variant: "destructive",
      });
    }
  }

  function shareInvoiceLink(row: InvoiceViewRow) {
    const url = `${window.location.origin}${INVOICES_PATH}?invoice=${encodeURIComponent(row.number)}`;
    void navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link copied",
        description: "Share this link with your customer to view the invoice.",
      });
    });
  }

  function createTask(row: InvoiceViewRow) {
    toast({
      title: "Task created",
      description: `Follow up on invoice ${row.number} for ${row.customer}.`,
    });
  }

  function voidInvoiceRow(row: InvoiceViewRow) {
    setVoidInvoiceTarget(row);
  }

  async function confirmVoidInvoice() {
    if (!voidInvoiceTarget) return;
    const row = voidInvoiceTarget;
    try {
      await voidInvoiceViaApi(row.id);
      toast({ title: "Invoice voided", description: `Invoice ${row.number} was voided.` });
      setVoidInvoiceTarget(null);
    } catch (error) {
      toast({
        title: "Could not void",
        description: error instanceof Error ? error.message : "Invoice was not found.",
        variant: "destructive",
      });
    }
  }

  function deleteInvoiceRow(row: InvoiceViewRow) {
    setDeleteInvoiceTarget(row);
  }

  async function confirmDeleteInvoice() {
    if (!deleteInvoiceTarget) return;
    const row = deleteInvoiceTarget;
    try {
      await deleteInvoiceViaApi(row.id);
      toast({ title: "Invoice deleted", description: `Invoice ${row.number} was removed.` });
      setDeleteInvoiceTarget(null);
    } catch (error) {
      toast({
        title: "Could not delete",
        description: error instanceof Error ? error.message : "Invoice was not found.",
        variant: "destructive",
      });
    }
  }

  const getActionMenu = useCallback(
    (row: InvoiceViewRow): LinkSplitActionMenuEntry[] => {
      const voided = row.status.kind === "void";
      return [
        { label: "View/Edit", onClick: () => openInvoiceEdit(row) },
        { label: "Duplicate", onClick: () => duplicateInvoice(row) },
        { label: "Send", onClick: () => openSendInvoice(row) },
        { label: "Send reminder", onClick: () => sendReminder(row) },
        { label: "Create task", onClick: () => createTask(row) },
        { label: "Share invoice link", onClick: () => shareInvoiceLink(row) },
        { label: "Print", onClick: () => printInvoiceRow(row) },
        { label: "Print packing slip", onClick: () => printInvoiceRow(row, true) },
        { kind: "separator" as const },
        { label: "Void", onClick: () => voidInvoiceRow(row) },
        { label: "Delete", onClick: () => deleteInvoiceRow(row) },
        { label: "View activity", onClick: () => setActivityInvoiceId(row.id) },
      ].filter((item) => {
        if (!voided) return true;
        if ("kind" in item) return true;
        return !["Send", "Send reminder", "Void"].includes(item.label);
      });
    },
    [openInvoiceEdit],
  );

  function closeReceivePaymentDialog() {
    setReceivePaymentOpen(false);
    setReceivePaymentPrefill(null);
    setReceivePaymentInvoiceId(null);
  }

  function openReceivePaymentForInvoice(row: InvoiceViewRow, closeInvoice = false) {
    const invoice = getInvoiceById(row.id);
    if (!invoice) {
      toast({
        title: "Invoice not found",
        description: "This invoice could not be loaded.",
        variant: "destructive",
      });
      return;
    }
    if (invoice.voided) {
      toast({
        title: "Invoice voided",
        description: `Invoice ${row.number} was voided.`,
        variant: "destructive",
      });
      return;
    }
    if (invoice.kind === "paid" || invoice.balanceDue <= 0) {
      toast({
        title: "Already paid",
        description: `Invoice ${row.number} has no balance due.`,
      });
      return;
    }
    setReceivePaymentPrefill(
      buildReceivePaymentPrefillFromInvoice(invoice, receivePaymentCustomers, row.dueDate),
    );
    setReceivePaymentInvoiceId(row.id);
    if (closeInvoice) closeInvoiceDialog();
    setReceivePaymentOpen(true);
  }

  function invoiceAmounts(values: InvoiceFormValues) {
    const subtotal = values.lines.reduce((sum, line) => sum + line.qty * line.rate, 0);
    const discount = values.discountEnabled ? (subtotal * values.discountPercent) / 100 : 0;
    const shipping = values.shippingEnabled ? values.shippingAmount : 0;
    const amount = Math.max(0, subtotal - discount + shipping);
    const balanceDue = Math.max(0, amount - (values.depositEnabled ? values.depositAmount : 0));
    return { amount, balanceDue };
  }

  async function handleCreateInvoice(values: InvoiceFormValues) {
    const { amount, balanceDue } = invoiceAmounts(values);
    const customer = customerOptions.find((c) => c.id === values.customerId);

    await recordInvoiceCreation({
      customerId: values.customerId,
      customerName: customer?.name ?? "Unknown customer",
      number: values.number,
      invoiceDate: values.invoiceDate,
      terms: values.terms,
      noteToCustomer: values.noteToCustomer,
      amount,
      balanceDue,
      lines: values.lines,
    });

    setPage(1);
    toast({
      title: "Invoice created",
      description: `Invoice ${values.number} for ${formatPHP(balanceDue)}.`,
    });
  }

  async function handleUpdateInvoice(values: InvoiceFormValues): Promise<boolean> {
    if (!editingInvoiceId) return false;
    const { amount, balanceDue } = invoiceAmounts(values);
    const customer = customerOptions.find((c) => c.id === values.customerId);

    const ok = await recordInvoiceUpdate({
      invoiceId: editingInvoiceId,
      customerId: values.customerId,
      customerName: customer?.name ?? "Unknown customer",
      number: values.number,
      invoiceDate: values.invoiceDate,
      terms: values.terms,
      noteToCustomer: values.noteToCustomer,
      amount,
      balanceDue,
      lines: values.lines,
    });

    if (!ok) {
      toast({
        title: "Could not save",
        description: "Invoice was not found.",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Invoice updated",
      description: `Invoice ${values.number} — ${formatPHP(balanceDue)} balance due.`,
    });
    return true;
  }

  async function handleInvoiceSave(values: InvoiceFormValues): Promise<boolean> {
    try {
      if (invoiceDialogMode === "edit") {
        return await handleUpdateInvoice(values);
      }
      await handleCreateInvoice(values);
      return true;
    } catch (error) {
      toast({
        title: "Could not save invoice",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      return false;
    }
  }

  async function handleSaveReceivePayment(values: ReceivePaymentFormValues) {
    const customer = receivePaymentCustomers.find((c) => c.id === values.customerId);
    const selectedLine = values.lines.find((l) => l.selected && l.payment > 0);
    const invoiceId = receivePaymentInvoiceId ?? selectedLine?.id ?? null;

    if (!invoiceId) {
      toast({
        title: "Select an invoice",
        description: "Choose at least one invoice to apply this payment.",
        variant: "destructive",
      });
      return;
    }

    const paymentAmount =
      selectedLine?.payment && selectedLine.payment > 0
        ? selectedLine.payment
        : values.amountReceived;

    try {
      const ok = await recordReceivePaymentAgainstInvoice({
        invoiceId,
        customerName: customer?.name ?? "Unknown customer",
        paymentDate: values.paymentDate,
        amount: paymentAmount,
        referenceNo: values.referenceNo,
        memo: values.memo,
        depositToId: values.depositToId,
      });

      if (!ok) {
        toast({
          title: "Could not record payment",
          description: "Payment was not saved.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Payment recorded",
        description: `${formatPHP(paymentAmount)} applied to invoice.`,
      });
      closeReceivePaymentDialog();
    } catch (error) {
      toast({
        title: "Could not record payment",
        description: error instanceof Error ? error.message : "Payment was not saved.",
        variant: "destructive",
      });
    }
  }

  function handleSaveAndNew() {
    const next = getNextInvoiceNumber();
    setDraftInvoiceNumber(next);
    return next;
  }

  const filtered = useMemo(() => {
    return allInvoices.filter((inv) => {
      if (!invoiceMatchesStatusFilter(inv, statusFilter)) return false;
      return invoiceMatchesDateFilter(inv.date, dateFilter);
    });
  }, [allInvoices, statusFilter, dateFilter]);

  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const displayTotal = filtered.length;
  const rangeStart = displayTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, displayTotal);
  const totalPages = Math.max(1, Math.ceil(displayTotal / pageSize));

  const tableColumnCount =
    6 +
    (visibleColumns.invoiceNumber ? 1 : 0) +
    (visibleColumns.balance ? 1 : 0) +
    (visibleColumns.dueDate ? 1 : 0);

  function setVisibleColumn(key: InvoiceColumnKey, checked: boolean) {
    setTablePrefs((prev) => ({
      ...prev,
      columns: { ...prev.columns, [key]: checked },
    }));
  }

  function setPageSize(size: number) {
    setTablePrefs((prev) => ({ ...prev, pageSize: size }));
    setPage(1);
  }

  function handleSaveTableDefaults() {
    saveInvoiceTablePrefs(tablePrefs);
    setColumnsOpen(false);
    toast({
      title: "Table settings saved",
      description: "Your column and row preferences were saved as default.",
    });
  }

  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p));
  }, [totalPages]);

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((inv) => selected.has(inv.id));

  const toggleAllOnPage = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageItems.forEach((inv) => next.delete(inv.id));
      else pageItems.forEach((inv) => next.add(inv.id));
      return next;
    });
  }, [allPageSelected, pageItems]);

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleReceivePayment = useCallback(
    (row: InvoiceViewRow) => {
      openReceivePaymentForInvoice(row);
    },
    [receivePaymentCustomers, toast],
  );

  const handlePrintRow = useCallback(
    (row: InvoiceViewRow) => {
      printInvoiceRow(row);
    },
    [customerOptions],
  );

  return (
    <div className="space-y-5">
      <InvoicesSummaryCard collapsible />

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  Batch actions
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem>Send reminders</DropdownMenuItem>
                <DropdownMenuItem>Print</DropdownMenuItem>
                <DropdownMenuItem>Export</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Void</DropdownMenuItem>
                <DropdownMenuItem>Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Status</span>
              <InvoiceStatusFilterSelect
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Date</span>
              <Select
                value={dateFilter}
                onValueChange={(v) => {
                  setDateFilter(v as InvoiceDateFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[180px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[min(320px,70vh)]">
                  {INVOICE_DATE_FILTER_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 shadow-sm shrink-0">
                <Plus className="h-4 w-4" />
                Create invoice
                <ChevronDown className="h-3.5 w-3.5 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openCreateInvoice}>
                Invoice
              </DropdownMenuItem>
              <DropdownMenuItem>Recurring invoice</DropdownMenuItem>
              <DropdownMenuItem>Import invoices</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleAllOnPage}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Date
                </th>
                {visibleColumns.invoiceNumber && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    No.
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[200px]">
                  Customer
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-7.5rem whitespace-nowrap">
                  Amount
                </th>
                {visibleColumns.balance && (
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground min-w7.5rem whitespace-nowrap">
                    Balance
                  </th>
                )}
                {visibleColumns.dueDate && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-5.5rem whitespace-nowrap">
                    Due date
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[180px]">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[220px]">
                  <div className="flex items-center justify-end gap-2">
                    Action
                    <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Customize columns and rows"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 p-0">
                        <div className="max-h-[min(420px,70vh)] overflow-y-auto p-4 space-y-4">
                          <div className="space-y-2">
                            <p className="text-sm font-semibold">Columns</p>
                            <div className="space-y-2">
                              {INVOICE_COLUMN_OPTIONS.map(({ key, label }) => (
                                <label
                                  key={key}
                                  className="flex items-center gap-2.5 text-sm cursor-pointer"
                                >
                                  <Checkbox
                                    checked={visibleColumns[key]}
                                    onCheckedChange={(v) => setVisibleColumn(key, v === true)}
                                  />
                                  <span>{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2 border-t pt-4">
                            <p className="text-sm font-semibold">Rows</p>
                            <RadioGroup
                              value={String(pageSize)}
                              onValueChange={(v) => setPageSize(Number(v))}
                              className="gap-2"
                            >
                              {PAGE_SIZE_OPTIONS.map((size) => (
                                <div key={size} className="flex items-center gap-2">
                                  <RadioGroupItem value={String(size)} id={`invoice-rows-${size}`} />
                                  <Label htmlFor={`invoice-rows-${size}`} className="text-sm font-normal">
                                    {size}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        </div>
                        <div className="border-t p-3">
                          <Button
                            type="button"
                            size="sm"
                            className="w-full"
                            onClick={handleSaveTableDefaults}
                          >
                            Save as default
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="px-4 py-16 text-center text-muted-foreground">
                    No invoices match your filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((inv, index) => (
                  <InvoiceTableRow
                    key={inv.id}
                    inv={inv}
                    index={index}
                    isSelected={selected.has(inv.id)}
                    showInvoiceNumber={visibleColumns.invoiceNumber}
                    showBalance={visibleColumns.balance}
                    showDueDate={visibleColumns.dueDate}
                    onToggleSelect={toggleRow}
                    onViewEdit={openInvoiceEdit}
                    onReceivePayment={handleReceivePayment}
                    onPrint={handlePrintRow}
                    getActionMenu={getActionMenu}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              disabled={page <= 1}
              onClick={() => setPage(1)}
            >
              <ChevronFirst className="h-4 w-4 mr-0.5" />
              First
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-0.5" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums px-3">
              {rangeStart}–{rangeEnd} of {displayTotal}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
            >
              Last
              <ChevronLast className="h-4 w-4 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>

      {invoiceDialogOpen ? (
      <InvoiceFormDialog
        key={editingInvoiceId ?? "create-invoice"}
        open={invoiceDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeInvoiceDialog();
          else setInvoiceDialogOpen(true);
        }}
        invoiceNumber={draftInvoiceNumber}
        customers={customerOptions}
        mode={invoiceDialogMode === "edit" ? "edit" : "create"}
        prefill={invoicePrefill}
        editingInvoiceId={editingInvoiceId}
        onReceivePayment={
          editingInvoiceId
            ? () => {
                const row = allInvoices.find((i) => i.id === editingInvoiceId);
                if (row) openReceivePaymentForInvoice(row, true);
              }
            : undefined
        }
        onSave={handleInvoiceSave}
        onSaveAndNew={
          invoiceDialogMode === "create"
            ? handleSaveAndNew
            : undefined
        }
      />
      ) : null}

      {sendInvoiceOpen ? (
      <SendInvoiceDialog
        open={sendInvoiceOpen}
        onOpenChange={setSendInvoiceOpen}
        payload={sendInvoicePayload}
        mode={sendDialogMode}
      />
      ) : null}

      <VoidInvoiceDialog
        open={voidInvoiceTarget !== null}
        onOpenChange={(open) => {
          if (!open) setVoidInvoiceTarget(null);
        }}
        onConfirm={confirmVoidInvoice}
      />

      <DeleteInvoiceDialog
        open={deleteInvoiceTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteInvoiceTarget(null);
        }}
        onConfirm={confirmDeleteInvoice}
      />

      <InvoiceActivitySheet
        open={activityInvoiceId !== null}
        onOpenChange={(open) => {
          if (!open) setActivityInvoiceId(null);
        }}
        row={activityRow}
        invoice={activityInvoice}
        customerEmail={activityCustomerEmail}
        lines={activityPrefill?.lines ?? []}
        menuItems={activityRow ? getActionMenu(activityRow) : []}
        onEdit={() => {
          if (activityRow) openInvoiceEdit(activityRow);
        }}
      />

      {receivePaymentOpen ? (
      <ReceivePaymentFormDialog
        open={receivePaymentOpen}
        onOpenChange={(open) => {
          if (!open) closeReceivePaymentDialog();
          else setReceivePaymentOpen(true);
        }}
        customers={receivePaymentCustomers}
        prefill={receivePaymentPrefill}
        canSave
        onSave={handleSaveReceivePayment}
      />
      ) : null}
    </div>
  );
}
