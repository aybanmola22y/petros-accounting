"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Printer,
  Settings2,
} from "lucide-react";
import {
  BillFormDialog,
  ExpenseFormDialog,
  type BillFormValues,
  type ExpenseCategoryLine,
  type ExpenseFormValues,
  type ExpenseItemLine,
  type RecurringScheduleValues,
} from "@/components/expense-form-dialog";
import { RecurringTemplateFormDialog } from "@/components/recurring-template-form-dialog";
import { RecurringTransactionsFilterPopover } from "@/components/recurring-transactions-filter-popover";
import { RecurringTransactionTypeDialog } from "@/components/recurring-transaction-type-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useMockRecurringTemplates } from "@/hooks/use-mock-recurring-templates";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_RECURRING_LIST_FILTERS,
  defaultIntervalForType,
  formatRecurringAmount,
  getNextBillNumber,
  getNextExpenseNumber,
  nextRecurringDates,
  recurringFilterSummary,
  type MockRecurringTemplate,
  type RecurringListFilters,
  type RecurringTransactionType,
} from "@/lib/mock-data";
import {
  createRecurringTemplateViaApi,
  deleteRecurringTemplateViaApi,
  updateRecurringTemplateViaApi,
} from "@/lib/recurring-templates/api";
import { useRecurringTemplateNow } from "@/lib/recurring-templates/use-template";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type SortKey = "templateName" | "nextDate";
type SortDir = "asc" | "desc";

/**
 * Convert a saved recurring template into the full expense/bill editor's
 * values so that clicking "Edit" opens the same rich QuickBooks-style form
 * used when creating one. Only the fields the template persists are restored;
 * the remaining fields fall back to sensible defaults.
 */
function templateToExpenseValues(
  row: MockRecurringTemplate,
  variant: "expense" | "bill",
): ExpenseFormValues {
  const who = row.customerSupplier === "—" ? "" : row.customerSupplier;
  const categoryLine: ExpenseCategoryLine = {
    id: "line-1",
    category: "",
    description: "",
    amount: row.amount,
    billable: false,
    customerId: "",
    className: "",
  };
  const itemLine: ExpenseItemLine = {
    id: "item-1",
    serviceDate: "",
    productService: "",
    sku: "",
    description: "",
    qty: 1,
    rate: 0,
    billable: false,
    customerId: "",
    className: "",
  };
  return {
    payee: who,
    supplier: who,
    supplierId: "",
    mailingAddress: "",
    terms: variant === "bill" ? "Due on receipt" : "",
    dueDate: variant === "bill" ? row.nextDate || "" : "",
    paymentAccountId: "",
    paymentDate: row.nextDate || "",
    paymentMethod: "Cash",
    refNo: row.templateName,
    location: row.location ?? "",
    tags: "",
    lines: [categoryLine],
    itemLines: [itemLine],
    memo: "",
  };
}

/** Parse a saved interval label (e.g. "Every 2 Months") into schedule parts. */
function intervalToScheduleParts(interval: string): {
  frequency: RecurringScheduleValues["frequency"];
  every: number;
} {
  const lower = interval.toLowerCase();
  const numMatch = lower.match(/every\s+(\d+)/);
  const every = numMatch ? Number(numMatch[1]) : 1;
  if (lower.includes("year")) return { frequency: "Yearly", every: 1 };
  if (lower.includes("week")) return { frequency: "Weekly", every };
  if (lower.includes("daily")) return { frequency: "Daily", every: 1 };
  if (lower.includes("month")) return { frequency: "Monthly", every };
  return { frequency: "Monthly", every: 1 };
}

/** Build the schedule fields shown in the editor from a saved template. */
function templateToSchedule(row: MockRecurringTemplate): RecurringScheduleValues {
  const { frequency, every } = intervalToScheduleParts(row.interval);
  return {
    templateName: row.templateName,
    scheduleType: row.scheduleType,
    daysInAdvance: 0,
    frequency,
    dayType: "day",
    dayOfMonth: "1st",
    weekday: "Monday",
    every,
    startDate: row.nextDate || "",
    endType: "None",
    endDate: "",
    endAfter: 1,
  };
}

/** Restore the full editor form from a saved template's JSON snapshot. */
function savedFormFromDetails(
  details: Record<string, unknown> | null | undefined,
): ExpenseFormValues | null {
  if (!details || !Array.isArray((details as { lines?: unknown }).lines)) return null;
  return details as unknown as ExpenseFormValues;
}

/** Restore the recurring schedule from a saved template's JSON snapshot. */
function savedScheduleFromDetails(
  details: Record<string, unknown> | null | undefined,
): RecurringScheduleValues | null {
  const schedule = details?.schedule;
  if (!schedule || typeof schedule !== "object") return null;
  return schedule as RecurringScheduleValues;
}

/** Turn the schedule builder back into an interval label the list understands. */
function scheduleToInterval(schedule: RecurringScheduleValues): string {
  const every = Math.max(1, Number(schedule.every) || 1);
  switch (schedule.frequency) {
    case "Daily":
      return "Daily";
    case "Weekly":
      return every === 1 ? "Weekly" : `Every ${every} Weeks`;
    case "Yearly":
      return "Every Year";
    default:
      return every === 1 ? "Every Month" : `Every ${every} Months`;
  }
}

export function RecurringTransactions() {
  const { templates, refresh } = useMockRecurringTemplates();
  useSuppliers();
  const { toast } = useToast();

  const [nameFilter, setNameFilter] = useState("");
  const [appliedNameFilter, setAppliedNameFilter] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<RecurringListFilters>(
    DEFAULT_RECURRING_LIST_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("templateName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [billFormOpen, setBillFormOpen] = useState(false);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [pendingTxnType, setPendingTxnType] = useState<RecurringTransactionType>("Bill");
  const [editingTemplate, setEditingTemplate] = useState<MockRecurringTemplate | null>(null);
  const [draftExpenseNumber, setDraftExpenseNumber] = useState(() => getNextExpenseNumber());
  const [draftBillNumber, setDraftBillNumber] = useState(() => getNextBillNumber());

  const filtered = useMemo(() => {
    const query = appliedNameFilter.trim().toLowerCase();
    return templates
      .filter((row) => {
        if (
          appliedFilters.templateType !== "All" &&
          row.scheduleType !== appliedFilters.templateType
        ) {
          return false;
        }
        if (
          appliedFilters.transactionType !== "All" &&
          row.txnType !== appliedFilters.transactionType
        ) {
          return false;
        }
        if (appliedFilters.location !== "All") {
          const rowLocation = row.location ?? "Unspecified";
          if (rowLocation !== appliedFilters.location) return false;
        }
        if (!query) return true;
        return (
          row.templateName.toLowerCase().includes(query) ||
          row.customerSupplier.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const left = sortKey === "templateName" ? a.templateName : a.nextDate;
        const right = sortKey === "templateName" ? b.templateName : b.nextDate;
        const cmp = left.localeCompare(right, undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [templates, appliedNameFilter, appliedFilters, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length);

  const expensePrefill = useMemo(() => {
    if (editingTemplate?.txnType !== "Expense") return null;
    const saved = savedFormFromDetails(editingTemplate.details);
    return saved ?? templateToExpenseValues(editingTemplate, "expense");
  }, [editingTemplate]);

  const billPrefill = useMemo(() => {
    if (editingTemplate?.txnType !== "Bill") return null;
    const saved = savedFormFromDetails(editingTemplate.details);
    return saved ?? templateToExpenseValues(editingTemplate, "bill");
  }, [editingTemplate]);

  const recurringInitial = useMemo(() => {
    if (!editingTemplate) return null;
    const savedSchedule = savedScheduleFromDetails(editingTemplate.details);
    return savedSchedule ?? templateToSchedule(editingTemplate);
  }, [editingTemplate]);

  const upcomingReminders = useMemo(
    () =>
      templates
        .filter((row) => row.scheduleType === "Scheduled" || row.scheduleType === "Reminder")
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate, undefined, { numeric: true }))
        .slice(0, 8),
    [templates],
  );

  function applyFilter() {
    setAppliedNameFilter(nameFilter);
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  async function persistTemplate(input: Omit<MockRecurringTemplate, "id">) {
    try {
      await createRecurringTemplateViaApi(input);
      await refresh();
      return true;
    } catch (error) {
      toast({
        title: "Could not save template",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      return false;
    }
  }

  function handleTypeConfirm(type: RecurringTransactionType) {
    setTypeDialogOpen(false);
    setPendingTxnType(type);
    setEditingTemplate(null);

    if (type === "Expense") {
      setExpenseFormOpen(true);
      return;
    }
    if (type === "Bill") {
      setBillFormOpen(true);
      return;
    }

    setTemplateFormOpen(true);
  }

  async function createTemplateFromExpense(values: ExpenseFormValues) {
    const schedule = values.schedule;
    const interval = schedule ? scheduleToInterval(schedule) : "Every Month";
    const dates = nextRecurringDates(interval);
    const total = values.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const itemTotal = values.itemLines.reduce(
      (sum, line) => sum + (Number(line.qty) || 0) * (Number(line.rate) || 0),
      0,
    );
    const amount = total + itemTotal;
    const saved = await persistTemplate({
      templateName: schedule?.templateName.trim() || values.payee.trim() || "Recurring expense",
      scheduleType:
        (schedule?.scheduleType as MockRecurringTemplate["scheduleType"]) ?? "Scheduled",
      txnType: "Expense",
      interval,
      previousDate: dates.previousDate,
      nextDate: schedule?.startDate.trim() || dates.nextDate,
      customerSupplier: values.payee.trim() || "—",
      amount,
      location: values.location || undefined,
      details: values as unknown as Record<string, unknown>,
    });
    if (!saved) return false;
    setDraftExpenseNumber(getNextExpenseNumber());
    toast({
      title: "Recurring expense created",
      description: `${values.payee || "Expense"} — ${formatRecurringAmount(amount)}`,
    });
    return true;
  }

  async function createTemplateFromBill(values: BillFormValues) {
    const schedule = values.schedule;
    const interval = schedule ? scheduleToInterval(schedule) : "Every Month";
    const dates = nextRecurringDates(interval);
    const total = values.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const itemTotal = values.itemLines.reduce(
      (sum, line) => sum + (Number(line.qty) || 0) * (Number(line.rate) || 0),
      0,
    );
    const amount = total + itemTotal;
    const saved = await persistTemplate({
      templateName: schedule?.templateName.trim() || values.supplier.trim() || "Recurring bill",
      scheduleType:
        (schedule?.scheduleType as MockRecurringTemplate["scheduleType"]) ?? "Scheduled",
      txnType: "Bill",
      interval,
      previousDate: dates.previousDate,
      nextDate: schedule?.startDate.trim() || dates.nextDate,
      customerSupplier: values.supplier.trim() || "—",
      amount,
      location: values.location || undefined,
      details: values as unknown as Record<string, unknown>,
    });
    if (!saved) return false;
    setDraftBillNumber(getNextBillNumber());
    toast({
      title: "Recurring bill created",
      description: `${values.supplier || "Bill"} — ${formatRecurringAmount(amount)}`,
    });
    return true;
  }

  async function updateTemplateFromForm(
    template: MockRecurringTemplate,
    values: ExpenseFormValues,
  ) {
    const total =
      values.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0) +
      values.itemLines.reduce(
        (sum, line) => sum + (Number(line.qty) || 0) * (Number(line.rate) || 0),
        0,
      );
    const who = template.txnType === "Bill" ? values.supplier : values.payee;
    const schedule = values.schedule;
    try {
      await updateRecurringTemplateViaApi(template.id, {
        templateName: schedule?.templateName.trim() || who.trim() || template.templateName,
        customerSupplier: who.trim() || "—",
        amount: total,
        location: values.location || undefined,
        interval: schedule ? scheduleToInterval(schedule) : template.interval,
        scheduleType: schedule
          ? (schedule.scheduleType as MockRecurringTemplate["scheduleType"])
          : template.scheduleType,
        nextDate: schedule?.startDate.trim() || values.paymentDate || template.nextDate,
        details: values as unknown as Record<string, unknown>,
      });
      await refresh();
      toast({
        title: "Template updated",
        description: who.trim() || template.templateName,
      });
      return true;
    } catch (error) {
      toast({
        title: "Could not update template",
        description: error instanceof Error ? error.message : "Update failed.",
        variant: "destructive",
      });
      return false;
    }
  }

  async function handleGenericTemplateSave(input: Omit<MockRecurringTemplate, "id">) {
    if (editingTemplate) {
      try {
        await updateRecurringTemplateViaApi(editingTemplate.id, input);
        await refresh();
        toast({
          title: "Template updated",
          description: input.templateName,
        });
      } catch (error) {
        toast({
          title: "Could not update template",
          description: error instanceof Error ? error.message : "Update failed.",
          variant: "destructive",
        });
        throw error;
      }
      return;
    }

    const dates = nextRecurringDates(input.interval);
    const saved = await persistTemplate({
      ...input,
      previousDate: input.previousDate || dates.previousDate,
      nextDate: input.nextDate || dates.nextDate,
    });
    if (!saved) throw new Error("Save failed");
    toast({
      title: `${input.txnType} template created`,
      description: input.templateName,
    });
  }

  function handlePrint() {
    window.print();
    toast({ title: "Print", description: "Opening print dialog…" });
  }

  function handleEdit(row: MockRecurringTemplate) {
    setEditingTemplate(row);
    setPendingTxnType(row.txnType);

    if (row.txnType === "Expense") {
      setExpenseFormOpen(true);
      return;
    }
    if (row.txnType === "Bill") {
      setBillFormOpen(true);
      return;
    }

    setTemplateFormOpen(true);
  }

  async function handleDelete(row: MockRecurringTemplate) {
    try {
      await deleteRecurringTemplateViaApi(row.id);
      await refresh();
      toast({
        title: "Template deleted",
        description: row.templateName,
      });
    } catch (error) {
      toast({
        title: "Could not delete template",
        description: error instanceof Error ? error.message : "Delete failed.",
        variant: "destructive",
      });
    }
  }

  async function handleUse(row: MockRecurringTemplate) {
    try {
      await useRecurringTemplateNow(row);
      await refresh();
      toast({
        title: "Transaction created",
        description: `${row.templateName} was posted and the next date was advanced.`,
      });
    } catch (error) {
      toast({
        title: "Could not use template",
        description: error instanceof Error ? error.message : "Use failed.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-foreground">
            Recurring Transactions
          </h1>
          <Link
            href="/"
            className="inline-flex text-sm font-medium text-primary hover:underline"
          >
            &lt; All Lists
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() =>
              toast({
                title: "Feedback",
                description: "Thanks — your feedback helps us improve Recurring Transactions.",
              })
            }
          >
            <MessageSquare className="h-4 w-4 text-emerald-600" />
            Give feedback
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                Reminder List
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {upcomingReminders.length === 0 ? (
                <DropdownMenuItem disabled>No upcoming reminders</DropdownMenuItem>
              ) : (
                upcomingReminders.map((row) => (
                  <DropdownMenuItem key={row.id} onClick={() => handleEdit(row)}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="truncate">{row.templateName}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {row.nextDate}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuItem onClick={handlePrint}>Print reminder list</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => setTypeDialogOpen(true)}
          >
            New
            <ChevronDown className="h-4 w-4 opacity-90" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Input
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilter();
              }}
              placeholder="Filter by Name"
              className="h-9 w-48 shrink-0 bg-background"
            />
            <RecurringTransactionsFilterPopover
              appliedFilters={appliedFilters}
              onApply={(filters) => {
                setAppliedFilters(filters);
                setAppliedNameFilter(nameFilter);
                setPage(1);
              }}
            />
            <span className="shrink-0 text-sm text-foreground">
              {recurringFilterSummary(appliedFilters)}
            </span>
          </div>

          <div className="flex items-center gap-1 self-end sm:self-auto">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={handlePrint}
              aria-label="Print"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label="Settings"
              onClick={() =>
                toast({ title: "Settings", description: "Customize recurring transaction columns." })
              }
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("templateName")}
                  >
                    Template Name
                    {sortKey === "templateName" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )
                    ) : null}
                  </button>
                </th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Txn Type</th>
                <th className="px-4 py-3">Interval</th>
                <th className="px-4 py-3">Previous Date</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("nextDate")}
                  >
                    Next Date
                    {sortKey === "nextDate" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )
                    ) : null}
                  </button>
                </th>
                <th className="px-4 py-3">Customer/Supplier</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">
                    No recurring transactions match your filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => handleEdit(row)}
                      >
                        {row.templateName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.scheduleType}</td>
                    <td className="px-4 py-3 text-foreground">{row.txnType}</td>
                    <td className="px-4 py-3 text-foreground">{row.interval}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{row.previousDate}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{row.nextDate}</td>
                    <td className="px-4 py-3 text-foreground">{row.customerSupplier}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatRecurringAmount(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto gap-1 px-0 text-primary"
                          >
                            Edit
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleEdit(row)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleUse(row)}>Use</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleDelete(row)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {rangeStart}-{rangeEnd}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-medium",
                "border-primary/30 bg-primary/5 text-primary",
              )}
            >
              {page}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <RecurringTransactionTypeDialog
        open={typeDialogOpen}
        onOpenChange={setTypeDialogOpen}
        onConfirm={handleTypeConfirm}
      />

      <RecurringTemplateFormDialog
        open={templateFormOpen}
        onOpenChange={(open) => {
          setTemplateFormOpen(open);
          if (!open) setEditingTemplate(null);
        }}
        mode={editingTemplate ? "edit" : "create"}
        txnType={pendingTxnType}
        initialValues={
          editingTemplate
            ? editingTemplate
            : {
                templateName: `New ${pendingTxnType}`,
                scheduleType: "Scheduled",
                txnType: pendingTxnType,
                interval: defaultIntervalForType(pendingTxnType),
                ...nextRecurringDates(defaultIntervalForType(pendingTxnType)),
              }
        }
        onSave={handleGenericTemplateSave}
      />

      <ExpenseFormDialog
        open={expenseFormOpen}
        onOpenChange={(open) => {
          setExpenseFormOpen(open);
          if (!open) setEditingTemplate(null);
        }}
        expenseNumber={draftExpenseNumber}
        prefill={expensePrefill}
        recurring
        recurringInitial={recurringInitial}
        onSave={(values) => {
          const action =
            editingTemplate?.txnType === "Expense"
              ? updateTemplateFromForm(editingTemplate, values)
              : createTemplateFromExpense(values);
          void action.then((saved) => {
            if (saved) {
              setExpenseFormOpen(false);
              setEditingTemplate(null);
            }
          });
        }}
      />

      <BillFormDialog
        open={billFormOpen}
        onOpenChange={(open) => {
          setBillFormOpen(open);
          if (!open) setEditingTemplate(null);
        }}
        billNumber={draftBillNumber}
        prefill={billPrefill}
        recurring
        recurringInitial={recurringInitial}
        onSave={(values) => {
          const action =
            editingTemplate?.txnType === "Bill"
              ? updateTemplateFromForm(editingTemplate, values)
              : createTemplateFromBill(values);
          void action.then((saved) => {
            if (saved) {
              setBillFormOpen(false);
              setEditingTemplate(null);
            }
          });
        }}
      />
    </div>
  );
}
