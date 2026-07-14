"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquare,
  Plus,
  Printer,
  Search,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoiceFormDialog, type InvoiceFormValues } from "@/components/invoice-form-dialog";
import {
  ReceivePaymentFormDialog,
  type ReceivePaymentFormValues,
} from "@/components/receive-payment-form-dialog";
import {
  SalesTransactionEditDialog,
  type SalesTransactionEditValues,
} from "@/components/sales-transaction-edit-dialog";
import { SalesTransactionDateFilterControl } from "@/components/sales-transaction-date-filter";
import { useInvoicesBootstrap } from "@/hooks/use-invoices-bootstrap";
import {
  useImportedArAgingDetailLines,
  useImportedArAgingDetailSnapshot,
} from "@/hooks/use-imported-ar-aging-detail";
import { useMockReceivables } from "@/hooks/use-mock-receivables";
import { useMockSales } from "@/hooks/use-mock-sales";
import { useToast } from "@/hooks/use-toast";
import {
  computeSalesTransactionKpiSummary,
  salesTransactionDateRange,
  salesTransactionMatchesKpiFilter,
  transactionInDateRange,
  type SalesTransactionKpiId,
} from "@/lib/ledger/compute-sales-transaction-kpi";
import { salesTransactionOpenBalances } from "@/lib/ledger/invoices-from-sales-transactions";
import {
  defaultSalesTransactionCustomDateRange,
  type SalesTransactionDateFilter,
} from "@/lib/sales-transaction-list-date-filters";
import {
  addSalesTransaction,
  deleteSalesTransactions,
  formatInvoiceNumber,
  getInvoiceById,
  getNextInvoiceNumber,
  getNextPaymentNumber,
  recordInvoiceCreation,
  recordReceivePaymentAgainstInvoice,
  updateInvoice,
  updateSalesTransaction,
  type MockSalesTransaction,
} from "@/lib/mock-data";
import { exportSalesTransactionsCsv } from "@/lib/sales-transactions/export-csv";
import {
  BANK_DEPOSIT_SEARCH_PARAM,
  SALES_TRANSACTIONS_PATH,
} from "@/lib/sales-navigation";
import { buildInvoicePrefillFromTransaction } from "@/lib/sales-transaction-invoice-prefill";
import { buildReceivePaymentPrefillFromTransaction } from "@/lib/receive-payment-prefill";
import {
  getSalesTransactionStatusDisplay,
} from "@/lib/sales-transaction-status-display";
import {
  SALES_DELIVERY_FILTER_OPTIONS,
  SALES_ERROR_FILTER_OPTIONS,
  SALES_STATUS_FILTER_OPTIONS,
  SALES_TYPE_FILTER_OPTIONS,
  salesDeliveryFilterLabel,
  salesErrorFilterLabel,
  salesStatusFilterLabel,
  salesTransactionMatchesDeliveryFilter,
  salesTransactionMatchesErrorFilter,
  salesTransactionMatchesStatusFilter,
  salesTransactionMatchesTypeFilter,
  salesTransactionListSignedAmount,
  type SalesDeliveryFilter,
  type SalesErrorFilter,
  type SalesStatusFilter,
  type SalesTypeFilter,
} from "@/lib/sales-transaction-filters";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

type SalesTransaction = MockSalesTransaction;

const PAGE_SIZE = 10;

const KPI_FILTER_LABELS: Record<SalesTransactionKpiId, string> = {
  estimates: "Estimates",
  unbilled: "Unbilled income",
  overdue: "Overdue invoices",
  open: "Open invoices and credits",
  paid: "Recently paid",
};

type ColumnKey = "memo";

const KPI_TYPE_FILTER: Partial<Record<SalesTransactionKpiId, SalesTypeFilter>> = {
  estimates: "Estimates",
  unbilled: "Unbilled Income",
  paid: "Money received",
};

const KPI_STATUS_FILTER: Partial<Record<SalesTransactionKpiId, SalesStatusFilter>> = {
  overdue: "Overdue",
};

function isVoidTransaction(txn: SalesTransaction): boolean {
  const status = txn.qbStatus?.trim().toLowerCase() ?? "";
  const memo = txn.memo.trim().toLowerCase();
  return status === "void" || memo.includes("void");
}

function defaultStatusForType(type: MockSalesTransaction["type"]): MockSalesTransaction["status"] {
  if (type === "Payment") return { kind: "unapplied" };
  return { kind: "overdue", detail: "Due on receipt" };
}

function defaultQbStatusForType(type: MockSalesTransaction["type"]): string {
  if (type === "Payment") return "unapplied";
  if (type === "Estimate") return "pending";
  return "open";
}

function nextNumberForType(type: MockSalesTransaction["type"]): string {
  if (type === "Payment") return getNextPaymentNumber();
  if (type === "Invoice") return getNextInvoiceNumber();
  return "";
}

function StatusCell({
  txn,
  openBalances,
}: {
  txn: SalesTransaction;
  openBalances: ReadonlyMap<string, number>;
}) {
  const display = getSalesTransactionStatusDisplay(txn, { openBalances });

  if (display.tone === "success") {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="text-sm font-medium text-emerald-700">{display.label}</span>
      </div>
    );
  }

  if (display.tone === "muted") {
    return <span className="text-sm text-muted-foreground">{display.label}</span>;
  }

  if (display.tone === "warning") {
    return (
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-700">{display.label}</p>
          {display.detail ? (
            <p className="text-xs text-muted-foreground">{display.detail}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground">{display.label}</p>
      {display.detail ? (
        <p className="text-xs text-muted-foreground">{display.detail}</p>
      ) : null}
    </div>
  );
}

function SummaryBar({
  kpiFilter,
  allTransactions,
  listScopeTransactions,
  arScopeTransactions,
  customerQuery,
  arAgingDetailLines,
  arAgingAsOf,
  onKpiFilterChange,
}: {
  kpiFilter: SalesTransactionKpiId | null;
  allTransactions: SalesTransaction[];
  listScopeTransactions: SalesTransaction[];
  arScopeTransactions: SalesTransaction[];
  customerQuery: string;
  arAgingDetailLines: ReturnType<typeof useImportedArAgingDetailLines>;
  arAgingAsOf?: string;
  onKpiFilterChange: (filter: SalesTransactionKpiId | null) => void;
}) {
  const kpiSegments = useMemo(
    () =>
      computeSalesTransactionKpiSummary(allTransactions, undefined, {
        listScope: listScopeTransactions,
        arScope: arScopeTransactions,
        customerQuery,
        arAgingDetailLines,
        arAgingAsOf,
      }).segments,
    [
      allTransactions,
      listScopeTransactions,
      arScopeTransactions,
      customerQuery,
      arAgingDetailLines,
      arAgingAsOf,
    ],
  );
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x">
        {kpiSegments.map((seg) => {
          const isActive = kpiFilter === seg.id;
          return (
            <button
              key={seg.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onKpiFilterChange(isActive ? null : seg.id)}
              className={cn(
                "group flex flex-col text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive && "bg-muted/40 ring-1 ring-inset ring-muted-foreground/25",
              )}
            >
              <div className="px-4 py-3">
                <p className={cn("text-lg font-semibold tabular-nums", seg.textClass)}>
                  {formatPHP(seg.amount)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {seg.showCount && seg.count > 0 ? (
                    <>
                      <span className="font-medium text-foreground">{seg.count}</span> {seg.label}
                    </>
                  ) : (
                    seg.label
                  )}
                </p>
              </div>
              <div className={cn("h-2 w-full shrink-0", seg.barClass)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function invoiceAmounts(values: InvoiceFormValues) {
  const subtotal = values.lines.reduce((sum, line) => sum + line.qty * line.rate, 0);
  const discount = values.discountEnabled ? (subtotal * values.discountPercent) / 100 : 0;
  const shipping = values.shippingEnabled ? values.shippingAmount : 0;
  const amount = Math.max(0, subtotal - discount + shipping);
  const balanceDue = Math.max(0, amount - (values.depositEnabled ? values.depositAmount : 0));
  return { amount, balanceDue };
}

function isStoreBackedTransaction(id: string) {
  return !id.includes("-pad-");
}

/** Closed invoices/payments open Receive Payment; open invoices open the invoice editor. */
function shouldOpenReceivePayment(txn: SalesTransaction) {
  if (txn.type === "Payment") return true;
  if (txn.status.kind === "closed" && txn.type === "Invoice") return true;
  return false;
}

function statusFromTerms(terms: string): MockSalesTransaction["status"] {
  const lower = terms.toLowerCase();
  if (lower.includes("paid") || lower.includes("closed")) {
    return { kind: "closed" };
  }
  if (lower.includes("unapplied")) {
    return { kind: "unapplied" };
  }
  return { kind: "overdue", detail: terms || "Due on receipt" };
}

export function SalesTransactions() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  useInvoicesBootstrap();
  const arAgingDetailSnapshot = useImportedArAgingDetailSnapshot();
  const arAgingDetailLines = arAgingDetailSnapshot?.lines ?? [];
  const arAgingAsOf = arAgingDetailSnapshot?.asOf;
  const { customers, invoices: openInvoices } = useMockReceivables();
  const storeTransactions = useMockSales();
  const openBalances = useMemo(
    () => salesTransactionOpenBalances(storeTransactions),
    [storeTransactions],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<SalesTypeFilter>("All transactions");
  const defaultDateRange = useMemo(() => defaultSalesTransactionCustomDateRange(), []);
  const [dateFilter, setDateFilter] = useState<SalesTransactionDateFilter>("Last 3 months");
  const [customDateFrom, setCustomDateFrom] = useState(defaultDateRange.from);
  const [customDateTo, setCustomDateTo] = useState(defaultDateRange.to);
  const [customerSearch, setCustomerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SalesStatusFilter>("All");
  const [deliveryFilter, setDeliveryFilter] = useState<SalesDeliveryFilter>("Any");
  const [errorFilter, setErrorFilter] = useState<SalesErrorFilter>("None");
  const [kpiFilter, setKpiFilter] = useState<SalesTransactionKpiId | null>(null);
  const dateRange = useMemo(
    () => salesTransactionDateRange(dateFilter, undefined, customDateFrom, customDateTo),
    [dateFilter, customDateFrom, customDateTo],
  );

  function handleDateFilterApply(filter: SalesTransactionDateFilter, from: Date, to: Date) {
    setDateFilter(filter);
    setCustomDateFrom(from);
    setCustomDateTo(to);
    setPage(1);
  }
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
  const [page, setPage] = useState(1);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceDialogMode, setInvoiceDialogMode] = useState<
    "create" | "edit" | "view"
  >("create");
  const [invoicePrefill, setInvoicePrefill] = useState<InvoiceFormValues | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<SalesTransaction | null>(null);
  const [draftInvoiceNumber, setDraftInvoiceNumber] = useState(() => getNextInvoiceNumber());
  const [receivePaymentOpen, setReceivePaymentOpen] = useState(false);
  const [receivePaymentPrefill, setReceivePaymentPrefill] =
    useState<ReceivePaymentFormValues | null>(null);
  const [receivePaymentCanSave, setReceivePaymentCanSave] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SalesTransaction | null>(null);
  const [receivePaymentInvoiceId, setReceivePaymentInvoiceId] = useState<string | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState<MockSalesTransaction["type"]>("Sales receipt");
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({ memo: true });

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

  useEffect(() => {
    if (searchParams.get(BANK_DEPOSIT_SEARCH_PARAM) !== "1") return;
    setReceivePaymentPrefill(null);
    setEditingPayment(null);
    setReceivePaymentCanSave(true);
    setReceivePaymentOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete(BANK_DEPOSIT_SEARCH_PARAM);
    const q = params.toString();
    router.replace(q ? `${SALES_TRANSACTIONS_PATH}?${q}` : SALES_TRANSACTIONS_PATH, {
      scroll: false,
    });
  }, [searchParams, router]);

  function closeInvoiceDialog() {
    setInvoiceDialogOpen(false);
    setInvoicePrefill(null);
    setEditingTransaction(null);
    setInvoiceDialogMode("create");
  }

  function openInvoiceCreate() {
    setInvoiceDialogMode("create");
    setInvoicePrefill(null);
    setEditingTransaction(null);
    setDraftInvoiceNumber(getNextInvoiceNumber());
    setInvoiceDialogOpen(true);
  }

  function closeReceivePaymentDialog() {
    setReceivePaymentOpen(false);
    setReceivePaymentPrefill(null);
    setEditingPayment(null);
    setReceivePaymentInvoiceId(null);
    setReceivePaymentCanSave(false);
  }

  function openReceivePaymentCreate() {
    setReceivePaymentPrefill(null);
    setEditingPayment(null);
    setReceivePaymentInvoiceId(null);
    setReceivePaymentCanSave(true);
    setReceivePaymentOpen(true);
  }

  function openReceivePaymentForInvoice(txn: SalesTransaction) {
    if (isVoidTransaction(txn)) {
      toast({
        title: "Transaction voided",
        description: "Voided transactions cannot receive payment.",
        variant: "destructive",
      });
      return;
    }
    const customer = customers.find((c) => c.name === txn.customer);
    const invNum = txn.number.replace(/^INV-/i, "").trim();
    const matchedInvoice =
      openInvoices.find(
        (inv) =>
          inv.customerId === customer?.id &&
          (inv.number === invNum || formatInvoiceNumber(inv.number) === txn.number) &&
          inv.balanceDue > 0,
      ) ?? openInvoices.find((inv) => inv.customerId === customer?.id && inv.balanceDue > 0);

    setReceivePaymentPrefill(
      buildReceivePaymentPrefillFromTransaction(txn, receivePaymentCustomers, openInvoices),
    );
    setEditingPayment(null);
    setReceivePaymentInvoiceId(matchedInvoice?.id ?? null);
    setReceivePaymentCanSave(true);
    setReceivePaymentOpen(true);
  }

  function applyKpiFilter(filter: SalesTransactionKpiId | null) {
    setKpiFilter(filter);
    setPage(1);
    if (!filter) return;

    if (filter === "open") {
      setTypeFilter("Invoices");
      setStatusFilter("All");
      return;
    }

    const typeMatch = KPI_TYPE_FILTER[filter];
    if (typeMatch) setTypeFilter(typeMatch);
    const statusMatch = KPI_STATUS_FILTER[filter];
    if (statusMatch) setStatusFilter(statusMatch);
    if (filter === "paid") setStatusFilter("All");
  }

  function handleExportRows(rows: SalesTransaction[]) {
    if (rows.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Select transactions or adjust filters first.",
        variant: "destructive",
      });
      return;
    }
    exportSalesTransactionsCsv(rows, openBalances);
    toast({
      title: "Export started",
      description: `Downloaded ${rows.length} transaction${rows.length === 1 ? "" : "s"} as CSV.`,
    });
  }

  function handlePrint() {
    window.print();
    toast({ title: "Print", description: "Opening print dialog…" });
  }

  function voidTransaction(txn: SalesTransaction) {
    if (isVoidTransaction(txn)) {
      toast({ title: "Already voided", description: `${txn.number} is already voided.` });
      return;
    }
    const ok = updateSalesTransaction(txn.id, {
      qbStatus: "void",
      status: { kind: "closed" },
      memo: txn.memo.trim() ? `${txn.memo.trim()} — Voided` : "Voided",
    });
    if (!ok) {
      toast({
        title: "Could not void",
        description: "Transaction was not found.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Voided", description: `${txn.type} ${txn.number} was voided.` });
  }

  function deleteTransactions(ids: string[]) {
    if (ids.length === 0) return;
    deleteSalesTransactions(ids);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    toast({
      title: "Deleted",
      description: `${ids.length} transaction${ids.length === 1 ? "" : "s"} removed.`,
    });
  }

  function duplicateTransaction(txn: SalesTransaction) {
    addSalesTransaction({
      date: txn.date,
      type: txn.type,
      number: txn.number ? `${txn.number}-COPY` : nextNumberForType(txn.type),
      customer: txn.customer,
      memo: txn.memo,
      amount: txn.amount,
      status: defaultStatusForType(txn.type),
      qbStatus: defaultQbStatusForType(txn.type),
    });
    setPage(1);
    toast({
      title: "Duplicated",
      description: `Copy of ${txn.type} ${txn.number} created.`,
    });
  }

  function recordAsPaid(txn: SalesTransaction) {
    if (txn.type !== "Invoice") return;
    if (isVoidTransaction(txn)) {
      toast({
        title: "Transaction voided",
        description: "Voided invoices cannot be marked paid.",
        variant: "destructive",
      });
      return;
    }
    const ok = updateSalesTransaction(txn.id, {
      qbStatus: "paid",
      status: { kind: "closed" },
    });
    if (!ok) {
      toast({
        title: "Could not update",
        description: "Invoice was not found.",
        variant: "destructive",
      });
      return;
    }

    const customer = customers.find((c) => c.name === txn.customer);
    const invNum = txn.number.replace(/^INV-/i, "").trim();
    const matchedInvoice = openInvoices.find(
      (inv) =>
        inv.customerId === customer?.id &&
        (inv.number === invNum || formatInvoiceNumber(inv.number) === txn.number),
    );
    if (matchedInvoice) {
      updateInvoice(matchedInvoice.id, { balanceDue: 0, kind: "paid" });
    }

    toast({
      title: "Marked as paid",
      description: `Invoice ${txn.number} — ${formatPHP(txn.amount)}`,
    });
  }

  function openQuickCreate(type: MockSalesTransaction["type"]) {
    setQuickCreateType(type);
    setQuickCreateOpen(true);
  }

  function handleQuickCreateSave(values: SalesTransactionEditValues) {
    addSalesTransaction({
      date: values.date,
      type: values.type,
      number: values.number.trim() || nextNumberForType(values.type),
      customer: values.customer,
      memo: values.memo.trim().slice(0, 120),
      amount: values.amount,
      status: defaultStatusForType(values.type),
      qbStatus: defaultQbStatusForType(values.type),
    });
    setQuickCreateOpen(false);
    setPage(1);
    toast({
      title: `${values.type} created`,
      description: `${values.customer} — ${formatPHP(values.amount)}`,
    });
  }

  function openTransactionViewEdit(txn: SalesTransaction, forView = false) {
    const storeBacked = isStoreBackedTransaction(txn.id);

    if (shouldOpenReceivePayment(txn)) {
      setReceivePaymentPrefill(
        buildReceivePaymentPrefillFromTransaction(
          txn,
          receivePaymentCustomers,
          openInvoices,
        ),
      );
      setEditingPayment(txn.type === "Payment" && storeBacked ? txn : null);
      setReceivePaymentCanSave(!forView && storeBacked && txn.type === "Payment");
      setReceivePaymentOpen(true);
      return;
    }

    const prefill = buildInvoicePrefillFromTransaction(txn, customerOptions);
    setInvoiceDialogMode(forView ? "view" : "edit");
    setEditingTransaction(storeBacked ? txn : null);
    setInvoicePrefill(prefill);
    setDraftInvoiceNumber(prefill.number);
    setInvoiceDialogOpen(true);
  }

  function handleSaveReceivePayment(values: ReceivePaymentFormValues) {
    const customer = receivePaymentCustomers.find((c) => c.id === values.customerId);
    const displayNumber = values.referenceNo.trim()
      ? /^PMT-/i.test(values.referenceNo)
        ? values.referenceNo
        : `PMT-${values.referenceNo}`
      : editingPayment?.number ?? getNextPaymentNumber();

    if (editingPayment) {
      const ok = updateSalesTransaction(editingPayment.id, {
        date: values.paymentDate,
        type: "Payment",
        number: displayNumber,
        customer: customer?.name ?? editingPayment.customer,
        memo: values.memo.trim().slice(0, 120),
        amount: values.amountReceived,
        status:
          values.amountReceived > 0 ? { kind: "closed" } : { kind: "unapplied" },
        qbStatus: values.amountReceived > 0 ? "applied" : "unapplied",
        depositToAccountId: values.depositToId || undefined,
      });
      if (!ok) {
        toast({
          title: "Could not save",
          description: "Payment was not found in the ledger.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Payment updated",
        description: `${displayNumber} — ${formatPHP(values.amountReceived)}`,
      });
      closeReceivePaymentDialog();
      return;
    }

    const selectedLine = values.lines.find((line) => line.selected && line.payment > 0);
    const invoiceId = receivePaymentInvoiceId ?? selectedLine?.id ?? null;
    const linkedInvoice = invoiceId ? getInvoiceById(invoiceId) : undefined;

    if (linkedInvoice) {
      const paymentAmount =
        selectedLine?.payment && selectedLine.payment > 0
          ? selectedLine.payment
          : values.amountReceived;
      const ok = recordReceivePaymentAgainstInvoice({
        invoiceId: linkedInvoice.id,
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
      setPage(1);
      toast({
        title: "Payment recorded",
        description: `${displayNumber} — ${formatPHP(paymentAmount)}`,
      });
      closeReceivePaymentDialog();
      return;
    }

    addSalesTransaction({
      date: values.paymentDate,
      type: "Payment",
      number: displayNumber,
      customer: customer?.name ?? "Unknown customer",
      memo: values.memo.trim().slice(0, 120),
      amount: values.amountReceived,
      status: values.amountReceived > 0 ? { kind: "unapplied" } : { kind: "unapplied" },
      qbStatus: "unapplied",
      ...(values.depositToId ? { depositToAccountId: values.depositToId } : {}),
    });
    setPage(1);
    toast({
      title: "Payment recorded",
      description: `${displayNumber} — ${formatPHP(values.amountReceived)}`,
    });
    closeReceivePaymentDialog();
  }

  async function handleCreateInvoice(values: InvoiceFormValues) {
    const { amount, balanceDue } = invoiceAmounts(values);
    const customer = customerOptions.find((c) => c.id === values.customerId);
    const customerName = customer?.name ?? "Unknown customer";

    await recordInvoiceCreation({
      customerId: values.customerId,
      customerName,
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
      description: `${values.number} for ${customerName} — ${formatPHP(balanceDue)}`,
    });
    setDraftInvoiceNumber(getNextInvoiceNumber());
  }

  function handleUpdateInvoice(values: InvoiceFormValues) {
    if (!editingTransaction) {
      toast({
        title: "Cannot save",
        description: "This sample row is read-only.",
        variant: "destructive",
      });
      return;
    }
    const { amount } = invoiceAmounts(values);
    const customer = customerOptions.find((c) => c.id === values.customerId);
    const isInvoice = editingTransaction.type === "Invoice";
    const displayNumber = isInvoice
      ? formatInvoiceNumber(values.number)
      : values.number.trim() || editingTransaction.number;

    const ok = updateSalesTransaction(editingTransaction.id, {
      date: values.invoiceDate,
      type: editingTransaction.type,
      number: displayNumber,
      customer: customer?.name ?? editingTransaction.customer,
      memo: values.noteToCustomer.trim().slice(0, 120),
      amount,
      status: statusFromTerms(values.terms),
      qbStatus: values.terms.toLowerCase().includes("paid")
        ? "paid"
        : values.terms.toLowerCase().includes("closed")
          ? "closed"
          : editingTransaction.qbStatus ?? "open",
    });
    if (!ok) {
      toast({
        title: "Could not save",
        description: "Transaction was not found in the ledger.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Transaction updated",
      description: `${displayNumber} — ${formatPHP(amount)}`,
    });
    closeInvoiceDialog();
  }

  async function handleInvoiceSave(values: InvoiceFormValues): Promise<boolean> {
    if (invoiceDialogMode === "edit") {
      handleUpdateInvoice(values);
      return true;
    }
    try {
      await handleCreateInvoice(values);
      closeInvoiceDialog();
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

  const filtered = useMemo(() => {
    return storeTransactions.filter((t) => {
      if (!salesTransactionMatchesTypeFilter(t, typeFilter)) return false;
      if (!transactionInDateRange(t, dateRange)) return false;
      if (
        kpiFilter &&
        !salesTransactionMatchesKpiFilter(
          t,
          kpiFilter,
          storeTransactions,
          arAgingDetailLines,
          undefined,
          arAgingAsOf,
        )
      ) {
        return false;
      }
      if (!salesTransactionMatchesStatusFilter(t, statusFilter)) return false;
      if (!salesTransactionMatchesDeliveryFilter(t, deliveryFilter)) return false;
      if (!salesTransactionMatchesErrorFilter(t, errorFilter)) return false;
      if (
        customerSearch.trim() &&
        !t.customer.toLowerCase().includes(customerSearch.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [
    storeTransactions,
    typeFilter,
    dateRange,
    kpiFilter,
    statusFilter,
    deliveryFilter,
    errorFilter,
    customerSearch,
    arAgingDetailLines,
    arAgingAsOf,
  ]);

  const kpiScopeTransactions = useMemo(() => {
    return storeTransactions.filter((t) => {
      if (!salesTransactionMatchesTypeFilter(t, typeFilter)) return false;
      if (
        customerSearch.trim() &&
        !t.customer.toLowerCase().includes(customerSearch.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [storeTransactions, typeFilter, customerSearch]);

  const listScopeTransactions = useMemo(() => {
    return kpiScopeTransactions.filter((t) => transactionInDateRange(t, dateRange));
  }, [kpiScopeTransactions, dateRange]);

  const totalListAmount = useMemo(
    () => filtered.reduce((sum, t) => sum + salesTransactionListSignedAmount(t), 0),
    [filtered],
  );

  const displayTotal = filtered.length;
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedCount = selected.size;
  const selectedRows = useMemo(
    () => filtered.filter((transaction) => selected.has(transaction.id)),
    [filtered, selected],
  );
  const tableColSpan = 8 + (visibleColumns.memo ? 1 : 0);
  const rangeStart = displayTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, displayTotal);
  const totalPages = Math.max(1, Math.ceil(displayTotal / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p));
  }, [totalPages]);

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((t) => selected.has(t.id));

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageItems.forEach((t) => next.delete(t.id));
      else pageItems.forEach((t) => next.add(t.id));
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sales Transactions</h1>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground shrink-0">
          <MessageSquare className="h-4 w-4" />
          Give feedback
        </Button>
      </div>

      <SummaryBar
        kpiFilter={kpiFilter}
        allTransactions={storeTransactions}
        listScopeTransactions={listScopeTransactions}
        arScopeTransactions={kpiScopeTransactions}
        customerQuery={customerSearch}
        arAgingDetailLines={arAgingDetailLines}
        arAgingAsOf={arAgingAsOf}
        onKpiFilterChange={applyKpiFilter}
      />

      <p className="text-xs text-muted-foreground -mt-2">
        Estimates and unbilled income follow your Type, Date, and Customer filters. Overdue and open
        invoice totals use payment-adjusted balances from the last 365 days (Type and Customer
        only). Recently paid uses payments from the last 30 days.
      </p>

      {kpiFilter ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Showing <span className="font-medium text-foreground">{KPI_FILTER_LABELS[kpiFilter]}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => {
              setKpiFilter(null);
              setPage(1);
            }}
          >
            Clear filter
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">Type</span>
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v as SalesTypeFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[240px] bg-background shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SALES_TYPE_FILTER_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SalesTransactionDateFilterControl
          value={dateFilter}
          customFrom={customDateFrom}
          customTo={customDateTo}
          onApply={handleDateFilterApply}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">Customer</span>
          <div className="flex h-9 w-[220px] items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search"
                className="h-9 rounded-none border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-9 shrink-0 items-center justify-center border-l border-input hover:bg-muted/50"
                  aria-label="Choose customer"
                >
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => {
                    setCustomerSearch("");
                    setPage(1);
                  }}
                >
                  All customers
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {customerOptions.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => {
                      setCustomerSearch(c.name);
                      setPage(1);
                    }}
                  >
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  {selectedCount > 0 ? `Batch actions (${selectedCount})` : "Batch actions"}
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  disabled={selectedCount === 0}
                  onClick={() => handlePrint()}
                >
                  Print
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selectedCount === 0}
                  onClick={() => handleExportRows(selectedRows)}
                >
                  Export
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={selectedCount === 0}
                  onClick={() => {
                    selectedRows.forEach(voidTransaction);
                  }}
                >
                  Void
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selectedCount === 0}
                  onClick={() => deleteTransactions(selectedRows.map((row) => row.id))}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="link"
                  size="sm"
                  className={cn(
                    "h-9 px-2",
                    statusFilter !== "All" ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {salesStatusFilterLabel(statusFilter)}
                  <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as SalesStatusFilter);
                    setPage(1);
                  }}
                >
                  {SALES_STATUS_FILTER_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option}>
                      {option}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="link"
                  size="sm"
                  className={cn(
                    "h-9 px-2",
                    deliveryFilter !== "Any" ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {salesDeliveryFilterLabel(deliveryFilter)}
                  <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup
                  value={deliveryFilter}
                  onValueChange={(value) => {
                    setDeliveryFilter(value as SalesDeliveryFilter);
                    setPage(1);
                  }}
                >
                  {SALES_DELIVERY_FILTER_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option}>
                      {option}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="link"
                  size="sm"
                  className={cn(
                    "h-9 px-2",
                    errorFilter !== "None" ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {salesErrorFilterLabel(errorFilter)}
                  <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup
                  value={errorFilter}
                  onValueChange={(value) => {
                    setErrorFilter(value as SalesErrorFilter);
                    setPage(1);
                  }}
                >
                  {SALES_ERROR_FILTER_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option}>
                      {option}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 mr-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Print"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Export"
                onClick={() => handleExportRows(filtered)}
              >
                <Download className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Settings">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.memo}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((columns) => ({ ...columns, memo: !!checked }))
                    }
                  >
                    Memo
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5 shadow-sm">
                  <Plus className="h-4 w-4" />
                  New transaction
                  <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openInvoiceCreate}>Invoice</DropdownMenuItem>
                <DropdownMenuItem onClick={openReceivePaymentCreate}>Receive payment</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openQuickCreate("Sales receipt")}>
                  Sales receipt
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openQuickCreate("Estimate")}>Estimate</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openQuickCreate("Credit Note")}>
                  Credit memo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    toast({
                      title: "Customer statement",
                      description: "Open a customer record to create a statement.",
                    })
                  }
                >
                  Statement
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  No.
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[160px]">
                  Customer
                </th>
                {visibleColumns.memo && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[120px]">
                    Memo
                  </th>
                )}
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[160px]">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[200px]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-4 py-16 text-center text-muted-foreground">
                    No sales transactions match your filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((txn, index) => {
                  const isSelected = selected.has(txn.id);
                  const stripe = index % 2 === 0 ? "bg-background" : "bg-muted/15";
                  const isInvoice = txn.type === "Invoice";
                  const voided = isVoidTransaction(txn);

                  return (
                    <tr
                      key={txn.id}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-muted/30",
                        stripe,
                        isSelected && "bg-primary/5",
                      )}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(txn.id)}
                          aria-label={`Select ${txn.customer}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {txn.date}
                      </td>
                      <td className="px-4 py-3">{txn.type}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {txn.number}
                      </td>
                      <td className="px-4 py-3 font-medium">{txn.customer}</td>
                      {visibleColumns.memo && (
                        <td className="px-4 py-3 text-muted-foreground">
                          {txn.memo || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatPHP(txn.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusCell txn={txn} openBalances={openBalances} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-primary font-medium gap-0.5"
                              >
                                View/Edit
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openTransactionViewEdit(txn, true)}>
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={voided}
                                onClick={() => openTransactionViewEdit(txn, false)}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateTransaction(txn)}>
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={voided}
                                onClick={() => voidTransaction(txn)}
                              >
                                Void
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteTransactions([txn.id])}>
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {isInvoice && (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 text-primary font-medium gap-0.5"
                                  >
                                    Receive payment
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    disabled={voided}
                                    onClick={() => openReceivePaymentForInvoice(txn)}
                                  >
                                    Receive payment
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={voided || txn.qbStatus?.toLowerCase() === "paid"}
                                    onClick={() => recordAsPaid(txn)}
                                  >
                                    Record as paid
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              <tr className="border-t-2 bg-muted/30">
                <td colSpan={visibleColumns.memo ? 6 : 5} className="px-4 py-3 font-semibold text-muted-foreground">
                  Total (PHP)
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  {formatPHP(totalListAmount)}
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      <InvoiceFormDialog
        open={invoiceDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeInvoiceDialog();
          else setInvoiceDialogOpen(true);
        }}
        invoiceNumber={draftInvoiceNumber}
        customers={customerOptions}
        mode={invoiceDialogMode}
        prefill={invoicePrefill}
        onSave={handleInvoiceSave}
        onSaveAndNew={
          invoiceDialogMode === "create"
            ? () => {
                const next = getNextInvoiceNumber();
                setDraftInvoiceNumber(next);
                return next;
              }
            : undefined
        }
      />

      <ReceivePaymentFormDialog
        open={receivePaymentOpen}
        onOpenChange={(open) => {
          if (!open) closeReceivePaymentDialog();
          else setReceivePaymentOpen(true);
        }}
        customers={receivePaymentCustomers}
        prefill={receivePaymentPrefill}
        canSave={receivePaymentCanSave}
        onSave={handleSaveReceivePayment}
      />

      <SalesTransactionEditDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        transaction={null}
        mode="create"
        createType={quickCreateType}
        customerNames={customerOptions.map((customer) => customer.name)}
        onSave={handleQuickCreateSave}
      />

    </div>
  );
}
