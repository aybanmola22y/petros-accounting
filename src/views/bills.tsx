"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  MessageSquare,
  Plus,
  Printer,
  SearchX,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExpenseFormDialog,
  type ExpenseFormValues,
} from "@/components/expense-form-dialog";
import { PayBillsDialog } from "@/components/pay-bills-dialog";
import { BillDateFilter as BillDateFilterControl } from "@/components/bill-date-filter";
import { buildExpensePrefillFromBill } from "@/lib/expense-form-prefill";
import { recordExpenseCreation } from "@/lib/expense-transactions/record-expense";
import {
  billListDateRange,
  defaultBillDateRange,
  filterPaidBills,
  filterUnpaidBills,
  filterPaymentAccounts,
  formatBillDateRangeLabel,
  getActiveChartAccountsSorted,
  getChartAccountsSnapshot,
  getNextExpenseNumber,
  getPaidBillsSnapshot,
  getUnpaidBillsSnapshot,
  payUnpaidBills,
  PAYABLES_REFERENCE_DATE,
  subscribeMockStore,
} from "@/lib/mock-data";
import type { BillDateFilter, PaidBill } from "@/lib/mock-data/paid-bills";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";
import { formatPHP } from "@/views/financial-report-shared";
import { useUnpaidBills } from "@/hooks/use-unpaid-bills";
import { useMockExpenses } from "@/hooks/use-mock-expenses";
import {
  mergePaidBillsForSuppliers,
  paidBillsFromExpenseTransactions,
} from "@/lib/ledger/compute-supplier-dashboard";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type BillTab = "review" | "unpaid" | "paid" | "recurring";

const BILLS_PATH = "/expenses/bills";
const BILL_TAB_SEARCH_PARAM = "tab";
const PAY_BILLS_SEARCH_PARAM = "payBills";
const SUPPLIER_SEARCH_PARAM = "supplier";

function isBillTab(value: string | null): value is BillTab {
  return value === "review" || value === "unpaid" || value === "paid" || value === "recurring";
}

const TABS: { id: BillTab; label: string; badge?: string }[] = [
  { id: "review", label: "For review" },
  { id: "unpaid", label: "Unpaid" },
  { id: "paid", label: "Paid" },
  { id: "recurring", label: "Recurring", badge: "New" },
];

const PAGE_SIZE = 50;

const EMPTY_UNPAID_BILLS: UnpaidBill[] = [];
const EMPTY_PAID_BILLS: PaidBill[] = [];

function StatusCell({ bill }: { bill: UnpaidBill }) {
  const isOverdue = bill.statusType === "overdue";
  return (
    <div className="flex items-start gap-2">
      {isOverdue ? (
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
      ) : (
        <Clock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
      )}
      <div>
        <p className={cn("text-sm font-medium", isOverdue ? "text-amber-700" : "text-muted-foreground")}>
          {isOverdue ? "Overdue" : "Due later"}
        </p>
        <p className="text-xs text-muted-foreground">{bill.statusDetail}</p>
      </div>
    </div>
  );
}

function EmptyReview() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
        <ClipboardList className="h-8 w-8" />
      </div>
      <p className="text-lg font-semibold">No bills to review</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        When you have bills ready to review, you&apos;ll find them here. To upload a bill or
        create a new one, go to Add bill.
      </p>
    </div>
  );
}

function EmptyPaid() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-primary mb-4">
        <SearchX className="h-8 w-8" />
      </div>
      <p className="text-lg font-semibold">No results found</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Remove some filters or try a different search.
      </p>
    </div>
  );
}

function normalizeSupplierFilter(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || "All";
}

function uniqueSupplierNames(
  ...sources: ReadonlyArray<{ supplier: string }>[]
): string[] {
  const names = new Set<string>();
  for (const bills of sources) {
    for (const bill of bills) {
      const name = bill.supplier.trim();
      if (name) names.add(name);
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function EmptyRecurring() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <p className="text-lg font-semibold">No recurring bills yet</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Set up recurring bills to automate entries for rent, subscriptions, and other regular
        payables.
      </p>
      <Button className="mt-6 gap-2">
        <Plus className="h-4 w-4" />
        Create recurring bill
      </Button>
    </div>
  );
}

export function Bills() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  useUnpaidBills();
  const expenses = useMockExpenses();
  const chartAccounts = useSyncExternalStore(
    subscribeMockStore,
    getChartAccountsSnapshot,
    getChartAccountsSnapshot,
  );
  const unpaidBills = useSyncExternalStore(
    subscribeMockStore,
    getUnpaidBillsSnapshot,
    () => EMPTY_UNPAID_BILLS,
  );
  const storePaidBills = useSyncExternalStore(
    subscribeMockStore,
    getPaidBillsSnapshot,
    () => EMPTY_PAID_BILLS,
  );
  const paidBills = useMemo(
    () => mergePaidBillsForSuppliers(storePaidBills, paidBillsFromExpenseTransactions(expenses)),
    [storePaidBills, expenses],
  );
  const defaultPaymentAccountId = useMemo(() => {
    const accounts = filterPaymentAccounts(getActiveChartAccountsSorted(chartAccounts));
    return accounts[0]?.id ?? "";
  }, [chartAccounts]);
  const [activeTab, setActiveTab] = useState<BillTab>(() => {
    const tab = searchParams.get(BILL_TAB_SEARCH_PARAM);
    return isBillTab(tab) ? tab : "review";
  });
  const [supplierFilter, setSupplierFilter] = useState(() =>
    normalizeSupplierFilter(searchParams.get(SUPPLIER_SEARCH_PARAM)),
  );
  const [billDateFilter, setBillDateFilter] = useState<BillDateFilter>("Last 12 months");
  const defaultBillRange = useMemo(() => defaultBillDateRange("Last 12 months"), []);
  const [customBillDateFrom, setCustomBillDateFrom] = useState(defaultBillRange.from);
  const [customBillDateTo, setCustomBillDateTo] = useState(defaultBillRange.to);
  const [showDateChip, setShowDateChip] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [payBillsOpen, setPayBillsOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expensePrefill, setExpensePrefill] = useState<ExpenseFormValues | null>(null);
  const [draftExpenseNumber, setDraftExpenseNumber] = useState(() => getNextExpenseNumber());

  useEffect(() => {
    const tab = searchParams.get(BILL_TAB_SEARCH_PARAM);
    if (isBillTab(tab)) {
      setActiveTab(tab);
      setPage(1);
      setSelected(new Set());
    }
    const supplier = searchParams.get(SUPPLIER_SEARCH_PARAM);
    if (supplier !== null) setSupplierFilter(normalizeSupplierFilter(supplier));
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get(PAY_BILLS_SEARCH_PARAM) === "1") {
      setPayBillsOpen(true);
      setActiveTab("unpaid");
      const params = new URLSearchParams(searchParams.toString());
      params.delete(PAY_BILLS_SEARCH_PARAM);
      const q = params.toString();
      router.replace(q ? `${BILLS_PATH}?${q}` : BILLS_PATH, { scroll: false });
    }
  }, [searchParams, router]);

  function openExpenseForBill(bill: UnpaidBill) {
    const expenseNumber = getNextExpenseNumber();
    setDraftExpenseNumber(expenseNumber);
    setExpensePrefill(
      buildExpensePrefillFromBill(bill, expenseNumber, defaultPaymentAccountId),
    );
    setExpenseOpen(true);
  }

  function handleExpenseOpenChange(open: boolean) {
    setExpenseOpen(open);
    if (!open) setExpensePrefill(null);
  }

  async function handleSaveExpense(values: ExpenseFormValues) {
    const activeCategoryLines = values.lines.filter((l) => Number(l.amount) > 0);
    const activeItemLines = values.itemLines.filter(
      (l) => (Number(l.qty) || 0) * (Number(l.rate) || 0) > 0,
    );
    const categoryTotal = activeCategoryLines.reduce(
      (sum, l) => sum + Number(l.amount),
      0,
    );
    const itemTotal = activeItemLines.reduce(
      (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.rate) || 0),
      0,
    );
    const total = categoryTotal + itemTotal;
    const row = {
      date: values.paymentDate,
      type: "Expense" as const,
      number: values.refNo.trim() || draftExpenseNumber,
      payee: values.payee.trim(),
      status: "paid" as const,
      category:
        activeCategoryLines.length === 1
          ? activeCategoryLines[0]!.category
          : activeCategoryLines.length > 1
            ? "--Split--"
            : "Office Supplies",
      ...(activeCategoryLines.length > 1 || activeItemLines.length > 0
        ? { isSplit: true }
        : {}),
      totalBeforeTax: total,
      salesTax: 0,
      total,
      paymentAccountId: values.paymentAccountId,
    };
    try {
      await recordExpenseCreation(row);
      toast({
        title: "Expense created",
        description: `${values.payee} — ${formatPHP(total)}`,
      });
      setDraftExpenseNumber(getNextExpenseNumber());
      handleExpenseOpenChange(false);
    } catch (error) {
      toast({
        title: "Could not save expense",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  function selectTab(tab: BillTab) {
    setActiveTab(tab);
    setPage(1);
    setSelected(new Set());
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "review") params.delete(BILL_TAB_SEARCH_PARAM);
    else params.set(BILL_TAB_SEARCH_PARAM, tab);
    const q = params.toString();
    router.replace(q ? `${BILLS_PATH}?${q}` : BILLS_PATH, { scroll: false });
  }

  const billDateRange = useMemo(
    () =>
      billListDateRange(billDateFilter, {
        customFrom: customBillDateFrom,
        customTo: customBillDateTo,
      }),
    [billDateFilter, customBillDateFrom, customBillDateTo],
  );

  function applyBillDateFilter(filter: BillDateFilter, from: Date, to: Date) {
    setBillDateFilter(filter);
    setCustomBillDateFrom(from);
    setCustomBillDateTo(to);
    setShowDateChip(true);
    setPage(1);
  }

  const unpaidFiltered = useMemo(
    () =>
      filterUnpaidBills(unpaidBills, {
        supplier: supplierFilter,
        dateRange: billDateRange,
      }),
    [unpaidBills, supplierFilter, billDateRange],
  );

  const paidFiltered = useMemo(
    () =>
      filterPaidBills(paidBills, {
        supplier: supplierFilter,
        dateRange: billDateRange,
        dateField: "paidDate",
      }),
    [paidBills, supplierFilter, billDateRange],
  );

  const totals = useMemo(
    () => ({
      billAmount: unpaidFiltered.reduce((s, b) => s + b.billAmount, 0),
      openBalance: unpaidFiltered.reduce((s, b) => s + b.openBalance, 0),
      paidAmount: paidFiltered.reduce((s, b) => s + b.paidAmount, 0),
    }),
    [unpaidFiltered, paidFiltered],
  );

  const unpaidPageItems = unpaidFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paidPageItems = paidFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const unpaidTotalPages = Math.max(1, Math.ceil(unpaidFiltered.length / PAGE_SIZE));
  const paidTotalPages = Math.max(1, Math.ceil(paidFiltered.length / PAGE_SIZE));
  const unpaidRangeStart =
    unpaidFiltered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const unpaidRangeEnd = Math.min(page * PAGE_SIZE, unpaidFiltered.length);
  const paidRangeStart = paidFiltered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const paidRangeEnd = Math.min(page * PAGE_SIZE, paidFiltered.length);

  const allPageSelected =
    unpaidPageItems.length > 0 && unpaidPageItems.every((b) => selected.has(b.id));

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) unpaidPageItems.forEach((b) => next.delete(b.id));
      else unpaidPageItems.forEach((b) => next.add(b.id));
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

  function markBillAsPaid(bill: UnpaidBill) {
    const today = PAYABLES_REFERENCE_DATE;
    const paidDate = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;
    payUnpaidBills([
      {
        billId: bill.id,
        paidAmount: bill.openBalance,
        paidDate,
      },
    ]);
    toast({
      title: "Bill marked as paid",
      description: `${bill.supplier} — ${formatPHP(bill.openBalance)}`,
    });
  }

  const supplierOptions = useMemo(
    () => uniqueSupplierNames(unpaidBills, paidBills),
    [unpaidBills, paidBills],
  );

  const showListFilters = activeTab === "unpaid" || activeTab === "paid";

  return (
    <div className="space-y-6">
      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={handleExpenseOpenChange}
        expenseNumber={draftExpenseNumber}
        prefill={expensePrefill}
        onSave={handleSaveExpense}
        onSaveAndNew={() => {
          const next = getNextExpenseNumber();
          setDraftExpenseNumber(next);
          return next;
        }}
      />

      <PayBillsDialog
        open={payBillsOpen}
        onOpenChange={setPayBillsOpen}
        onSelectPayee={openExpenseForBill}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Expenses & Bills
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            Give feedback
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                Pay bills
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPayBillsOpen(true)}>
                Pay bills
              </DropdownMenuItem>
              <DropdownMenuItem>Pay selected bills</DropdownMenuItem>
              <DropdownMenuItem>Schedule payment</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                Add bill
                <ChevronDown className="h-3.5 w-3.5 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Upload bill</DropdownMenuItem>
              <DropdownMenuItem>Create bill manually</DropdownMenuItem>
              <DropdownMenuItem>Create recurring bill</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b bg-muted/20 p-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.badge && (
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 text-[10px] font-semibold uppercase bg-rose-500/15 text-rose-700 border-rose-500/20"
                >
                  {tab.badge}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {activeTab === "review" ? (
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                Filter
              </Button>
              <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground">
                <Settings2 className="h-4 w-4" />
                Customize
              </Button>
            </div>
          ) : showListFilters ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground px-1">Supplier</p>
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger className="h-9 w-[200px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    {supplierOptions.map((supplier) => (
                      <SelectItem key={supplier} value={supplier}>
                        {supplier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground px-1">Bill date</p>
                <BillDateFilterControl
                  value={billDateFilter}
                  customFrom={customBillDateFrom}
                  customTo={customBillDateTo}
                  onApply={applyBillDateFilter}
                  className="w-[200px] justify-start"
                />
              </div>
              {showDateChip && (
                <Badge
                  variant="secondary"
                  className="mt-5 h-9 gap-1.5 pl-3 pr-1 font-normal rounded-md"
                >
                  Bill date:{" "}
                  {billDateRange ? formatBillDateRangeLabel(billDateRange) : "All dates"}
                  <button
                    type="button"
                    onClick={() => setShowDateChip(false)}
                    className="rounded p-0.5 hover:bg-muted"
                    aria-label="Remove date filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              )}
            </div>
          ) : (
            <div />
          )}

          {showListFilters && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Print">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Export">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground">
                <Settings2 className="h-4 w-4" />
                Customize
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {activeTab === "review" && <EmptyReview />}

        {activeTab === "recurring" && <EmptyRecurring />}

        {activeTab === "paid" && paidFiltered.length === 0 && <EmptyPaid />}

        {activeTab === "paid" && paidFiltered.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Paid date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Bill date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Bill amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Paid amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paidPageItems.map((paid, index) => {
                    const stripe = index % 2 === 0 ? "bg-background" : "bg-muted/15";
                    return (
                      <tr
                        key={paid.id}
                        className={cn(
                          "border-b border-border/50 hover:bg-muted/30 transition-colors",
                          stripe,
                        )}
                      >
                        <td className="px-4 py-3 font-medium">{paid.supplier}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {paid.paidDate}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {paid.billDate ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatPHP(paid.billAmount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {formatPHP(paid.paidAmount)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 bg-muted/25 font-semibold">
                    <td className="px-4 py-3" colSpan={4}>
                      Total
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatPHP(totals.paidAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground tabular-nums">
                {paidRangeStart} – {paidRangeEnd} of {paidFiltered.length} items
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  aria-label="First page"
                >
                  <ChevronFirst className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
                  Page
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-background px-2 font-medium text-foreground">
                    {page}
                  </span>
                  of {paidTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= paidTotalPages}
                  onClick={() => setPage((p) => Math.min(paidTotalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= paidTotalPages}
                  onClick={() => setPage(paidTotalPages)}
                  aria-label="Last page"
                >
                  <ChevronLast className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {activeTab === "unpaid" && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
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
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Due date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Bill amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Open balance
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[140px]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground w-36">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidPageItems.map((bill, index) => {
                    const isSelected = selected.has(bill.id);
                    const stripe = index % 2 === 0 ? "bg-background" : "bg-muted/15";
                    return (
                      <tr
                        key={bill.id}
                        className={cn(
                          "border-b border-border/50 hover:bg-muted/30 transition-colors",
                          stripe,
                          isSelected && "bg-primary/5",
                        )}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(bill.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline text-left"
                            onClick={() => openExpenseForBill(bill)}
                          >
                            {bill.supplier}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {bill.dueDate}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatPHP(bill.billAmount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {formatPHP(bill.openBalance)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusCell bill={bill} />
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-primary font-medium gap-0.5"
                              >
                                Mark as paid
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => markBillAsPaid(bill)}>
                                Mark as paid
                              </DropdownMenuItem>
                              <DropdownMenuItem>Schedule payment</DropdownMenuItem>
                              <DropdownMenuItem>View bill</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>Edit bill</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 bg-muted/25 font-semibold">
                    <td className="px-4 py-3" colSpan={3}>
                      Total
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatPHP(totals.billAmount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatPHP(totals.openBalance)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground tabular-nums">
                {unpaidRangeStart} – {unpaidRangeEnd} of {unpaidFiltered.length} items
                {selected.size > 0 && ` · ${selected.size} selected`}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  aria-label="First page"
                >
                  <ChevronFirst className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
                  Page
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-background px-2 font-medium text-foreground">
                    {page}
                  </span>
                  of {unpaidTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= unpaidTotalPages}
                  onClick={() => setPage((p) => Math.min(unpaidTotalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= unpaidTotalPages}
                  onClick={() => setPage(unpaidTotalPages)}
                  aria-label="Last page"
                >
                  <ChevronLast className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Pagination for empty tabs */}
        {(activeTab === "review" || (activeTab === "paid" && paidFiltered.length === 0) || activeTab === "recurring") && (
          <div className="flex items-center justify-between border-t bg-muted/15 px-4 py-3">
            <p className="text-xs text-muted-foreground">0 – 0 of 0 items</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                <ChevronFirst className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
                Page
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-background px-2">
                  1
                </span>
                of 1
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                <ChevronLast className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
