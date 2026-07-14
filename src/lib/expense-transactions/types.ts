import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { toIsoDate } from "@/lib/report-date-utils";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";

export type ExpenseTransactionRow = {
  id: string;
  transaction_date: string;
  transaction_type: string;
  reference_number: string | null;
  payee: string | null;
  category: string | null;
  category_account_id: string | null;
  total_before_tax: number | string;
  sales_tax: number | string;
  total: number | string;
  is_split: boolean;
  payment_account_id: string | null;
  status: string | null;
  sort_order: number;
  source_row_number: number | null;
  import_date_repaired?: boolean | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseTransactionInsert = {
  transaction_date: string;
  transaction_type: string;
  reference_number?: string | null;
  payee?: string | null;
  category?: string | null;
  category_account_id?: string | null;
  total_before_tax?: number;
  sales_tax?: number;
  total: number;
  is_split?: boolean;
  payment_account_id?: string | null;
  status?: string | null;
  sort_order?: number;
  source_row_number?: number | null;
  import_date_repaired?: boolean;
};

function formatMockDate(isoDate: string): string {
  const isoPrefix = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) {
    const year = Number(isoPrefix[1]);
    const month = Number(isoPrefix[2]);
    const day = Number(isoPrefix[3]);
    return `${month}/${day}/${year}`;
  }

  const parsed = parseTransactionDate(isoDate);
  if (!parsed || Number.isNaN(parsed.getTime())) return isoDate;
  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();
  const year = parsed.getFullYear();
  return `${month}/${day}/${year}`;
}

export function expenseTransactionRowToMock(row: ExpenseTransactionRow): MockExpenseTransaction {
  const status = row.status?.trim();
  const normalizedStatus: MockExpenseTransaction["status"] | undefined =
    status === "pending" || status === "approved" || status === "paid" ? status : undefined;

  return {
    id: row.id,
    date: formatMockDate(row.transaction_date),
    type: row.transaction_type,
    number: row.reference_number?.trim() ?? "",
    payee: row.payee?.trim() ?? "",
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    category: row.category?.trim() ?? "",
    categoryAccountId: row.category_account_id ?? undefined,
    isSplit: row.is_split,
    totalBeforeTax: Number(row.total_before_tax) || 0,
    salesTax: Number(row.sales_tax) || 0,
    total: Number(row.total) || 0,
    paymentAccountId: row.payment_account_id ?? undefined,
  };
}

export function parsedExpenseToInsert(
  row: {
    rowNumber: number;
    date: string;
    transactionType: string;
    referenceNumber: string;
    payee: string;
    category: string;
    totalBeforeTax: number;
    salesTax: number;
    total: number;
    isSplit: boolean;
    status?: string | null;
    categoryAccountId?: string | null;
    sortOrder?: number;
  },
): ExpenseTransactionInsert {
  const parsedDate = parseTransactionDate(row.date);
  const isoDate = parsedDate ? toIsoDate(parsedDate) : row.date;

  const insert: ExpenseTransactionInsert = {
    transaction_date: isoDate,
    transaction_type: row.transactionType.trim(),
    reference_number: row.referenceNumber.trim() || null,
    payee: row.payee.trim() || null,
    category: row.category.trim() || null,
    category_account_id: row.categoryAccountId ?? null,
    total_before_tax: row.totalBeforeTax,
    sales_tax: row.salesTax,
    total: row.total,
    is_split: row.isSplit,
    sort_order: row.sortOrder ?? row.rowNumber,
    source_row_number: row.rowNumber,
    // import_date_repaired is set by the repository when that column exists.
  };

  // QuickBooks exports have no status column. Omit the field when unknown so the
  // database default applies (paid) or NULL is stored on nullable schemas.
  const status = row.status?.trim();
  if (status) insert.status = status;

  return insert;
}
