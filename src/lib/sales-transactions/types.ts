import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { toIsoDate } from "@/lib/report-date-utils";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";

export type SalesTransactionRow = {
  id: string;
  transaction_date: string;
  transaction_type: string;
  reference_number: string | null;
  customer_name: string | null;
  memo: string | null;
  income_account_name: string | null;
  amount: number | string;
  status: string;
  sort_order: number;
  source_row_number: number | null;
  created_at: string;
  updated_at: string;
};

export type SalesTransactionInsert = {
  transaction_date: string;
  transaction_type: string;
  reference_number?: string | null;
  customer_name?: string | null;
  memo?: string | null;
  income_account_name?: string | null;
  amount: number;
  status: string;
  sort_order?: number;
  source_row_number?: number | null;
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

export function normalizeSalesTransactionType(type: string): MockSalesTransaction["type"] {
  const trimmed = type.trim();
  if (trimmed === "Sales Receipt") return "Sales receipt";
  return trimmed as MockSalesTransaction["type"];
}

export function qbSalesStatusToMock(status: string): MockSalesTransaction["status"] {
  const lower = status.trim().toLowerCase();
  if (lower === "void") return { kind: "closed" };
  if (lower === "unapplied") return { kind: "unapplied" };
  if (lower === "overdue") return { kind: "overdue", detail: "Overdue" };
  if (lower === "open" || lower === "partial") {
    return { kind: "overdue", detail: status.trim() };
  }
  if (lower === "expired") return { kind: "overdue", detail: "Expired" };
  return { kind: "closed" };
}

export function salesTransactionRowToMock(
  row: SalesTransactionRow,
  locationByNumber?: ReadonlyMap<string, string>,
): MockSalesTransaction {
  const number = row.reference_number?.trim() ?? "";
  const location = number ? locationByNumber?.get(number)?.trim() : undefined;

  return {
    id: row.id,
    date: formatMockDate(row.transaction_date),
    type: normalizeSalesTransactionType(row.transaction_type),
    number,
    customer: row.customer_name?.trim() ?? "",
    memo: row.memo?.trim() ?? "",
    location: location || undefined,
    incomeAccount: row.income_account_name?.trim() || undefined,
    amount: Number(row.amount) || 0,
    status: qbSalesStatusToMock(row.status),
    qbStatus: row.status.trim(),
    recordedAt: row.created_at,
  };
}

export function parsedSalesTransactionToInsert(
  row: {
    rowNumber: number;
    date: string;
    transactionType: string;
    referenceNumber: string;
    customer: string;
    memo: string;
    incomeAccount?: string;
    amount: number;
    status: string;
    sortOrder?: number;
  },
): SalesTransactionInsert {
  const parsedDate = parseTransactionDate(row.date);
  const isoDate = parsedDate ? toIsoDate(parsedDate) : row.date;
  const incomeAccount = row.incomeAccount?.trim();

  return {
    transaction_date: isoDate,
    transaction_type: row.transactionType.trim(),
    reference_number: row.referenceNumber.trim() || null,
    customer_name: row.customer.trim() || null,
    memo: row.memo.trim() || null,
    income_account_name: incomeAccount || null,
    amount: row.amount,
    status: row.status.trim() || "open",
    sort_order: row.sortOrder ?? row.rowNumber,
    source_row_number: row.rowNumber,
  };
}
