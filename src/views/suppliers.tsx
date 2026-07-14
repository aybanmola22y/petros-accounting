"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  MessageSquare,
  Plus,
  Printer,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BillFormDialog,
  ChequeFormDialog,
  ExpenseFormDialog,
  type BillFormValues,
  type ChequeFormValues,
  type ExpenseFormValues,
} from "@/components/expense-form-dialog";
import {
  ItemReceiptFormDialog,
  type ItemReceiptFormValues,
} from "@/components/item-receipt-form-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SupplierActionSplitButton } from "@/components/supplier-action-split-button";
import { useToast } from "@/hooks/use-toast";
import { formatPHP } from "@/views/financial-report-shared";
import { ImportSuppliersDialog } from "@/components/import-suppliers-dialog";
import {
  SupplierFormDialog,
  type SupplierFormValues,
} from "@/components/supplier-form-dialog";
import { SupplierProfileDialog } from "@/components/supplier-profile-dialog";
import {
  buildBillPrefillFromSupplier,
  buildExpensePrefillFromSupplier,
  buildItemReceiptPrefillFromSupplier,
} from "@/lib/expense-form-prefill";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useUnpaidBills } from "@/hooks/use-unpaid-bills";
import { useMockExpenses } from "@/hooks/use-mock-expenses";
import {
  computeSupplierDashboardSummary,
  mergePaidBillsForSuppliers,
  paidBillsFromExpenseTransactions,
} from "@/lib/ledger/compute-supplier-dashboard";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import { recordBillCreation, recordExpenseCreation } from "@/lib/expense-transactions/record-expense";
import { createSupplierViaApi, updateSupplierViaApi } from "@/lib/suppliers/api";
import {
  deleteSuppliers,
  filterPaymentAccounts,
  getActiveChartAccountsSorted,
  getChartAccountsSnapshot,
  getNextBillNumber,
  getNextExpenseNumber,
  getPaidBillsSnapshot,
  getUnpaidBillsSnapshot,
  subscribeMockStore,
  type MockSupplier,
} from "@/lib/mock-data";
import type { PaidBill } from "@/lib/mock-data/paid-bills";
import { supplierNamesWithPaidBillsLast30Days } from "@/lib/mock-data/paid-bills";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";
import {
  openBalanceBySupplierName,
  openBillCountBySupplierName,
  overdueSupplierNames,
  prepareUnpaidBillsForSupplierDashboard,
  supplierNamesWithOpenBills,
} from "@/lib/mock-data/unpaid-bills";
import { cn } from "@/lib/utils";

const EMPTY_UNPAID_BILLS: UnpaidBill[] = [];
const EMPTY_PAID_BILLS: PaidBill[] = [];

type Supplier = MockSupplier;

const PAGE_SIZE = 50;

type SortKey = "name" | "companyName" | "openBalance";
type SortDir = "asc" | "desc";

type ColumnKey = "phone" | "email";

type PayablesCardFilter = "overdue" | "open" | "paid";

const PAYABLES_FILTER_LABELS: Record<PayablesCardFilter, string> = {
  overdue: "Unpaid · overdue",
  open: "Unpaid · open bills",
  paid: "Paid (last 30 days)",
};

function exportSuppliersCsv(rows: Supplier[]) {
  const headers = ["Supplier", "Company Name", "Phone", "Email", "Currency", "Open Balance"];
  const lines = rows.map((s) =>
    [s.name, s.companyName, s.phone, s.email, s.currency, s.openBalance]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `suppliers-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function Suppliers() {
  const router = useRouter();
  const { toast } = useToast();
  const { suppliers } = useSuppliers();
  const expenses = useMockExpenses();
  useUnpaidBills();
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
  const payablesAsOf = useMemo(() => dashboardLedgerAnchor(), []);

  const dashboardUnpaidBills = useMemo(
    () => prepareUnpaidBillsForSupplierDashboard(unpaidBills, payablesAsOf),
    [unpaidBills, payablesAsOf],
  );

  const openBalanceBySupplier = useMemo(
    () => openBalanceBySupplierName(dashboardUnpaidBills),
    [dashboardUnpaidBills],
  );
  const pendingBillCountBySupplier = useMemo(
    () => openBillCountBySupplierName(dashboardUnpaidBills),
    [dashboardUnpaidBills],
  );

  const dashboardSummary = useMemo(
    () => computeSupplierDashboardSummary(suppliers, unpaidBills, paidBills, payablesAsOf),
    [suppliers, unpaidBills, paidBills, payablesAsOf],
  );

  const payablesSummary = dashboardSummary;
  const paidLast30 = dashboardSummary.paid;
  const hasBillData = !dashboardSummary.usesSupplierBalances;

  const openBillSuppliers = useMemo(
    () => supplierNamesWithOpenBills(suppliers.map((s) => s.name), dashboardUnpaidBills),
    [suppliers, dashboardUnpaidBills],
  );
  const overdueSuppliers = useMemo(
    () => overdueSupplierNames(suppliers.map((s) => s.name), dashboardUnpaidBills),
    [suppliers, dashboardUnpaidBills],
  );
  const paidSupplierNames = useMemo(
    () => supplierNamesWithPaidBillsLast30Days(paidBills, payablesAsOf),
    [paidBills, payablesAsOf],
  );
  const [payablesFilter, setPayablesFilter] = useState<PayablesCardFilter | null>(null);

  function togglePayablesFilter(filter: PayablesCardFilter) {
    setPayablesFilter((current) => (current === filter ? null : filter));
    setPage(1);
    setSelected(new Set());
  }
  const chartAccounts = useSyncExternalStore(
    subscribeMockStore,
    getChartAccountsSnapshot,
    getChartAccountsSnapshot,
  );
  const defaultPaymentAccountId = useMemo(() => {
    const accounts = filterPaymentAccounts(getActiveChartAccountsSorted(chartAccounts));
    const cashOnHand = accounts.find((a) => a.name === "Cash on hand");
    return cashOnHand?.id ?? accounts[0]?.id ?? "";
  }, [chartAccounts]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    phone: true,
    email: true,
  });
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [importSuppliersOpen, setImportSuppliersOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<MockSupplier | null>(null);
  const [profileSupplierId, setProfileSupplierId] = useState<string | null>(null);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [chequeDialogOpen, setChequeDialogOpen] = useState(false);
  const [itemReceiptDialogOpen, setItemReceiptDialogOpen] = useState(false);
  const [draftBillNumber, setDraftBillNumber] = useState(() => getNextBillNumber());
  const [draftExpenseNumber, setDraftExpenseNumber] = useState(() => getNextExpenseNumber());
  const [draftChequeNumber, setDraftChequeNumber] = useState(() => getNextExpenseNumber());
  const [draftItemReceiptNumber, setDraftItemReceiptNumber] = useState(() =>
    getNextExpenseNumber(),
  );
  const [expensePrefill, setExpensePrefill] = useState<ExpenseFormValues | null>(null);
  const [chequePrefill, setChequePrefill] = useState<ChequeFormValues | null>(null);
  const [billPrefill, setBillPrefill] = useState<BillFormValues | null>(null);
  const [itemReceiptPrefill, setItemReceiptPrefill] = useState<ItemReceiptFormValues | null>(null);

  function displayOpenBalance(supplier: Supplier): number {
    const fromBills = openBalanceBySupplier.get(supplier.name.trim().toLowerCase());
    if (fromBills !== undefined && fromBills > 0) return fromBills;
    return supplier.openBalance;
  }

  function pendingBillCount(supplier: Supplier): number {
    return pendingBillCountBySupplier.get(supplier.name.trim().toLowerCase()) ?? 0;
  }

  function openBillsForSupplier(supplierName: string) {
    router.push(
      `/expenses/bills?tab=unpaid&supplier=${encodeURIComponent(supplierName)}`,
    );
  }

  const showPendingBillsColumn =
    payablesFilter === "open" || payablesFilter === "overdue";

  const filtered = useMemo(() => {
    let rows = suppliers;

    if (payablesFilter === "overdue") {
      rows = rows.filter((s) => overdueSuppliers.has(s.name));
    } else if (payablesFilter === "open") {
      rows = hasBillData
        ? rows.filter((s) => openBillSuppliers.has(s.name))
        : rows.filter((s) => s.openBalance > 0);
    } else if (payablesFilter === "paid") {
      rows = rows.filter((s) => paidSupplierNames.has(s.name));
    }

    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.companyName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.includes(q),
    );
  }, [
    suppliers,
    search,
    payablesFilter,
    overdueSuppliers,
    openBillSuppliers,
    paidSupplierNames,
    hasBillData,
  ]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "openBalance") {
        cmp = displayOpenBalance(a) - displayOpenBalance(b);
      } else {
        cmp = a[sortKey].localeCompare(b[sortKey]);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir, openBalanceBySupplier]);

  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const rangeStart = sorted.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, sorted.length);

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((s) => selected.has(s.id));

  const totalOpen = filtered.reduce((sum, s) => sum + displayOpenBalance(s), 0);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageItems.forEach((s) => next.delete(s.id));
      else pageItems.forEach((s) => next.add(s.id));
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

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return null;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  }

  const selectedCount = selected.size;

  function handleExport() {
    exportSuppliersCsv(sorted);
    toast({
      title: "Export started",
      description: `Downloaded ${sorted.length} supplier${sorted.length === 1 ? "" : "s"} as CSV.`,
    });
  }

  function handlePrint() {
    window.print();
    toast({ title: "Print", description: "Opening print dialog…" });
  }

  function openBillForSupplier(supplier: Supplier) {
    const billNumber = getNextBillNumber();
    setDraftBillNumber(billNumber);
    setBillPrefill(buildBillPrefillFromSupplier(supplier, billNumber, defaultPaymentAccountId));
    setBillDialogOpen(true);
  }

  function openExpenseForSupplier(supplier: Supplier) {
    const expenseNumber = getNextExpenseNumber();
    setDraftExpenseNumber(expenseNumber);
    setExpensePrefill(
      buildExpensePrefillFromSupplier(supplier, expenseNumber, defaultPaymentAccountId),
    );
    setExpenseDialogOpen(true);
  }

  function openItemReceiptForSupplier(supplier: Supplier) {
    const receiptNumber = getNextExpenseNumber();
    setDraftItemReceiptNumber(receiptNumber);
    setItemReceiptPrefill(buildItemReceiptPrefillFromSupplier(supplier, receiptNumber));
    setItemReceiptDialogOpen(true);
  }

  function openChequeForSupplier(supplier: Supplier) {
    const chequeNumber = getNextExpenseNumber();
    setDraftChequeNumber(chequeNumber);
    setChequePrefill(
      buildExpensePrefillFromSupplier(
        supplier,
        chequeNumber,
        defaultPaymentAccountId,
        "cheque",
      ),
    );
    setChequeDialogOpen(true);
  }

  function handleBillDialogOpenChange(open: boolean) {
    setBillDialogOpen(open);
    if (!open) setBillPrefill(null);
  }

  function handleExpenseDialogOpenChange(open: boolean) {
    setExpenseDialogOpen(open);
    if (!open) setExpensePrefill(null);
  }

  function handleChequeDialogOpenChange(open: boolean) {
    setChequeDialogOpen(open);
    if (!open) setChequePrefill(null);
  }

  function handleItemReceiptDialogOpenChange(open: boolean) {
    setItemReceiptDialogOpen(open);
    if (!open) setItemReceiptPrefill(null);
  }

  function billTotalsFromForm(values: BillFormValues) {
    const activeCategoryLines = values.lines.filter((l) => Number(l.amount) > 0);
    const activeItemLines = values.itemLines.filter(
      (l) => (Number(l.qty) || 0) * (Number(l.rate) || 0) > 0,
    );
    const categoryTotal = activeCategoryLines.reduce((sum, l) => sum + Number(l.amount), 0);
    const itemTotal = activeItemLines.reduce(
      (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.rate) || 0),
      0,
    );
    const total = categoryTotal + itemTotal;
    const primaryLine = activeCategoryLines[0];

    let category = "Office Supplies";
    let isSplit = false;
    if (activeCategoryLines.length > 0) {
      const categories = new Set(activeCategoryLines.map((l) => l.category));
      category = categories.size === 1 ? activeCategoryLines[0]!.category : "--Split--";
      isSplit = categories.size > 1 || activeItemLines.length > 0;
    } else if (activeItemLines.length > 1) {
      category = "--Split--";
      isSplit = true;
    }

    return { total, category, isSplit, primaryLine };
  }

  async function handleSaveBill(values: BillFormValues) {
    if (!values.supplier.trim()) {
      toast({
        title: "Supplier required",
        description: "Choose a supplier for this bill.",
        variant: "destructive",
      });
      return;
    }
    const { total, category, isSplit, primaryLine } = billTotalsFromForm(values);
    if (total <= 0) {
      toast({
        title: "Amount required",
        description: "Enter at least one category or item line with an amount.",
        variant: "destructive",
      });
      return;
    }

    try {
      await recordBillCreation({
        supplier: values.supplier.trim(),
        mailingAddress: values.mailingAddress.trim() || values.supplier.trim(),
        billDate: values.paymentDate,
        dueDate: values.dueDate || values.paymentDate,
        billNo: values.refNo.trim() || draftBillNumber,
        billAmount: total,
        category: primaryLine?.category,
        lineDescription: primaryLine?.description,
        expenseCategory: category,
        isSplit,
      });
      toast({
        title: "Bill created",
        description: `${values.supplier} — ${formatPHP(total)}`,
      });
      setDraftBillNumber(getNextBillNumber());
      handleBillDialogOpenChange(false);
    } catch (error) {
      toast({
        title: "Could not save bill",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  function expenseRowFromForm(
    values: ExpenseFormValues,
    options?: { type?: "Expense" | "Check"; numberFallback?: string },
  ) {
    const activeCategoryLines = values.lines.filter((l) => Number(l.amount) > 0);
    const activeItemLines = values.itemLines.filter(
      (l) => (Number(l.qty) || 0) * (Number(l.rate) || 0) > 0,
    );
    const categoryTotal = activeCategoryLines.reduce((sum, l) => sum + Number(l.amount), 0);
    const itemTotal = activeItemLines.reduce(
      (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.rate) || 0),
      0,
    );
    const total = categoryTotal + itemTotal;

    let category = "Office Supplies";
    let isSplit = false;
    if (activeCategoryLines.length > 0) {
      const categories = new Set(activeCategoryLines.map((l) => l.category));
      category = categories.size === 1 ? activeCategoryLines[0]!.category : "--Split--";
      isSplit = categories.size > 1 || activeItemLines.length > 0;
    } else if (activeItemLines.length > 1) {
      category = "--Split--";
      isSplit = true;
    }

    return {
      date: values.paymentDate,
      type: options?.type ?? "Expense",
      number: values.refNo.trim() || options?.numberFallback || draftExpenseNumber,
      payee: values.payee.trim(),
      status: "paid" as const,
      category,
      ...(isSplit ? { isSplit: true } : {}),
      totalBeforeTax: total,
      salesTax: 0,
      total,
    };
  }

  async function handleSaveExpense(values: ExpenseFormValues) {
    const row = expenseRowFromForm(values);
    if (row.total <= 0) {
      toast({
        title: "Amount required",
        description: "Enter at least one category or item line with an amount.",
        variant: "destructive",
      });
      return;
    }
    try {
      await recordExpenseCreation(row);
      toast({
        title: "Expense created",
        description: `${row.payee} — ${formatPHP(row.total)}`,
      });
      setDraftExpenseNumber(getNextExpenseNumber());
      handleExpenseDialogOpenChange(false);
    } catch (error) {
      toast({
        title: "Could not save expense",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  async function handleSaveItemReceipt(values: ItemReceiptFormValues) {
    const activeLines = values.lines.filter(
      (l) => l.productService.trim() && (Number(l.qtyReceived) || 0) * (Number(l.rate) || 0) > 0,
    );
    const total = activeLines.reduce(
      (sum, l) => sum + (Number(l.qtyReceived) || 0) * (Number(l.rate) || 0),
      0,
    );
    const products = new Set(activeLines.map((l) => l.productService.trim()));
    const category =
      products.size === 1 ? activeLines[0]!.productService.trim() : "--Split--";

    try {
      await recordExpenseCreation({
        date: values.date,
        type: "Item receipt",
        number: values.receiptNo.trim() || draftItemReceiptNumber,
        payee: values.supplier.trim(),
        status: "paid",
        category,
        ...(products.size > 1 ? { isSplit: true } : {}),
        totalBeforeTax: total,
        salesTax: 0,
        total,
      });
      setDraftItemReceiptNumber(getNextExpenseNumber());
    } catch (error) {
      toast({
        title: "Could not save item receipt",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  async function handleSaveCheque(values: ChequeFormValues) {
    const row = expenseRowFromForm(values, {
      type: "Check",
      numberFallback: draftChequeNumber,
    });
    if (row.total <= 0) {
      toast({
        title: "Amount required",
        description: "Enter at least one category or item line with an amount.",
        variant: "destructive",
      });
      return;
    }
    try {
      await recordExpenseCreation(row);
      toast({
        title: "Cheque recorded",
        description: `${row.payee} — ${formatPHP(row.total)}`,
      });
      setDraftChequeNumber(getNextExpenseNumber());
      handleChequeDialogOpenChange(false);
    } catch (error) {
      toast({
        title: "Could not save cheque",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  function makeSupplierInactive(supplier: Supplier) {
    removeSuppliers([supplier.id]);
    toast({
      title: "Supplier made inactive",
      description: supplier.name,
    });
  }

  function removeSuppliers(ids: string[]) {
    deleteSuppliers(ids);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  function openCreateSupplier() {
    setEditingSupplier(null);
    setSupplierFormOpen(true);
  }

  function openEditSupplier(supplier: Supplier) {
    setProfileSupplierId(null);
    setEditingSupplier(supplier);
    setSupplierFormOpen(true);
  }

  function openViewSupplier(supplier: Supplier) {
    setProfileSupplierId(supplier.id);
  }

  async function handleSaveSupplier(values: SupplierFormValues) {
    try {
      if (editingSupplier) {
        await updateSupplierViaApi(editingSupplier.id, {
          name: values.name,
          companyName: values.companyName,
          phone: values.phone,
          email: values.email,
          currency: values.currency,
          openingBalance: values.openingBalance,
          profile: values.profile,
        });
        toast({ title: "Supplier updated", description: values.name });
        setEditingSupplier(null);
        return;
      }

      await createSupplierViaApi({
        name: values.name,
        companyName: values.companyName,
        phone: values.phone,
        email: values.email,
        currency: values.currency,
        openingBalance: values.openingBalance,
        profile: values.profile,
      });
      toast({ title: "Supplier added", description: values.name });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      toast({
        title: editingSupplier ? "Could not update" : "Could not save supplier",
        description:
          message === "Supplier already exists"
            ? `"${values.name}" is already in the list.`
            : message,
        variant: "destructive",
      });
      throw error;
    }
  }

  const colSpan =
    5 +
    (visibleColumns.phone ? 1 : 0) +
    (visibleColumns.email ? 1 : 0) +
    (showPendingBillsColumn ? 1 : 0) +
    2;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Expenses & Bills
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            Manage vendors, track open balances, and create bills from your supplier list.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() =>
              toast({
                title: "Feedback",
                description: "Thanks for helping us improve Suppliers.",
              })
            }
          >
            <MessageSquare className="h-4 w-4" />
            Give feedback
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                New supplier
                <ChevronDown className="h-3.5 w-3.5 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openCreateSupplier}>
                Add supplier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setImportSuppliersOpen(true)}>
                Import from spreadsheet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ImportSuppliersDialog
        open={importSuppliersOpen}
        onOpenChange={setImportSuppliersOpen}
      />

      <BillFormDialog
        open={billDialogOpen}
        onOpenChange={handleBillDialogOpenChange}
        billNumber={draftBillNumber}
        prefill={billPrefill}
        onSave={handleSaveBill}
        onSaveAndNew={() => {
          const next = getNextBillNumber();
          setDraftBillNumber(next);
          return next;
        }}
      />

      <ExpenseFormDialog
        open={expenseDialogOpen}
        onOpenChange={handleExpenseDialogOpenChange}
        expenseNumber={draftExpenseNumber}
        prefill={expensePrefill}
        onSave={handleSaveExpense}
        onSaveAndNew={() => {
          const next = getNextExpenseNumber();
          setDraftExpenseNumber(next);
          return next;
        }}
      />

      <ChequeFormDialog
        open={chequeDialogOpen}
        onOpenChange={handleChequeDialogOpenChange}
        chequeNumber={draftChequeNumber}
        prefill={chequePrefill}
        onSave={handleSaveCheque}
        onSaveAndNew={() => {
          const next = getNextExpenseNumber();
          setDraftChequeNumber(next);
          return next;
        }}
      />

      <ItemReceiptFormDialog
        open={itemReceiptDialogOpen}
        onOpenChange={handleItemReceiptDialogOpenChange}
        receiptNumber={draftItemReceiptNumber}
        prefill={itemReceiptPrefill}
        onSave={handleSaveItemReceipt}
        onSaveAndNew={() => {
          const next = getNextExpenseNumber();
          setDraftItemReceiptNumber(next);
          return next;
        }}
      />

      <SupplierFormDialog
        open={supplierFormOpen}
        onOpenChange={(open) => {
          setSupplierFormOpen(open);
          if (!open) setEditingSupplier(null);
        }}
        supplier={editingSupplier}
        onSave={handleSaveSupplier}
      />

      <SupplierProfileDialog
        supplierId={profileSupplierId}
        open={profileSupplierId !== null}
        onOpenChange={(open) => {
          if (!open) setProfileSupplierId(null);
        }}
        onEdit={(supplier) => openEditSupplier(supplier)}
      />

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
          <button
            type="button"
            onClick={() => togglePayablesFilter("overdue")}
            aria-pressed={payablesFilter === "overdue"}
            className={cn(
              "px-5 py-4 space-y-1 border-l-4 border-l-amber-500/80 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              payablesFilter === "overdue" && "bg-amber-500/5 ring-1 ring-inset ring-amber-500/25",
            )}
          >
            <p className="text-xs text-muted-foreground">Unpaid · overdue</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatPHP(payablesSummary.overdue.amount)}
            </p>
            <p className="text-xs font-medium text-amber-700">
              {payablesSummary.overdue.count}{" "}
              {payablesSummary.overdue.count === 1 ? "overdue bill" : "overdue bills"}
            </p>
          </button>
          <button
            type="button"
            onClick={() => togglePayablesFilter("open")}
            aria-pressed={payablesFilter === "open"}
            className={cn(
              "px-5 py-4 space-y-1 border-l-4 border-l-muted-foreground/30 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              payablesFilter === "open" && "bg-muted/40 ring-1 ring-inset ring-muted-foreground/25",
            )}
          >
            <p className="text-xs text-muted-foreground">Unpaid · open bills</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatPHP(payablesSummary.openBills.amount)}
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              {payablesSummary.openBills.count}{" "}
              {dashboardSummary.usesSupplierBalances
                ? payablesSummary.openBills.count === 1
                  ? "supplier with open balance"
                  : "suppliers with open balance"
                : payablesSummary.openBills.count === 1
                  ? "open bill"
                  : "open bills"}
            </p>
          </button>
          <button
            type="button"
            onClick={() => togglePayablesFilter("paid")}
            aria-pressed={payablesFilter === "paid"}
            className={cn(
              "px-5 py-4 space-y-1 border-l-4 border-l-emerald-500/80 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              payablesFilter === "paid" && "bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/25",
            )}
          >
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatPHP(paidLast30.amount)}
            </p>
            <p className="text-xs font-medium text-emerald-700">
              {paidLast30.count}{" "}
              {paidLast30.count === 1 ? "bill paid last 30 days" : "bills paid last 30 days"}
            </p>
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {selectedCount > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2">
                    Batch actions ({selectedCount})
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => {
                      const first = suppliers.find((s) => selected.has(s.id));
                      if (first) openBillForSupplier(first);
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Create bills
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportSuppliersCsv(
                    suppliers.filter((s) => selected.has(s.id)),
                  )}>
                    <Download className="mr-2 h-4 w-4" />
                    Export selected
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      removeSuppliers([...selected]);
                      toast({
                        title: "Removed",
                        description: `${selectedCount} supplier(s) deleted.`,
                      });
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {payablesFilter && (
              <button
                type="button"
                onClick={() => {
                  setPayablesFilter(null);
                  setPage(1);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted/50"
              >
                {PAYABLES_FILTER_LABELS[payablesFilter]}
                <X className="h-3.5 w-3.5 opacity-60" />
              </button>
            )}

            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search suppliers"
                className="h-9 pl-9 bg-background"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label="Print"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label="Export to CSV"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Table settings"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.phone}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((c) => ({ ...c, phone: checked }))
                  }
                >
                  Phone column
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.email}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((c) => ({ ...c, email: checked }))
                  }
                >
                  Email column
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
                <th className="px-4 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Supplier
                    <SortIcon column="name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort("companyName")}
                    className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Company name
                    <SortIcon column="companyName" />
                  </button>
                </th>
                {visibleColumns.phone && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Phone
                  </th>
                )}
                {visibleColumns.email && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Email
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Currency
                </th>
                {showPendingBillsColumn && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Pending bills
                  </th>
                )}
                <th className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("openBalance")}
                    className="inline-flex items-center gap-1 ml-auto text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Open balance
                    <SortIcon column="openBalance" />
                  </button>
                </th>
                <th className="w-[1%] whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-16 text-center text-muted-foreground">
                    {payablesFilter === "open" && hasBillData
                      ? "No suppliers with open bills match your search."
                      : payablesFilter === "overdue"
                        ? "No suppliers with overdue bills match your search."
                        : payablesFilter === "paid"
                          ? "No suppliers with bills paid in the last 30 days match your search."
                          : "No suppliers match your search."}
                  </td>
                </tr>
              ) : (
                pageItems.map((supplier, index) => {
                  const isSelected = selected.has(supplier.id);
                  const stripe = index % 2 === 0 ? "bg-background" : "bg-muted/15";
                  return (
                    <tr
                      key={supplier.id}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-muted/30",
                        stripe,
                        isSelected && "bg-primary/5",
                      )}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(supplier.id)}
                          aria-label={`Select ${supplier.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <button
                          type="button"
                          className="text-left hover:text-primary hover:underline"
                          onClick={() => openViewSupplier(supplier)}
                        >
                          {supplier.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {supplier.companyName}
                      </td>
                      {visibleColumns.phone && (
                        <td className="px-4 py-3 text-muted-foreground">
                          {supplier.phone || "—"}
                        </td>
                      )}
                      {visibleColumns.email && (
                        <td className="px-4 py-3 text-muted-foreground">
                          {supplier.email || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-muted-foreground">{supplier.currency}</td>
                      {showPendingBillsColumn && (
                        <td className="px-4 py-3">
                          {(() => {
                            const count = pendingBillCount(supplier);
                            if (count <= 0) return "—";
                            return (
                              <button
                                type="button"
                                className="text-sm font-medium text-primary hover:underline"
                                onClick={() => openBillsForSupplier(supplier.name)}
                              >
                                {count} open {count === 1 ? "bill" : "bills"}
                              </button>
                            );
                          })()}
                        </td>
                      )}
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums font-medium",
                          overdueSuppliers.has(supplier.name) && "text-amber-700",
                        )}
                      >
                        {formatPHP(displayOpenBalance(supplier))}
                      </td>
                      <td className="w-[1%] whitespace-nowrap px-4 py-3 text-left">
                        <SupplierActionSplitButton
                          onCreateBill={() => openBillForSupplier(supplier)}
                          onCreateExpense={() => openExpenseForSupplier(supplier)}
                          onWriteCheque={() => openChequeForSupplier(supplier)}
                          onCreateItemReceipt={() => openItemReceiptForSupplier(supplier)}
                          onViewProfile={() => openViewSupplier(supplier)}
                          onEditSupplier={() => openEditSupplier(supplier)}
                          onMakeInactive={() => makeSupplierInactive(supplier)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {sorted.length === 0
              ? "No results"
              : `${rangeStart}–${rangeEnd} of ${sorted.length} suppliers`}
            {selected.size > 0 && ` · ${selected.size} selected`}
            {payablesFilter === "open" && hasBillData && payablesSummary.openBills.count > 0
              ? ` · ${payablesSummary.openBills.count} open ${
                  payablesSummary.openBills.count === 1 ? "bill" : "bills"
                }`
              : totalOpen > 0
                ? ` · ${formatPHP(totalOpen)} total open balance`
                : null}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums px-1">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
