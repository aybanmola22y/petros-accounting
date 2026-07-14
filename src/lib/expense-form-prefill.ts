import type { ExpenseFormValues } from "@/components/expense-form-dialog";
import type { ItemReceiptFormValues } from "@/components/item-receipt-form-dialog";
import {
  DEFAULT_EXPENSE_CATEGORY,
  formatSupplierAddress,
  type MockExpenseTransaction,
  type MockSupplier,
} from "@/lib/mock-data";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";

const DEFAULT_PAYMENT_METHOD = "Cash";
const DEFAULT_LOCATION = "Head Office - Puerto Princesa City";

function todayFormatted() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function supplierMailingAddress(supplier: MockSupplier): string {
  const formatted = formatSupplierAddress(supplier.profile);
  if (formatted) return formatted;
  return supplier.companyName || supplier.name;
}

function baseSupplierFormFields(
  supplier: MockSupplier,
  documentNumber: string,
  defaultAccountId: string,
): Pick<
  ExpenseFormValues,
  | "payee"
  | "supplier"
  | "supplierId"
  | "mailingAddress"
  | "terms"
  | "dueDate"
  | "paymentAccountId"
  | "paymentDate"
  | "refNo"
  | "location"
  | "tags"
  | "memo"
> {
  return {
    payee: supplier.name,
    supplier: supplier.name,
    supplierId: supplier.id,
    mailingAddress: supplierMailingAddress(supplier),
    terms: supplier.profile?.paymentTerms || "Due on receipt",
    dueDate: todayFormatted(),
    paymentAccountId: defaultAccountId,
    paymentDate: todayFormatted(),
    refNo: documentNumber,
    location: DEFAULT_LOCATION,
    tags: "",
    memo: "",
  };
}

export function buildBillPrefillFromSupplier(
  supplier: MockSupplier,
  billNumber: string,
  defaultAccountId: string,
): ExpenseFormValues {
  return {
    ...baseSupplierFormFields(supplier, billNumber, defaultAccountId),
    paymentMethod: DEFAULT_PAYMENT_METHOD,
    lines: [
      {
        id: `bill-line-${supplier.id}`,
        category: supplier.profile?.defaultExpenseCategory || DEFAULT_EXPENSE_CATEGORY,
        description: "",
        amount: 0,
        billable: false,
        customerId: "",
        className: "",
      },
    ],
    itemLines: [
      {
        id: `bill-item-${supplier.id}`,
        serviceDate: todayFormatted(),
        productService: "",
        sku: "",
        description: "",
        qty: 1,
        rate: 0,
        billable: false,
        customerId: "",
        className: "",
      },
    ],
  };
}

export type SupplierExpensePrefillMode = "expense" | "cheque";

export type ExpenseFormVariant = SupplierExpensePrefillMode | "bill";

export function resolveExpenseFormVariant(transactionType: string): ExpenseFormVariant {
  const type = transactionType.trim().toLowerCase();
  if (type === "bill") return "bill";
  if (type === "check" || type === "cheque") return "cheque";
  return "expense";
}

export function buildExpensePrefillFromTransaction(
  expense: MockExpenseTransaction,
  defaultAccountId: string,
  variant: ExpenseFormVariant = resolveExpenseFormVariant(expense.type),
): ExpenseFormValues {
  const amount = Math.abs(expense.total);
  const category =
    expense.category && expense.category !== "--Split--"
      ? expense.category
      : DEFAULT_EXPENSE_CATEGORY;
  const paymentMethod = variant === "cheque" ? "Check" : DEFAULT_PAYMENT_METHOD;
  const payeeName = expense.payee.trim();

  return {
    payee: payeeName,
    supplier: variant === "bill" ? payeeName : "",
    supplierId: "",
    mailingAddress: payeeName,
    terms: "Due on receipt",
    dueDate: expense.date,
    paymentAccountId: expense.paymentAccountId || defaultAccountId,
    paymentDate: expense.date,
    paymentMethod,
    refNo: expense.number,
    location: DEFAULT_LOCATION,
    tags: "",
    lines: [
      {
        id: `edit-line-${expense.id}-1`,
        category,
        description: "",
        amount,
        billable: false,
        customerId: "",
        className: "",
      },
      {
        id: `edit-line-${expense.id}-2`,
        category: "",
        description: "",
        amount: 0,
        billable: false,
        customerId: "",
        className: "",
      },
    ],
    itemLines: [
      {
        id: `edit-item-${expense.id}-1`,
        serviceDate: expense.date,
        productService: "",
        sku: "",
        description: "",
        qty: 1,
        rate: 0,
        billable: false,
        customerId: "",
        className: "",
      },
      {
        id: `edit-item-${expense.id}-2`,
        serviceDate: expense.date,
        productService: "",
        sku: "",
        description: "",
        qty: 1,
        rate: 0,
        billable: false,
        customerId: "",
        className: "",
      },
    ],
    memo: "",
  };
}

export function buildExpensePrefillFromSupplier(
  supplier: MockSupplier,
  expenseNumber: string,
  defaultAccountId: string,
  mode: SupplierExpensePrefillMode = "expense",
): ExpenseFormValues {
  const paymentMethod =
    mode === "cheque" ? "Check" : DEFAULT_PAYMENT_METHOD;

  return {
    ...baseSupplierFormFields(supplier, expenseNumber, defaultAccountId),
    paymentMethod,
    lines: [
      {
        id: `exp-line-${supplier.id}-1`,
        category: supplier.profile?.defaultExpenseCategory || DEFAULT_EXPENSE_CATEGORY,
        description: "",
        amount: 0,
        billable: false,
        customerId: "",
        className: "",
      },
      {
        id: `exp-line-${supplier.id}-2`,
        category: "",
        description: "",
        amount: 0,
        billable: false,
        customerId: "",
        className: "",
      },
    ],
    itemLines: [
      {
        id: `exp-item-${supplier.id}`,
        serviceDate: todayFormatted(),
        productService: "",
        sku: "",
        description: "",
        qty: 1,
        rate: 0,
        billable: false,
        customerId: "",
        className: "",
      },
      {
        id: `exp-item-${supplier.id}-2`,
        serviceDate: todayFormatted(),
        productService: "",
        sku: "",
        description: "",
        qty: 1,
        rate: 0,
        billable: false,
        customerId: "",
        className: "",
      },
    ],
    memo: "",
  };
}

export function buildItemReceiptPrefillFromSupplier(
  supplier: MockSupplier,
  receiptNumber: string,
): ItemReceiptFormValues {
  return {
    supplier: supplier.name,
    supplierId: supplier.id,
    date: todayFormatted(),
    receiptNo: receiptNumber,
    lines: [
      {
        id: `ir-line-${supplier.id}-1`,
        productService: "",
        sku: "",
        rate: 0,
        qtyReceived: 0,
      },
      {
        id: `ir-line-${supplier.id}-2`,
        productService: "",
        sku: "",
        rate: 0,
        qtyReceived: 0,
      },
    ],
    memo: "",
  };
}

export function buildExpensePrefillFromBill(
  bill: UnpaidBill,
  expenseNumber: string,
  defaultAccountId: string,
): ExpenseFormValues {
  const lineId = `exp-line-bill-${bill.id}`;
  const itemId = `exp-item-bill-${bill.id}`;

  return {
    payee: bill.supplier,
    supplier: bill.supplier,
    supplierId: "",
    mailingAddress: bill.mailingAddress ?? bill.supplier,
    terms: "Due on receipt",
    dueDate: bill.dueDate,
    paymentAccountId: defaultAccountId,
    paymentDate: bill.billDate ?? todayFormatted(),
    paymentMethod: DEFAULT_PAYMENT_METHOD,
    refNo: expenseNumber,
    location: DEFAULT_LOCATION,
    tags: "",
    lines: [
      {
        id: lineId,
        category: bill.category ?? DEFAULT_EXPENSE_CATEGORY,
        description:
          bill.lineDescription ?? `Bill payment — due ${bill.dueDate}`,
        amount: bill.openBalance,
        billable: false,
        customerId: "",
        className: "",
      },
    ],
    itemLines: [
      {
        id: itemId,
        serviceDate: bill.billDate ?? todayFormatted(),
        productService: "",
        sku: "",
        description: "",
        qty: 1,
        rate: 0,
        billable: false,
        customerId: "",
        className: "",
      },
    ],
    memo: bill.mailingAddress
      ? `Supplier: ${bill.mailingAddress}\nDue: ${bill.dueDate}`
      : `Bill payment — due ${bill.dueDate}`,
  };
}
