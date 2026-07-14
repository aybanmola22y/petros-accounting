"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MessageSquare,
  Paperclip,
  Plus,
  Settings2,
  X,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SplitActionButton } from "@/components/split-action-button";
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
  CATEGORY_ACCOUNT_TYPES,
  DEFAULT_EXPENSE_CATEGORY,
  chartAccountDisplayBalance,
  addExpenseCategory,
  addLocation,
  addPaymentMethod,
  getActiveChartAccountsSorted,
  getChartAccountsSnapshot,
  getExpenseCategoriesSnapshot,
  getLocationsSnapshot,
  getPaymentMethodsSnapshot,
  getProductItemClassesSnapshot,
  getProductServicesSnapshot,
  getReceivablesSnapshot,
  subscribeMockStore,
} from "@/lib/mock-data";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";
import { ProductServiceCreateFlow } from "@/components/product-service-create-flow";
import { SupplierSelect } from "@/components/supplier-select";
import {
  ExpenseCategoryLineRow,
  ExpenseItemLineRow,
} from "@/components/expense-form-line-rows";

export type ExpenseCategoryLine = {
  id: string;
  category: string;
  description: string;
  amount: number;
  billable: boolean;
  customerId: string;
  className: string;
};

export type ExpenseItemLine = {
  id: string;
  serviceDate: string;
  productService: string;
  sku: string;
  description: string;
  qty: number;
  rate: number;
  billable: boolean;
  customerId: string;
  className: string;
};

export type RecurringScheduleValues = {
  templateName: string;
  scheduleType: string;
  daysInAdvance: number;
  frequency: "Daily" | "Weekly" | "Monthly" | "Yearly";
  dayType: string;
  dayOfMonth: string;
  weekday: string;
  every: number;
  startDate: string;
  endType: string;
  endDate: string;
  endAfter: number;
};

export type ExpenseFormValues = {
  payee: string;
  supplier: string;
  supplierId: string;
  mailingAddress: string;
  terms: string;
  dueDate: string;
  paymentAccountId: string;
  paymentDate: string;
  paymentMethod: string;
  refNo: string;
  location: string;
  tags: string;
  lines: ExpenseCategoryLine[];
  itemLines: ExpenseItemLine[];
  memo: string;
  schedule?: RecurringScheduleValues;
};

export type BillFormValues = ExpenseFormValues;
export type ChequeFormValues = ExpenseFormValues;

type ExpenseFormVariant = "expense" | "bill" | "cheque";

function formVariantLabel(variant: ExpenseFormVariant) {
  if (variant === "bill") return "Bill";
  if (variant === "cheque") return "Cheque";
  return "Expense";
}

const BILL_TERMS = ["Due on receipt", "Net 15", "Net 30", "Net 60", "Due end of month"] as const;

const ADD_PAYMENT_METHOD_VALUE = "__add_payment_method__";
const ADD_LOCATION_VALUE = "__add_location__";
const ADD_CATEGORY_VALUE = "__add_category__";
const DEFAULT_PAYMENT_METHOD = "Cash";
const DEFAULT_LOCATION = "Head Office - Puerto Princesa City";
const RECURRING_FREQUENCIES = ["Weekly", "Monthly", "Quarterly", "Yearly"] as const;

const SCHEDULE_TYPE_OPTIONS = ["Scheduled", "Reminder", "Unscheduled"] as const;
const SCHEDULE_FREQUENCY_OPTIONS = ["Daily", "Weekly", "Monthly", "Yearly"] as const;
const SCHEDULE_DAY_TYPES = ["day", "first", "second", "third", "fourth", "last"] as const;
const SCHEDULE_WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const SCHEDULE_END_TYPES = ["None", "By", "After"] as const;

function ordinalSuffix(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return "st";
  if (rem10 === 2 && rem100 !== 12) return "nd";
  if (rem10 === 3 && rem100 !== 13) return "rd";
  return "th";
}

const SCHEDULE_MONTH_DAYS = Array.from(
  { length: 31 },
  (_, i) => `${i + 1}${ordinalSuffix(i + 1)}`,
);

function scheduleUnitLabel(frequency: RecurringScheduleValues["frequency"]): string {
  switch (frequency) {
    case "Daily":
      return "day(s)";
    case "Weekly":
      return "week(s)";
    case "Yearly":
      return "year(s)";
    default:
      return "month(s)";
  }
}

function defaultRecurringSchedule(): RecurringScheduleValues {
  return {
    templateName: "",
    scheduleType: "Scheduled",
    daysInAdvance: 0,
    frequency: "Monthly",
    dayType: "day",
    dayOfMonth: "1st",
    weekday: "Monday",
    every: 1,
    startDate: "",
    endType: "None",
    endDate: "",
    endAfter: 1,
  };
}

/** Match table header padding (px-2) so column labels align with field text. */
const LINE_TABLE_CELL = "px-2 py-1.5 align-middle";
const LINE_TABLE_FIELD = "h-9 border-0 bg-transparent px-2 shadow-none";
const LINE_TABLE_DATE_FIELD =
  "h-9 min-w-[7.25rem] border-0 bg-transparent px-2 text-sm shadow-none tabular-nums leading-normal";
const LINE_TABLE_SELECT = "h-9 w-full border-0 bg-transparent px-2 shadow-none";
const LINE_TABLE_CENTER_HEADER = "px-2 py-2 text-center align-middle font-medium";
const LINE_TABLE_CENTER_CELL = "px-2 py-1.5 text-center align-middle";
const LINE_TABLE_CENTER_FIELD =
  "h-9 min-w-[5rem] border-0 bg-transparent px-2 text-center shadow-none tabular-nums";
const LINE_TABLE_CENTER_SELECT = cn(
  LINE_TABLE_SELECT,
  "relative min-w-[9rem] justify-center px-7 [&>span]:line-clamp-1 [&>span]:text-center [&>svg]:absolute [&>svg]:right-2",
);
const LINE_COL_QTY = "min-w-[4.75rem] w-[4.75rem]";
const LINE_COL_RATE = "min-w-[7.5rem] w-[7.5rem]";
const LINE_COL_AMOUNT = "min-w-[9rem] w-[9rem]";
const LINE_COL_BILLABLE = "min-w-[6rem] w-[6rem]";
const LINE_COL_CLASS = "min-w-[10.5rem]";

function todayFormatted() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function todayShort() {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

function newCategoryLine(id?: string, empty = false): ExpenseCategoryLine {
  return {
    id: id ?? `exp-line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: empty ? "" : DEFAULT_EXPENSE_CATEGORY,
    description: "",
    amount: 0,
    billable: false,
    customerId: "",
    className: "",
  };
}

function newItemLine(id?: string): ExpenseItemLine {
  return {
    id: id ?? `exp-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    serviceDate: todayShort(),
    productService: "",
    sku: "",
    description: "",
    qty: 1,
    rate: 0,
    billable: false,
    customerId: "",
    className: "",
  };
}

function itemLineAmount(line: ExpenseItemLine) {
  return (Number(line.qty) || 0) * (Number(line.rate) || 0);
}

function SectionToolbar({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground"
        aria-label={`${title} layout`}
        onClick={() => {}}
      >
        <Settings2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
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
      {hint && (
        <p className="text-sm font-medium tabular-nums text-foreground/80">{hint}</p>
      )}
    </div>
  );
}

type ExpenseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseNumber: string;
  onSave: (values: ExpenseFormValues) => void | Promise<void>;
  onSaveAndNew?: () => string;
  /** When set, opening the dialog pre-fills the form (e.g. paying a bill from Pay bills). */
  prefill?: ExpenseFormValues | null;
  /** Bill uses supplier, terms, and due date. Cheque uses the expense layout with Check payment. */
  variant?: ExpenseFormVariant;
  /** When true, show the QuickBooks-style recurring schedule (interval builder, etc.). */
  recurring?: boolean;
  /** Seeds the recurring schedule fields when editing an existing template. */
  recurringInitial?: RecurringScheduleValues | null;
};

function defaultFormState(
  expenseNumber: string,
  defaultAccountId: string,
  variant: ExpenseFormVariant,
): ExpenseFormValues {
  return {
    payee: "",
    supplier: "",
    supplierId: "",
    mailingAddress: "",
    terms: variant === "bill" ? BILL_TERMS[0] : "",
    dueDate: variant === "bill" ? todayFormatted() : "",
    paymentAccountId: defaultAccountId,
    paymentDate: todayFormatted(),
    paymentMethod: variant === "cheque" ? "Check" : DEFAULT_PAYMENT_METHOD,
    refNo: expenseNumber,
    location: DEFAULT_LOCATION,
    tags: "",
    lines:
      variant === "bill"
        ? [newCategoryLine("line-1", true)]
        : [newCategoryLine("line-1")],
    itemLines: [newItemLine("item-1")],
    memo: "",
  };
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expenseNumber,
  onSave,
  onSaveAndNew,
  prefill = null,
  variant = "expense",
  recurring = false,
  recurringInitial = null,
}: ExpenseFormDialogProps) {
  const isBill = variant === "bill";
  const isCheque = variant === "cheque";
  const formLabel = formVariantLabel(variant);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefillAppliedRef = useRef(false);
  const chartAccounts = useSyncExternalStore(
    subscribeMockStore,
    getChartAccountsSnapshot,
    getChartAccountsSnapshot,
  );
  const paymentMethods = useSyncExternalStore(
    subscribeMockStore,
    getPaymentMethodsSnapshot,
    getPaymentMethodsSnapshot,
  );
  const locations = useSyncExternalStore(
    subscribeMockStore,
    getLocationsSnapshot,
    getLocationsSnapshot,
  );
  const expenseCategories = useSyncExternalStore(
    subscribeMockStore,
    getExpenseCategoriesSnapshot,
    getExpenseCategoriesSnapshot,
  );
  const productServices = useSyncExternalStore(
    subscribeMockStore,
    getProductServicesSnapshot,
    getProductServicesSnapshot,
  );
  const productItemClasses = useSyncExternalStore(
    subscribeMockStore,
    getProductItemClassesSnapshot,
    getProductItemClassesSnapshot,
  );
  const paymentAccounts = useMemo(
    () => getActiveChartAccountsSorted(chartAccounts),
    [chartAccounts],
  );
  const receivables = useSyncExternalStore(
    subscribeMockStore,
    getReceivablesSnapshot,
    getReceivablesSnapshot,
  );

  const defaultAccountId = paymentAccounts[0]?.id ?? "";
  const [categoryOpen, setCategoryOpen] = useState(true);
  const [itemOpen, setItemOpen] = useState(variant === "bill");
  const [paymentAccountSelectOpen, setPaymentAccountSelectOpen] = useState(false);
  const [paymentMethodSelectOpen, setPaymentMethodSelectOpen] = useState(false);
  const [newPaymentMethodOpen, setNewPaymentMethodOpen] = useState(false);
  const [newPaymentMethodName, setNewPaymentMethodName] = useState("");
  const [newPaymentMethodIsCreditCard, setNewPaymentMethodIsCreditCard] = useState(false);
  const [locationSelectOpen, setLocationSelectOpen] = useState(false);
  const [newLocationOpen, setNewLocationOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationIsSub, setNewLocationIsSub] = useState(false);
  const [categorySelectLineId, setCategorySelectLineId] = useState<string | null>(null);
  const [addCategoryForLineId, setAddCategoryForLineId] = useState<string | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryAccountType, setNewCategoryAccountType] = useState<string>("PHPExpense");
  const [newCategoryIsSub, setNewCategoryIsSub] = useState(false);
  const [newCategoryParent, setNewCategoryParent] = useState("");
  const [productServiceSelectLineId, setProductServiceSelectLineId] = useState<string | null>(
    null,
  );
  const [addProductForLineId, setAddProductForLineId] = useState<string | null>(null);
  const [newProductServiceOpen, setNewProductServiceOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringFrequency, setRecurringFrequency] =
    useState<(typeof RECURRING_FREQUENCIES)[number]>("Monthly");
  const [attachments, setAttachments] = useState<{ name: string; size: number }[]>([]);
  const [schedule, setSchedule] = useState<RecurringScheduleValues>(
    () => recurringInitial ?? defaultRecurringSchedule(),
  );
  const [form, setForm] = useState(() =>
    defaultFormState(expenseNumber, defaultAccountId, variant),
  );

  useEffect(() => {
    if (open && recurring) {
      setSchedule(recurringInitial ?? defaultRecurringSchedule());
    }
  }, [open, recurring, recurringInitial]);

  const customers = useMemo(
    () => receivables.customers.map((c) => ({ id: c.id, name: c.name })),
    [receivables.customers],
  );

  const productServiceOptions = useMemo(
    () => productServices.map((p) => ({ id: p.id, name: p.name })),
    [productServices],
  );

  const selectedAccount = useMemo(
    () => chartAccounts.find((a) => a.id === form.paymentAccountId),
    [chartAccounts, form.paymentAccountId],
  );

  const categorySubtotal = useMemo(
    () => form.lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [form.lines],
  );

  const itemSubtotal = useMemo(
    () => form.itemLines.reduce((sum, line) => sum + itemLineAmount(line), 0),
    [form.itemLines],
  );

  const grandTotal = categorySubtotal + itemSubtotal;

  useEffect(() => {
    if (open) {
      if (prefill && !prefillAppliedRef.current) {
        setForm({
          ...prefill,
          paymentAccountId: prefill.paymentAccountId || defaultAccountId,
          refNo: prefill.refNo || expenseNumber,
        });
        prefillAppliedRef.current = true;
        setCategoryOpen(true);
        setItemOpen(variant === "bill");
      } else if (!prefill) {
        setForm(defaultFormState(expenseNumber, defaultAccountId, variant));
        setCategoryOpen(true);
        setItemOpen(variant === "bill");
      }

    } else {
      prefillAppliedRef.current = false;
      setForm(defaultFormState(expenseNumber, defaultAccountId, variant));
      setCategoryOpen(true);
      setItemOpen(variant === "bill");
      setPaymentAccountSelectOpen(false);
      setRecurringOpen(false);
      setNewPaymentMethodOpen(false);
      setNewPaymentMethodName("");
      setNewPaymentMethodIsCreditCard(false);
      setNewLocationOpen(false);
      setNewLocationName("");
      setNewLocationIsSub(false);
      setNewCategoryOpen(false);
      setNewCategoryName("");
      setNewCategoryAccountType("PHPExpense");
      setNewCategoryIsSub(false);
      setNewCategoryParent("");
      setAddCategoryForLineId(null);
      setCategorySelectLineId(null);
      setNewProductServiceOpen(false);
      setAddProductForLineId(null);
      setProductServiceSelectLineId(null);
      setAttachments([]);
    }
  }, [open, prefill, expenseNumber, defaultAccountId, variant]);

  const parentCategoryOptions = useMemo(
    () => expenseCategories.filter((c) => !c.isSubAccount),
    [expenseCategories],
  );

  function handleNewPaymentMethodOpenChange(open: boolean) {
    setNewPaymentMethodOpen(open);
    if (!open) {
      setNewPaymentMethodName("");
      setNewPaymentMethodIsCreditCard(false);
    }
  }

  function saveNewPaymentMethod() {
    const name = newPaymentMethodName.trim();
    if (!name) {
      toast({
        title: "Name required",
        description: "Enter a name for the payment method.",
        variant: "destructive",
      });
      return;
    }
    const created = addPaymentMethod({
      name,
      isCreditCard: newPaymentMethodIsCreditCard,
    });
    if (!created) {
      toast({
        title: "Already exists",
        description: `"${name}" is already in the list.`,
        variant: "destructive",
      });
      return;
    }
    setForm((f) => ({ ...f, paymentMethod: created.name }));
    handleNewPaymentMethodOpenChange(false);
    toast({ title: "Payment method added", description: `${created.name} is ready to use.` });
  }

  function handleNewLocationOpenChange(open: boolean) {
    setNewLocationOpen(open);
    if (!open) {
      setNewLocationName("");
      setNewLocationIsSub(false);
    }
  }

  function saveNewLocation() {
    const name = newLocationName.trim();
    if (!name) {
      toast({
        title: "Location name required",
        description: "Enter a name for the location.",
        variant: "destructive",
      });
      return;
    }
    const created = addLocation({ name, isSubLocation: newLocationIsSub });
    if (!created) {
      toast({
        title: "Already exists",
        description: `"${newLocationIsSub ? `↳ ${name}` : name}" is already in the list.`,
        variant: "destructive",
      });
      return;
    }
    setForm((f) => ({ ...f, location: created.name }));
    handleNewLocationOpenChange(false);
    toast({ title: "Location added", description: `${created.name} is ready to use.` });
  }

  function handleNewCategoryOpenChange(open: boolean) {
    setNewCategoryOpen(open);
    if (!open) {
      setNewCategoryName("");
      setNewCategoryAccountType("PHPExpense");
      setNewCategoryIsSub(false);
      setNewCategoryParent("");
      setAddCategoryForLineId(null);
    }
  }

  function saveNewCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      toast({
        title: "Category name required",
        description: "Enter a name for the category.",
        variant: "destructive",
      });
      return;
    }
    const created = addExpenseCategory({
      name,
      accountType: newCategoryAccountType,
      isSubAccount: newCategoryIsSub,
      parentName: newCategoryIsSub ? newCategoryParent || undefined : undefined,
    });
    if (!created) {
      toast({
        title: "Already exists",
        description: `"${name}" is already in the list.`,
        variant: "destructive",
      });
      return;
    }
    if (addCategoryForLineId) {
      updateLine(addCategoryForLineId, { category: created.name });
    }
    handleNewCategoryOpenChange(false);
    toast({ title: "Category added", description: `${created.displayName} is ready to use.` });
  }

  function handleNewProductServiceOpenChange(open: boolean) {
    setNewProductServiceOpen(open);
    if (!open) setAddProductForLineId(null);
  }

  function handleProductServiceCreated(created: { name: string; sku?: string }) {
    if (addProductForLineId) {
      updateItemLine(addProductForLineId, {
        productService: created.name,
        sku: created.sku ?? "",
      });
    }
  }

  const updateLine = useCallback((id: string, patch: Partial<ExpenseCategoryLine>) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  const handleAddCategoryForLine = useCallback((lineId: string) => {
    setAddCategoryForLineId(lineId);
    setNewCategoryOpen(true);
  }, []);

  function addLine() {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, newCategoryLine(undefined, isBill)],
    }));
  }

  const duplicateLine = useCallback((id: string) => {
    setForm((prev) => {
      const source = prev.lines.find((l) => l.id === id);
      if (!source) return prev;
      return {
        ...prev,
        lines: [...prev.lines, { ...source, id: newCategoryLine().id }],
      };
    });
  }, []);

  const removeLine = useCallback((id: string) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return { ...prev, lines: prev.lines.filter((l) => l.id !== id) };
    });
  }, []);

  function clearLines() {
    setForm((prev) => ({ ...prev, lines: [newCategoryLine(undefined, isBill)] }));
  }

  const updateItemLine = useCallback((id: string, patch: Partial<ExpenseItemLine>) => {
    setForm((prev) => ({
      ...prev,
      itemLines: prev.itemLines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  const handleAddProductForLine = useCallback((lineId: string) => {
    setAddProductForLineId(lineId);
    setNewProductServiceOpen(true);
  }, []);

  function addItemLine() {
    setForm((prev) => ({ ...prev, itemLines: [...prev.itemLines, newItemLine()] }));
  }

  const duplicateItemLine = useCallback((id: string) => {
    setForm((prev) => {
      const source = prev.itemLines.find((l) => l.id === id);
      if (!source) return prev;
      return {
        ...prev,
        itemLines: [...prev.itemLines, { ...source, id: newItemLine().id }],
      };
    });
  }, []);

  const removeItemLine = useCallback((id: string) => {
    setForm((prev) => {
      if (prev.itemLines.length <= 1) return prev;
      return { ...prev, itemLines: prev.itemLines.filter((l) => l.id !== id) };
    });
  }, []);

  function clearItemLines() {
    setForm((prev) => ({ ...prev, itemLines: [newItemLine()] }));
  }

  function buildValues(): ExpenseFormValues {
    return { ...form, schedule: recurring ? schedule : undefined };
  }

  function validateForm(): boolean {
    if (isBill) {
      if (!form.supplier.trim()) {
        toast({
          title: "Supplier required",
          description: "Choose a supplier for this bill.",
          variant: "destructive",
        });
        return false;
      }
    } else if (!form.payee.trim()) {
      toast({
        title: "Payee required",
        description: "Enter who you paid for this expense.",
        variant: "destructive",
      });
      return false;
    }
    if (!isBill && !form.paymentAccountId) {
      toast({
        title: "Payment account required",
        description: "Select the account used to pay.",
        variant: "destructive",
      });
      return false;
    }
    const hasCategoryAmount = form.lines.some((l) => Number(l.amount) > 0);
    const hasItemAmount = form.itemLines.some((l) => itemLineAmount(l) > 0);
    if (!hasCategoryAmount && !hasItemAmount) {
      toast({
        title: "Add line items",
        description: "Enter at least one category or item line with an amount.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  }

  async function persistExpense() {
    setSaving(true);
    try {
      await onSave(buildValues());
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(closeAfter = true) {
    if (!validateForm()) return;
    try {
      await persistExpense();
      if (closeAfter) onOpenChange(false);
      else toast({ title: `${formLabel} saved`, description: `${formLabel} ${form.refNo} saved.` });
    } catch {
      // Parent shows the error toast; keep the dialog open for corrections.
    }
  }

  async function handleSaveAndNew() {
    if (!validateForm()) return;
    try {
      await persistExpense();
      const nextNumber = onSaveAndNew?.() ?? expenseNumber;
      setForm(defaultFormState(nextNumber, defaultAccountId, variant));
      toast({
        title: `${formLabel} saved`,
        description: `Starting ${formLabel.toLowerCase()} ${nextNumber}.`,
      });
    } catch {
      // Parent shows the error toast.
    }
  }

  function openPrintPreview() {
    if (!validateForm()) return;
    const categoryHtml = form.lines
      .filter((l) => Number(l.amount) > 0)
      .map(
        (l) =>
          `<tr><td>${l.category}</td><td>${l.description || "—"}</td><td style="text-align:right">${formatPHP(Number(l.amount))}</td></tr>`,
      )
      .join("");
    const itemHtml = form.itemLines
      .filter((l) => itemLineAmount(l) > 0)
      .map(
        (l) =>
          `<tr><td>${l.productService || "—"}</td><td>${l.qty}</td><td style="text-align:right">${formatPHP(l.rate)}</td><td style="text-align:right">${formatPHP(itemLineAmount(l))}</td></tr>`,
      )
      .join("");
    const win = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
    if (!win) {
      toast({
        title: "Pop-up blocked",
        description: `Allow pop-ups to print this ${formLabel.toLowerCase()}.`,
        variant: "destructive",
      });
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>${formLabel} ${form.refNo}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px;border-bottom:1px solid #ddd}</style></head><body>
      <h1>${formLabel}</h1>
      <p><strong>Payee:</strong> ${form.payee}</p>
      <p><strong>Date:</strong> ${form.paymentDate} &nbsp; <strong>Ref:</strong> ${form.refNo}</p>
      <p><strong>Account:</strong> ${selectedAccount?.name ?? "—"}</p>
      ${categoryHtml ? `<h3>Category</h3><table><thead><tr><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>${categoryHtml}</tbody></table>` : ""}
      ${itemHtml ? `<h3>Items</h3><table><thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${itemHtml}</tbody></table>` : ""}
      <p style="margin-top:16px"><strong>Total:</strong> ${formatPHP(grandTotal)}</p>
      ${form.memo ? `<p><strong>Memo:</strong> ${form.memo}</p>` : ""}
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  function handleAttachments(files: FileList | null) {
    if (!files?.length) return;
    const added = Array.from(files).map((f) => ({ name: f.name, size: f.size }));
    setAttachments((prev) => [...prev, ...added]);
    toast({
      title: "Attachments added",
      description: `${added.length} file${added.length === 1 ? "" : "s"} attached.`,
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[98vh] flex-col gap-0 overflow-hidden p-0",
            "h-[min(920px,98vh)] w-[min(1520px,calc(100vw-2.5rem))] max-w-[min(1520px,calc(100vw-2.5rem))]",
            "[&>button]:hidden",
          )}
        >
          <DialogHeader className="relative shrink-0 flex-row items-center space-y-0 border-b pl-5 pr-3 py-2 min-h-[48px]">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {formLabel}
            </DialogTitle>
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label="Help"
                onClick={() =>
                  toast({
                    title: `${formLabel} help`,
                    description:
                      isBill
                        ? "Add category or product lines for this bill. Save and close posts it to accounts payable."
                        : "Add category lines for each line item. Save and close posts the transaction to your books.",
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
                  const msg = window.prompt(`Send feedback about this ${formLabel.toLowerCase()} screen:`);
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

          <div className="flex flex-1 min-h-0 flex-col">
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {formLabel}
                </p>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {isBill ? "Balance due" : "Total"}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">{formatPHP(grandTotal)}</p>
                </div>
              </div>

              {recurring ? (
                <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Recurring {formLabel}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Template name">
                      <Input
                        className="h-10"
                        placeholder={`Recurring ${formLabel.toLowerCase()}`}
                        value={schedule.templateName}
                        onChange={(e) =>
                          setSchedule((s) => ({ ...s, templateName: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Type">
                      <Select
                        value={schedule.scheduleType}
                        onValueChange={(v) => setSchedule((s) => ({ ...s, scheduleType: v }))}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SCHEDULE_TYPE_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Create in advance">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          className="h-10 w-20"
                          value={schedule.daysInAdvance}
                          onChange={(e) =>
                            setSchedule((s) => ({
                              ...s,
                              daysInAdvance: Number(e.target.value) || 0,
                            }))
                          }
                        />
                        <span className="text-sm text-muted-foreground">days in advance</span>
                      </div>
                    </Field>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <Field label="Interval">
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={schedule.frequency}
                          onValueChange={(v) =>
                            setSchedule((s) => ({
                              ...s,
                              frequency: v as RecurringScheduleValues["frequency"],
                            }))
                          }
                        >
                          <SelectTrigger className="h-10 w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SCHEDULE_FREQUENCY_OPTIONS.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {schedule.frequency === "Monthly" || schedule.frequency === "Yearly" ? (
                          <>
                            <span className="text-sm text-muted-foreground">on</span>
                            <Select
                              value={schedule.dayType}
                              onValueChange={(v) => setSchedule((s) => ({ ...s, dayType: v }))}
                            >
                              <SelectTrigger className="h-10 w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SCHEDULE_DAY_TYPES.map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {d}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {schedule.dayType === "day" ? (
                              <Select
                                value={schedule.dayOfMonth}
                                onValueChange={(v) =>
                                  setSchedule((s) => ({ ...s, dayOfMonth: v }))
                                }
                              >
                                <SelectTrigger className="h-10 w-[90px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                  {SCHEDULE_MONTH_DAYS.map((d) => (
                                    <SelectItem key={d} value={d}>
                                      {d}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Select
                                value={schedule.weekday}
                                onValueChange={(v) =>
                                  setSchedule((s) => ({ ...s, weekday: v }))
                                }
                              >
                                <SelectTrigger className="h-10 w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SCHEDULE_WEEKDAYS.map((d) => (
                                    <SelectItem key={d} value={d}>
                                      {d}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </>
                        ) : null}

                        {schedule.frequency === "Weekly" ? (
                          <>
                            <span className="text-sm text-muted-foreground">on</span>
                            <Select
                              value={schedule.weekday}
                              onValueChange={(v) => setSchedule((s) => ({ ...s, weekday: v }))}
                            >
                              <SelectTrigger className="h-10 w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SCHEDULE_WEEKDAYS.map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {d}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        ) : null}

                        <span className="text-sm text-muted-foreground">of every</span>
                        <Input
                          type="number"
                          min="1"
                          className="h-10 w-16"
                          value={schedule.every}
                          onChange={(e) =>
                            setSchedule((s) => ({ ...s, every: Number(e.target.value) || 1 }))
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {scheduleUnitLabel(schedule.frequency)}
                        </span>
                      </div>
                    </Field>

                    <Field label="Start date">
                      <Input
                        className="h-10 w-[150px]"
                        placeholder="MM/DD/YYYY"
                        value={schedule.startDate}
                        onChange={(e) =>
                          setSchedule((s) => ({ ...s, startDate: e.target.value }))
                        }
                      />
                    </Field>

                    <Field label="End">
                      <div className="flex items-center gap-2">
                        <Select
                          value={schedule.endType}
                          onValueChange={(v) => setSchedule((s) => ({ ...s, endType: v }))}
                        >
                          <SelectTrigger className="h-10 w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SCHEDULE_END_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {schedule.endType === "By" ? (
                          <Input
                            className="h-10 w-[150px]"
                            placeholder="MM/DD/YYYY"
                            value={schedule.endDate}
                            onChange={(e) =>
                              setSchedule((s) => ({ ...s, endDate: e.target.value }))
                            }
                          />
                        ) : null}
                        {schedule.endType === "After" ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              className="h-10 w-16"
                              value={schedule.endAfter}
                              onChange={(e) =>
                                setSchedule((s) => ({
                                  ...s,
                                  endAfter: Number(e.target.value) || 1,
                                }))
                              }
                            />
                            <span className="text-sm text-muted-foreground">occurrences</span>
                          </div>
                        ) : null}
                      </div>
                    </Field>
                  </div>
                </div>
              ) : null}

              {isBill ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Supplier" className="sm:col-span-2">
                    <SupplierSelect
                      value={form.supplier}
                      onValueChange={(name, id) =>
                        setForm((f) => ({
                          ...f,
                          supplier: name,
                          supplierId: id,
                          mailingAddress: f.mailingAddress || name,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Mailing address" className="sm:col-span-2 lg:col-span-3">
                    <Textarea
                      className="min-h-[72px] resize-y"
                      value={form.mailingAddress}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, mailingAddress: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Terms">
                    <Select
                      value={form.terms}
                      onValueChange={(v) => setForm((f) => ({ ...f, terms: v }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILL_TERMS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Bill date">
                    <Input
                      className="h-10"
                      placeholder="MM/DD/YYYY"
                      value={form.paymentDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, paymentDate: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Due date">
                    <Input
                      className="h-10"
                      placeholder="MM/DD/YYYY"
                      value={form.dueDate}
                      onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    />
                  </Field>
                  <Field label="Bill no.">
                    <Input
                      className="h-10"
                      value={form.refNo}
                      onChange={(e) => setForm((f) => ({ ...f, refNo: e.target.value }))}
                    />
                  </Field>
                  <Field label="Location">
                    <Select
                      open={locationSelectOpen}
                      onOpenChange={setLocationSelectOpen}
                      value={form.location}
                      onValueChange={(v) => {
                        if (v === ADD_LOCATION_VALUE) {
                          setLocationSelectOpen(false);
                          setNewLocationOpen(true);
                          return;
                        }
                        setForm((f) => ({ ...f, location: v }));
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[min(360px,var(--radix-select-content-available-height))] p-0">
                        <SelectItem
                          value={ADD_LOCATION_VALUE}
                          className="rounded-none border-b border-border/60 bg-muted/40 py-2.5 pl-3 pr-8 text-primary font-medium focus:bg-muted/60 focus:text-primary"
                        >
                          <span className="flex items-center gap-2">
                            <Plus className="h-4 w-4 shrink-0" />
                            Add new
                          </span>
                        </SelectItem>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.name} className="py-2.5 pl-3 pr-8">
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Payee" className="sm:col-span-2">
                  <SupplierSelect
                    value={form.payee}
                    placeholder="Who did you pay?"
                    onValueChange={(name, id) =>
                      setForm((f) => ({
                        ...f,
                        payee: name,
                        supplier: name,
                        supplierId: id,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Payment account"
                  hint={
                    selectedAccount
                      ? `Balance ${formatPHP(chartAccountDisplayBalance(selectedAccount))}`
                      : undefined
                  }
                >
                  <Select
                    open={paymentAccountSelectOpen}
                    onOpenChange={setPaymentAccountSelectOpen}
                    value={form.paymentAccountId}
                    onValueChange={(v) => setForm((f) => ({ ...f, paymentAccountId: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select account">
                        {selectedAccount
                          ? `${selectedAccount.name} (${selectedAccount.number})`
                          : null}
                      </SelectValue>
                    </SelectTrigger>
                    {paymentAccountSelectOpen ? (
                      <SelectContent className="max-h-[min(360px,var(--radix-select-content-available-height))]">
                        {paymentAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id} className="py-2.5">
                            <span className="flex flex-col gap-0.5">
                              <span className="font-medium leading-snug">{a.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {a.number} · {a.accountType}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    ) : null}
                  </Select>
                </Field>
                {isCheque && (
                  <Field label="Mailing address" className="sm:col-span-2 lg:col-span-3">
                    <Textarea
                      className="min-h-[72px] resize-y"
                      value={form.mailingAddress}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, mailingAddress: e.target.value }))
                      }
                    />
                  </Field>
                )}
                <Field label="Payment date">
                  <Input
                    className="h-10"
                    value={form.paymentDate}
                    onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
                    placeholder="MM/DD/YYYY"
                  />
                </Field>
                <Field label="Payment method">
                  <Select
                    open={paymentMethodSelectOpen}
                    onOpenChange={setPaymentMethodSelectOpen}
                    value={form.paymentMethod}
                    onValueChange={(v) => {
                      if (v === ADD_PAYMENT_METHOD_VALUE) {
                        setPaymentMethodSelectOpen(false);
                        setNewPaymentMethodOpen(true);
                        return;
                      }
                      setForm((f) => ({ ...f, paymentMethod: v }));
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(360px,var(--radix-select-content-available-height))] p-0">
                      <SelectItem
                        value={ADD_PAYMENT_METHOD_VALUE}
                        className="rounded-none border-b border-border/60 bg-muted/40 py-2.5 pl-3 pr-8 text-primary font-medium focus:bg-muted/60 focus:text-primary"
                      >
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4 shrink-0" />
                          Add new
                        </span>
                      </SelectItem>
                      {paymentMethods.map((m) => (
                        <SelectItem key={m.id} value={m.name} className="py-2.5 pl-3 pr-8">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Ref no.">
                  <Input
                    className="h-10"
                    value={form.refNo}
                    onChange={(e) => setForm((f) => ({ ...f, refNo: e.target.value }))}
                  />
                </Field>
                <Field label="Location">
                  <Select
                    open={locationSelectOpen}
                    onOpenChange={setLocationSelectOpen}
                    value={form.location}
                    onValueChange={(v) => {
                      if (v === ADD_LOCATION_VALUE) {
                        setLocationSelectOpen(false);
                        setNewLocationOpen(true);
                        return;
                      }
                      setForm((f) => ({ ...f, location: v }));
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(360px,var(--radix-select-content-available-height))] p-0">
                      <SelectItem
                        value={ADD_LOCATION_VALUE}
                        className="rounded-none border-b border-border/60 bg-muted/40 py-2.5 pl-3 pr-8 text-primary font-medium focus:bg-muted/60 focus:text-primary"
                      >
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4 shrink-0" />
                          Add new
                        </span>
                      </SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.name} className="py-2.5 pl-3 pr-8">
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              )}

              <Field label="Tags">
                <Input
                  className="h-10"
                  placeholder="Start typing to add a tag"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                />
              </Field>

              <Collapsible open={categoryOpen} onOpenChange={setCategoryOpen}>
                <div className="flex items-center gap-2 rounded-lg border bg-card pr-2">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-between px-4 py-3 text-left text-sm font-semibold hover:bg-muted/30 rounded-lg"
                    >
                      <span>Category details</span>
                      {categoryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </CollapsibleTrigger>
                  <SectionToolbar title="Category details" />
                </div>
                <CollapsibleContent className="pt-3 space-y-3">
                  {categoryOpen ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                          <th className="w-8 px-2 py-2" />
                          <th className="w-8 px-2 py-2 font-medium">#</th>
                          <th className="min-w-[140px] px-2 py-2 font-medium">Category</th>
                          <th className="min-w-[160px] px-2 py-2 font-medium">Description</th>
                          <th className={cn(LINE_COL_AMOUNT, LINE_TABLE_CENTER_HEADER)}>
                            Amount (PHP)
                          </th>
                          <th className={cn(LINE_COL_BILLABLE, LINE_TABLE_CENTER_HEADER)}>
                            Billable
                          </th>
                          <th className="min-w-[140px] px-2 py-2 font-medium">Customer</th>
                          <th className={cn(LINE_COL_CLASS, LINE_TABLE_CENTER_HEADER)}>Class</th>
                          <th className="w-20 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {form.lines.map((line, index) => (
                          <ExpenseCategoryLineRow
                            key={line.id}
                            line={line}
                            index={index}
                            isBill={isBill}
                            expenseCategories={expenseCategories}
                            customers={customers}
                            productClasses={productItemClasses}
                            categorySelectLineId={categorySelectLineId}
                            onCategorySelectLineIdChange={setCategorySelectLineId}
                            onUpdateLine={updateLine}
                            onAddCategory={handleAddCategoryForLine}
                            onDuplicateLine={duplicateLine}
                            onRemoveLine={removeLine}
                            canRemove={form.lines.length > 1}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={addLine}>
                      <Plus className="h-4 w-4" />
                      Add lines
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearLines}>
                      Clear all lines
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible open={itemOpen} onOpenChange={setItemOpen}>
                <div className="flex items-center gap-2 rounded-lg border bg-card pr-2">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-between px-4 py-3 text-left text-sm font-semibold hover:bg-muted/30 rounded-lg"
                    >
                      <span>{isBill ? "Product or Services" : "Item details"}</span>
                      {itemOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </CollapsibleTrigger>
                  <SectionToolbar title={isBill ? "Product or Services" : "Item details"} />
                </div>
                <CollapsibleContent className="pt-3 space-y-3">
                  {isBill && itemOpen && (
                    <h3 className="px-1 text-sm font-semibold text-foreground">Product or Services</h3>
                  )}
                  {itemOpen ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <table
                      className={cn(
                        "w-full text-sm",
                        isBill ? "min-w-[1040px]" : "min-w-[1320px]",
                      )}
                    >
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                          <th className="w-8 px-2 py-2" />
                          <th className="w-8 px-2 py-2 font-medium">#</th>
                          <th className="min-w-[128px] whitespace-nowrap px-2 py-2 font-medium">
                            Service Date
                          </th>
                          <th className="min-w-[140px] px-2 py-2 font-medium">Product/service</th>
                          <th className="w-24 px-2 py-2 font-medium">SKU</th>
                          <th className="min-w-[140px] px-2 py-2 font-medium">Description</th>
                          <th className={cn(LINE_COL_QTY, LINE_TABLE_CENTER_HEADER)}>Qty</th>
                          <th className={cn(LINE_COL_RATE, LINE_TABLE_CENTER_HEADER)}>Rate</th>
                          <th className={cn(LINE_COL_AMOUNT, LINE_TABLE_CENTER_HEADER)}>
                            {isBill ? "Amount" : "Amount (PHP)"}
                          </th>
                          {!isBill && (
                            <>
                              <th className={cn(LINE_COL_BILLABLE, LINE_TABLE_CENTER_HEADER)}>Billable</th>
                              <th className="min-w-[140px] px-2 py-2 font-medium">Customer</th>
                            </>
                          )}
                          <th className={cn(LINE_COL_CLASS, LINE_TABLE_CENTER_HEADER)}>Class</th>
                          <th className="sticky right-0 z-10 w-20 bg-muted/40 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {form.itemLines.map((line, index) => (
                          <ExpenseItemLineRow
                            key={line.id}
                            line={line}
                            index={index}
                            isBill={isBill}
                            productServices={productServiceOptions}
                            customers={customers}
                            productClasses={productItemClasses}
                            productServiceSelectLineId={productServiceSelectLineId}
                            onProductServiceSelectLineIdChange={setProductServiceSelectLineId}
                            onUpdateItemLine={updateItemLine}
                            onAddProduct={handleAddProductForLine}
                            onDuplicateItemLine={duplicateItemLine}
                            onRemoveItemLine={removeItemLine}
                            canRemove={form.itemLines.length > 1}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={addItemLine}>
                      <Plus className="h-4 w-4" />
                      Add lines
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearItemLines}>
                      Clear all lines
                    </Button>
                  </div>
                  <div className="flex justify-end border-t pt-3 text-sm">
                    <div className="text-right">
                      <p className="text-muted-foreground">Subtotal</p>
                      <p className="text-lg font-semibold tabular-nums">{formatPHP(grandTotal)}</p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Memo">
                  <Textarea
                    className="min-h-[100px] resize-y"
                    placeholder="Notes visible on reports and registers"
                    value={form.memo}
                    onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                  />
                </Field>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Attachments</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => handleAttachments(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleAttachments(e.dataTransfer.files);
                    }}
                    className="flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40"
                  >
                    <Paperclip className="h-5 w-5" />
                    <span>Drag and drop or click to upload</span>
                    <span className="text-xs">Max 20 MB per file</span>
                  </button>
                  {attachments.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {attachments.map((a) => (
                        <li key={a.name} className="truncate">
                          {a.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 flex-row items-center justify-between gap-3 border-t bg-muted/20 px-6 py-3 sm:justify-between">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="ghost" onClick={openPrintPreview}>
                  Print
                </Button>
                {!recurring ? (
                  <Button type="button" variant="ghost" onClick={() => setRecurringOpen(true)}>
                    Make recurring
                  </Button>
                ) : null}
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
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ProductServiceCreateFlow
        open={newProductServiceOpen}
        onOpenChange={handleNewProductServiceOpenChange}
        onCreated={handleProductServiceCreated}
      />

      <Dialog open={newCategoryOpen} onOpenChange={handleNewCategoryOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Category name">
              <Input
                className="h-10"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Marketing expense"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveNewCategory();
                  }
                }}
              />
            </Field>
            <Field label="Account type">
              <Select
                value={newCategoryAccountType}
                onValueChange={setNewCategoryAccountType}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={newCategoryIsSub}
                onCheckedChange={(v) => setNewCategoryIsSub(v === true)}
              />
              <span className="text-muted-foreground">Is sub-account</span>
            </label>
            {newCategoryIsSub && (
              <Field label="Parent account">
                <Select
                  value={newCategoryParent || undefined}
                  onValueChange={setNewCategoryParent}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select parent" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[min(280px,var(--radix-select-content-available-height))]">
                    {parentCategoryOptions.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleNewCategoryOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveNewCategory}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newLocationOpen} onOpenChange={handleNewLocationOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Location name">
              <Input
                className="h-10"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="e.g. Manila Branch"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveNewLocation();
                  }
                }}
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={newLocationIsSub}
                onCheckedChange={(v) => setNewLocationIsSub(v === true)}
              />
              <span className="text-muted-foreground">Is sub-location</span>
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleNewLocationOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveNewLocation}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newPaymentMethodOpen} onOpenChange={handleNewPaymentMethodOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New payment method</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Name">
              <Input
                className="h-10"
                value={newPaymentMethodName}
                onChange={(e) => setNewPaymentMethodName(e.target.value)}
                placeholder="e.g. InstaPay"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveNewPaymentMethod();
                  }
                }}
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={newPaymentMethodIsCreditCard}
                onCheckedChange={(v) => setNewPaymentMethodIsCreditCard(v === true)}
              />
              <span className="text-muted-foreground">This is a credit card</span>
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleNewPaymentMethodOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveNewPaymentMethod}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Make recurring</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {formLabel} to {form.payee || "payee"} for {formatPHP(grandTotal)} will repeat on a schedule.
          </p>
          <Field label="Frequency">
            <Select
              value={recurringFrequency}
              onValueChange={(v) =>
                setRecurringFrequency(v as (typeof RECURRING_FREQUENCIES)[number])
              }
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
            <Input
              className="h-10"
              value={form.paymentDate}
              onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRecurringOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!validateForm()) return;
                persistExpense();
                setRecurringOpen(false);
                onOpenChange(false);
                toast({
                  title: "Recurring expense scheduled",
                  description: `Repeats ${recurringFrequency.toLowerCase()} for ${form.payee}.`,
                });
              }}
            >
              Create schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BillFormDialog({
  open,
  onOpenChange,
  billNumber,
  onSave,
  onSaveAndNew,
  prefill = null,
  recurring = false,
  recurringInitial = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billNumber: string;
  onSave: (values: BillFormValues) => void | Promise<void>;
  onSaveAndNew?: () => string;
  prefill?: BillFormValues | null;
  recurring?: boolean;
  recurringInitial?: RecurringScheduleValues | null;
}) {
  return (
    <ExpenseFormDialog
      variant="bill"
      open={open}
      onOpenChange={onOpenChange}
      expenseNumber={billNumber}
      onSave={onSave}
      onSaveAndNew={onSaveAndNew}
      prefill={prefill}
      recurring={recurring}
      recurringInitial={recurringInitial}
    />
  );
}

export function ChequeFormDialog({
  open,
  onOpenChange,
  chequeNumber,
  onSave,
  onSaveAndNew,
  prefill = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chequeNumber: string;
  onSave: (values: ChequeFormValues) => void | Promise<void>;
  onSaveAndNew?: () => string;
  prefill?: ChequeFormValues | null;
}) {
  return (
    <ExpenseFormDialog
      variant="cheque"
      open={open}
      onOpenChange={onOpenChange}
      expenseNumber={chequeNumber}
      onSave={onSave}
      onSaveAndNew={onSaveAndNew}
      prefill={prefill}
    />
  );
}
