import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { toIsoDate } from "@/lib/report-date-utils";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";

export type UnpaidBillRow = {
  id: string;
  supplier_id: string | null;
  supplier_name: string;
  due_date: string;
  bill_amount: number | string;
  open_balance: number | string;
  status: string;
  sort_order: number;
  source_row_number: number | null;
  bill_no?: string | null;
  created_at: string;
  updated_at: string;
};

export type UnpaidBillInsert = {
  supplier_id?: string | null;
  supplier_name: string;
  due_date: string;
  bill_amount: number;
  open_balance: number;
  status: string;
  sort_order?: number;
  source_row_number?: number | null;
  bill_no?: string | null;
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

function statusToMockFields(status: string): Pick<UnpaidBill, "statusType" | "statusDetail"> {
  const lower = status.trim().toLowerCase();
  if (lower === "overdue") {
    return { statusType: "overdue", statusDetail: "Overdue" };
  }
  if (lower === "due later") {
    return { statusType: "due_later", statusDetail: "Due later" };
  }
  return {
    statusType: lower.includes("overdue") ? "overdue" : "due_later",
    statusDetail: status.trim() || "Open",
  };
}

export function unpaidBillRowToMock(row: UnpaidBillRow): UnpaidBill {
  const statusFields = statusToMockFields(row.status);
  return {
    id: row.id,
    supplier: row.supplier_name.trim(),
    dueDate: formatMockDate(row.due_date),
    billAmount: Number(row.bill_amount) || 0,
    openBalance: Number(row.open_balance) || 0,
    ...statusFields,
    billNo: row.bill_no?.trim() || undefined,
  };
}

export function parsedUnpaidBillToInsert(
  row: {
    rowNumber: number;
    supplierName: string;
    dueDate: string;
    billAmount: number;
    openBalance: number;
    status: string;
    supplierId?: string | null;
    sortOrder?: number;
    billNo?: string;
  },
): UnpaidBillInsert {
  const parsedDate = parseTransactionDate(row.dueDate);
  const isoDate = parsedDate ? toIsoDate(parsedDate) : row.dueDate;

  return {
    supplier_id: row.supplierId ?? null,
    supplier_name: row.supplierName.trim(),
    due_date: isoDate,
    bill_amount: row.billAmount,
    open_balance: row.openBalance,
    status: row.status.trim() || "Open",
    sort_order: row.sortOrder ?? row.rowNumber,
    source_row_number: row.rowNumber,
    bill_no: row.billNo?.trim() || null,
  };
}
