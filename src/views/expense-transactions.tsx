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
  Download,
  MessageSquare,
  Printer,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PayBillsDialog } from "@/components/pay-bills-dialog";
import { ExpenseTransactionRow } from "@/components/expense-transaction-row";
import type {
  BillFormValues,
  ChequeFormValues,
  ExpenseFormValues,
} from "@/components/expense-form-dialog";

const ExpenseFormDialog = dynamic(
  () =>
    import("@/components/expense-form-dialog").then((m) => ({
      default: m.ExpenseFormDialog,
    })),
  { ssr: false },
);

const ChequeFormDialog = dynamic(
  () =>
    import("@/components/expense-form-dialog").then((m) => ({
      default: m.ChequeFormDialog,
    })),
  { ssr: false },
);

const BillFormDialog = dynamic(
  () =>
    import("@/components/expense-form-dialog").then((m) => ({
      default: m.BillFormDialog,
    })),
  { ssr: false },
);
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { useChartAccounts } from "@/hooks/use-chart-accounts";
import { useMockExpenseCategories } from "@/hooks/use-mock-expense-categories";
import { useMockExpenses } from "@/hooks/use-mock-expenses";
import { useToast } from "@/hooks/use-toast";
import { buildExpensePrefillFromBill, buildExpensePrefillFromTransaction, resolveExpenseFormVariant } from "@/lib/expense-form-prefill";
import {
  EXPENSE_TRANSACTIONS_PATH,
  NEW_CHEQUE_SEARCH_PARAM,
  NEW_EXPENSE_SEARCH_PARAM,
} from "@/lib/expense-navigation";
import { deleteExpensesViaApi } from "@/lib/expense-transactions/api";
import {
  recordBillCreation,
  recordExpenseCreation,
  recordExpenseUpdate,
} from "@/lib/expense-transactions/record-expense";
import {
  filterPaymentAccounts,
  getActiveChartAccountsSorted,
  getChartAccountsSnapshot,
  getNextBillNumber,
  getNextExpenseNumber,
  EXPENSE_DATE_FILTER_OPTIONS,
  expenseDateChipLabel,
  filterExpensesByPeriod,
  subscribeMockStore,
  type ExpensePeriod,
  type MockExpenseTransaction,
} from "@/lib/mock-data";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";
import { formatPHP } from "@/views/financial-report-shared";

type ExpenseTransaction = MockExpenseTransaction;

const TRANSACTION_TYPES = ["All transactions", "Expense", "Bill payment", "Check"];

const NEW_TRANSACTION_OPTIONS = [
  { id: "time-activity", label: "Time activity" },
  { id: "bill", label: "Bill" },
  { id: "expense", label: "Expense" },
  { id: "cheque", label: "Cheque" },
  { id: "purchase-order", label: "Purchase order" },
  { id: "supplier-credit", label: "Supplier credit" },
  { id: "credit-card-credit", label: "Credit card credit" },
  { id: "pay-down-credit-card", label: "Pay down credit card" },
  { id: "import-bills", label: "Import Bills" },
] as const;

type NewTransactionOptionId = (typeof NEW_TRANSACTION_OPTIONS)[number]["id"];

const PAGE_SIZE = 10;

type ColumnKey = "salesTax";

function exportExpensesCsv(rows: ExpenseTransaction[], getCategory: (e: ExpenseTransaction) => string) {
  const headers = [
    "Date",
    "Type",
    "No.",
    "Payee",
    "Category",
    "Total Before Tax",
    "Sales Tax",
    "Total",
  ];
  const lines = rows.map((e) =>
    [
      e.date,
      e.type,
      e.number,
      e.payee,
      getCategory(e),
      e.totalBeforeTax,
      e.salesTax,
      e.total,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExpenseTransactions() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const expenses = useMockExpenses();
  useChartAccounts();
  const expenseCategories = useMockExpenseCategories();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState("All transactions");
  /** Default null = all dates (show full QuickBooks import). */
  const [datePeriod, setDatePeriod] = useState<ExpensePeriod | null>(null);
  const [page, setPage] = useState(1);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    salesTax: true,
  });
  const [newExpenseOpen, setNewExpenseOpen] = useState(false);
  const [newChequeOpen, setNewChequeOpen] = useState(false);
  const [newBillOpen, setNewBillOpen] = useState(false);
  const [payBillsOpen, setPayBillsOpen] = useState(false);
  const [payBillExpenseOpen, setPayBillExpenseOpen] = useState(false);
  const [payBillPrefill, setPayBillPrefill] = useState<ExpenseFormValues | null>(null);
  const [draftExpenseNumber, setDraftExpenseNumber] = useState(() => getNextExpenseNumber());
  const [draftChequeNumber, setDraftChequeNumber] = useState(() => getNextExpenseNumber());
  const [draftBillNumber, setDraftBillNumber] = useState(() => getNextBillNumber());
  const [payBillExpenseNumber, setPayBillExpenseNumber] = useState(() => getNextExpenseNumber());
  const [editExpenseOpen, setEditExpenseOpen] = useState(false);
  const [editExpenseTarget, setEditExpenseTarget] = useState<ExpenseTransaction | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (searchParams.get(NEW_EXPENSE_SEARCH_PARAM) === "1") {
      setDraftExpenseNumber(getNextExpenseNumber());
      setNewExpenseOpen(true);
      params.delete(NEW_EXPENSE_SEARCH_PARAM);
      changed = true;
    }

    if (searchParams.get(NEW_CHEQUE_SEARCH_PARAM) === "1") {
      setDraftChequeNumber(getNextExpenseNumber());
      setNewChequeOpen(true);
      params.delete(NEW_CHEQUE_SEARCH_PARAM);
      changed = true;
    }

    if (changed) {
      const q = params.toString();
      router.replace(q ? `${EXPENSE_TRANSACTIONS_PATH}?${q}` : EXPENSE_TRANSACTIONS_PATH, {
        scroll: false,
      });
    }
  }, [searchParams, router]);

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

  const filtered = useMemo(() => {
    const inPeriod =
      datePeriod === null ? expenses : filterExpensesByPeriod(expenses, datePeriod);
    return inPeriod.filter((e) => {
      if (typeFilter !== "All transactions" && e.type !== typeFilter) return false;
      return true;
    });
  }, [expenses, typeFilter, datePeriod]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length);

  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p));
  }, [totalPages]);

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((e) => selected.has(e.id));

  const totalAmount = useMemo(
    () => filtered.reduce((sum, e) => sum + e.total, 0),
    [filtered],
  );

  const billCount = useMemo(
    () => filtered.filter((e) => e.type.trim().toLowerCase() === "bill").length,
    [filtered],
  );

  const toggleAllOnPage = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageItems.forEach((e) => next.delete(e.id));
      else pageItems.forEach((e) => next.add(e.id));
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

  const handleCategoryChange = useCallback((id: string, category: string) => {
    setCategoryOverrides((prev) => ({
      ...prev,
      [id]: category,
    }));
  }, []);

  const openExpenseViewEdit = useCallback((expense: ExpenseTransaction) => {
    setEditExpenseTarget(expense);
    setEditExpenseOpen(true);
  }, []);

  const handleDeleteRow = useCallback(
    async (id: string, payee: string) => {
      try {
        await deleteExpensesViaApi([id]);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast({
          title: "Deleted",
          description: `${payee} removed.`,
        });
      } catch (error) {
        toast({
          title: "Could not delete",
          description: error instanceof Error ? error.message : "Delete failed.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  function getCategory(expense: ExpenseTransaction) {
    return categoryOverrides[expense.id] ?? expense.category;
  }

  const selectedCount = selected.size;

  function handleExport() {
    exportExpensesCsv(filtered, getCategory);
    toast({
      title: "Export started",
      description: `Downloaded ${filtered.length} transaction${filtered.length === 1 ? "" : "s"} as CSV.`,
    });
  }

  function handlePrint() {
    window.print();
    toast({ title: "Print", description: "Opening print dialog…" });
  }

  async function deleteExpenses(ids: string[]) {
    try {
      await deleteExpensesViaApi(ids);
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } catch (error) {
      toast({
        title: "Could not delete",
        description: error instanceof Error ? error.message : "Delete failed.",
        variant: "destructive",
      });
    }
  }

  const duplicateExpense = useCallback(
    async (expense: ExpenseTransaction) => {
      try {
        await recordExpenseCreation({
          ...expense,
          number: String(Number(expense.number) + 1),
          status: "pending",
        });
        toast({ title: "Duplicated", description: `Copy of ${expense.payee} created.` });
      } catch (error) {
        toast({
          title: "Could not duplicate",
          description: error instanceof Error ? error.message : "Save failed.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  function closeExpenseViewEdit() {
    setEditExpenseOpen(false);
    setEditExpenseTarget(null);
  }

  const editExpenseVariant = editExpenseTarget
    ? resolveExpenseFormVariant(editExpenseTarget.type)
    : "expense";

  const editExpensePrefill = useMemo(() => {
    if (!editExpenseTarget) return null;
    return buildExpensePrefillFromTransaction(
      editExpenseTarget,
      defaultPaymentAccountId,
      editExpenseVariant,
    );
  }, [editExpenseTarget, defaultPaymentAccountId, editExpenseVariant]);

  async function handleUpdateEditedTransaction(values: ExpenseFormValues) {
    if (!editExpenseTarget) return;

    const variant = resolveExpenseFormVariant(editExpenseTarget.type);
    let patch: Partial<MockExpenseTransaction>;

    if (variant === "bill") {
      const { total, category, isSplit } = billFromForm(values);
      patch = {
        date: values.dueDate,
        type: "Bill",
        number: values.refNo.trim() || editExpenseTarget.number,
        payee: values.supplier.trim() || values.payee.trim(),
        category,
        ...(isSplit ? { isSplit: true } : {}),
        totalBeforeTax: total,
        salesTax: 0,
        total,
      };
    } else if (variant === "cheque") {
      patch = { ...expenseFromForm(values, editExpenseTarget.number), type: "Check" };
    } else {
      const row = expenseFromForm(values, editExpenseTarget.number);
      const originalType = editExpenseTarget.type.trim().toLowerCase();
      patch = {
        ...row,
        type: originalType.includes("bill payment") ? editExpenseTarget.type : row.type,
      };
    }

    try {
      await recordExpenseUpdate(editExpenseTarget.id, patch);
      if (patch.category) {
        setCategoryOverrides((prev) => ({
          ...prev,
          [editExpenseTarget.id]: patch.category!,
        }));
      }
      toast({
        title: "Transaction updated",
        description: `${patch.payee ?? editExpenseTarget.payee} — ${formatPHP(patch.total ?? editExpenseTarget.total)}`,
      });
      closeExpenseViewEdit();
    } catch (error) {
      toast({
        title: "Could not save",
        description: error instanceof Error ? error.message : "Update failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  function expenseFromForm(values: ExpenseFormValues, numberFallback = draftExpenseNumber) {
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
      type: "Expense",
      number: values.refNo.trim() || numberFallback,
      payee: values.payee.trim(),
      status: "paid" as const,
      category,
      paymentAccountId: values.paymentAccountId,
      ...(isSplit ? { isSplit: true } : {}),
      totalBeforeTax: total,
      salesTax: 0,
      total,
    };
  }

  async function handleSaveExpense(values: ExpenseFormValues) {
    const row = expenseFromForm(values);
    try {
      await recordExpenseCreation(row);
      toast({
        title: "Expense created",
        description: `${row.payee} — ${formatPHP(row.total)}`,
      });
      setDraftExpenseNumber(getNextExpenseNumber());
    } catch (error) {
      toast({
        title: "Could not save expense",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  async function handleSaveCheque(values: ChequeFormValues) {
    const row = { ...expenseFromForm(values, draftChequeNumber), type: "Check" as const };
    try {
      await recordExpenseCreation(row);
      toast({
        title: "Cheque recorded",
        description: `${row.payee} — ${formatPHP(row.total)}`,
      });
      setDraftChequeNumber(getNextExpenseNumber());
    } catch (error) {
      toast({
        title: "Could not save cheque",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  function billFromForm(values: BillFormValues) {
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
    const { total, category, isSplit, primaryLine } = billFromForm(values);
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
      setNewBillOpen(false);
    } catch (error) {
      toast({
        title: "Could not save bill",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  function openExpenseForBill(bill: UnpaidBill) {
    const expenseNumber = getNextExpenseNumber();
    setPayBillExpenseNumber(expenseNumber);
    setPayBillPrefill(
      buildExpensePrefillFromBill(bill, expenseNumber, defaultPaymentAccountId),
    );
    setPayBillExpenseOpen(true);
  }

  function handlePayBillExpenseOpenChange(open: boolean) {
    setPayBillExpenseOpen(open);
    if (!open) setPayBillPrefill(null);
  }

  async function handleSavePayBillExpense(values: ExpenseFormValues) {
    const row = expenseFromForm(values);
    try {
      await recordExpenseCreation(row);
      toast({
        title: "Expense created",
        description: `${row.payee} — ${formatPHP(row.total)}`,
      });
      setPayBillExpenseNumber(getNextExpenseNumber());
      handlePayBillExpenseOpenChange(false);
    } catch (error) {
      toast({
        title: "Could not save expense",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  const colSpan = 9 + (visibleColumns.salesTax ? 1 : 0);

  function handleNewTransaction(optionId: NewTransactionOptionId) {
    switch (optionId) {
      case "bill":
        startTransition(() => {
          setDraftBillNumber(getNextBillNumber());
          setNewBillOpen(true);
        });
        return;
      case "expense": {
        const nextNumber = getNextExpenseNumber();
        startTransition(() => {
          setDraftExpenseNumber(nextNumber);
          setNewExpenseOpen(true);
        });
        return;
      }
      case "time-activity":
        toast({
          title: "Time activity",
          description: "Track billable or internal time against a customer or project.",
        });
        return;
      case "cheque": {
        const nextNumber = getNextExpenseNumber();
        startTransition(() => {
          setDraftChequeNumber(nextNumber);
          setNewChequeOpen(true);
        });
        return;
      }
      case "purchase-order":
        toast({
          title: "Purchase order",
          description: "Create a purchase order for goods or services.",
        });
        return;
      case "supplier-credit":
        toast({
          title: "Supplier credit",
          description: "Record credit received from a supplier.",
        });
        return;
      case "credit-card-credit":
        toast({
          title: "Credit card credit",
          description: "Record a refund or credit on a credit card account.",
        });
        return;
      case "pay-down-credit-card":
        toast({
          title: "Pay down credit card",
          description: "Transfer funds to pay down a credit card balance.",
        });
        return;
      case "import-bills":
        toast({
          title: "Import Bills",
          description: "Upload a CSV or connect a feed to import bills in bulk.",
        });
        return;
      default:
        return;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Expenses & Bills
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Review, categorize, and manage outgoing payments and expense entries.
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
                description: "Thanks — your feedback helps us improve Expenses.",
              })
            }
          >
            <MessageSquare className="h-4 w-4" />
            Give feedback
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setPayBillsOpen(true)}
          >
            Pay bills
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
              >
                New transaction
                <ChevronDown className="h-4 w-4 opacity-90" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1">
              {NEW_TRANSACTION_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  className="cursor-pointer px-3 py-2 text-sm"
                  onClick={() => handleNewTransaction(option.id)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {newExpenseOpen ? (
      <ExpenseFormDialog
        open={newExpenseOpen}
        onOpenChange={setNewExpenseOpen}
        expenseNumber={draftExpenseNumber}
        onSave={handleSaveExpense}
        onSaveAndNew={() => {
          const next = getNextExpenseNumber();
          setDraftExpenseNumber(next);
          return next;
        }}
      />
      ) : null}

      {newChequeOpen ? (
      <ChequeFormDialog
        open={newChequeOpen}
        onOpenChange={setNewChequeOpen}
        chequeNumber={draftChequeNumber}
        onSave={handleSaveCheque}
        onSaveAndNew={() => {
          const next = getNextExpenseNumber();
          setDraftChequeNumber(next);
          return next;
        }}
      />
      ) : null}

      {newBillOpen ? (
      <BillFormDialog
        open={newBillOpen}
        onOpenChange={setNewBillOpen}
        billNumber={draftBillNumber}
        onSave={handleSaveBill}
        onSaveAndNew={() => {
          const next = getNextBillNumber();
          setDraftBillNumber(next);
          return next;
        }}
      />
      ) : null}

      {payBillsOpen ? (
      <PayBillsDialog
        open={payBillsOpen}
        onOpenChange={setPayBillsOpen}
        onSelectPayee={openExpenseForBill}
      />
      ) : null}

      {payBillExpenseOpen ? (
      <ExpenseFormDialog
        open={payBillExpenseOpen}
        onOpenChange={handlePayBillExpenseOpenChange}
        expenseNumber={payBillExpenseNumber}
        prefill={payBillPrefill}
        onSave={handleSavePayBillExpense}
        onSaveAndNew={() => {
          const next = getNextExpenseNumber();
          setPayBillExpenseNumber(next);
          return next;
        }}
      />
      ) : null}

      {editExpenseOpen && editExpenseTarget ? (
      <ExpenseFormDialog
        open={editExpenseOpen}
        onOpenChange={(open) => {
          if (!open) closeExpenseViewEdit();
          else setEditExpenseOpen(true);
        }}
        expenseNumber={editExpenseTarget.number}
        prefill={editExpensePrefill}
        variant={editExpenseVariant}
        onSave={handleUpdateEditedTransaction}
      />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{filtered.length}</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">
            {datePeriod ? "Total (filtered)" : "Total"}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPHP(totalAmount)}</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Bills</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{billCount}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
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
                    onClick={() =>
                      toast({
                        title: "Categorize",
                        description: `Update category for ${selectedCount} selected.`,
                      })
                    }
                  >
                    Batch categorize
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      deleteExpenses([...selected]);
                      toast({
                        title: "Deleted",
                        description: `${selectedCount} transaction(s) removed.`,
                      });
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[180px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Date range</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={datePeriod ?? "all"}
                  onValueChange={(v) => {
                    setDatePeriod(v === "all" ? null : (v as ExpensePeriod));
                    setPage(1);
                  }}
                >
                  <DropdownMenuRadioItem value="all" onSelect={(e) => e.preventDefault()}>
                    All dates
                  </DropdownMenuRadioItem>
                  {EXPENSE_DATE_FILTER_OPTIONS.map((opt) => (
                    <DropdownMenuRadioItem
                      key={opt.value}
                      value={opt.value}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {opt.chipLabel}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {datePeriod !== null && (
              <Badge
                variant="secondary"
                className="h-9 gap-2 pl-3 pr-1.5 font-normal rounded-md"
              >
                Dates: {expenseDateChipLabel(datePeriod)}
                <button
                  type="button"
                  onClick={() => {
                    setDatePeriod(null);
                    setPage(1);
                  }}
                  className="rounded p-0.5 hover:bg-muted"
                  aria-label="Clear date filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Export to CSV"
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Print"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
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
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.salesTax}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((c) => ({ ...c, salesTax: checked }))
                    }
                  >
                    Sales tax column
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[140px]">
                  Payee
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[180px]">
                  Category
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Before tax
                </th>
                {visibleColumns.salesTax && (
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Sales tax
                  </th>
                )}
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total
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
                    No expense transactions match your filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((expense, index) => (
                  <ExpenseTransactionRow
                    key={expense.id}
                    expense={expense}
                    index={index}
                    isSelected={selected.has(expense.id)}
                    category={getCategory(expense)}
                    showSalesTax={visibleColumns.salesTax}
                    expenseCategories={expenseCategories}
                    onToggleSelect={toggleRow}
                    onCategoryChange={handleCategoryChange}
                    onViewEdit={openExpenseViewEdit}
                    onDuplicate={duplicateExpense}
                    onDelete={handleDeleteRow}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {filtered.length === 0
              ? "No results"
              : selected.size > 0
                ? `${selected.size} selected`
                : null}
          </p>
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
              {rangeStart}–{rangeEnd} of {filtered.length}
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
    </div>
  );
}
