import { isDateInRange, parseTransactionDate } from "@/lib/ledger/date-utils";
import { startOfDay, subtractYears, type ReportDateRange } from "@/lib/report-date-utils";

export type UnpaidBill = {
  id: string;
  supplier: string;
  dueDate: string;
  billAmount: number;
  openBalance: number;
  statusType: "overdue" | "due_later";
  statusDetail: string;
  billNo?: string;
  creditAvailable?: boolean;
  /** Optional bill detail used when opening the expense form from this row */
  mailingAddress?: string;
  billDate?: string;
  category?: string;
  lineDescription?: string;
};

export type PayablesSummarySlice = {
  amount: number;
  count: number;
};

export type SupplierPayablesSummary = {
  overdue: PayablesSummarySlice;
  openBills: PayablesSummarySlice;
};

/** Case-insensitive supplier name lookup for bill ↔ vendor matching. */
function supplierNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function supplierNameSet(supplierNames: Iterable<string>): Set<string> {
  const names = new Set<string>();
  for (const name of supplierNames) {
    names.add(supplierNameKey(name));
  }
  return names;
}

/** Recompute overdue vs due later from due date (QuickBooks uses due date, not import status). */
export function applyUnpaidBillStatusAsOf(bill: UnpaidBill, asOf: Date): UnpaidBill {
  const due = parseTransactionDate(bill.dueDate);
  if (!due) return bill;
  const overdue = startOfDay(due).getTime() < startOfDay(asOf).getTime();
  return {
    ...bill,
    statusType: overdue ? "overdue" : "due_later",
    statusDetail: overdue ? "Overdue" : "Due later",
  };
}

/** QuickBooks Suppliers: open bills with due dates in the last 365 days. */
export function prepareUnpaidBillsForSupplierDashboard(
  bills: readonly UnpaidBill[],
  asOf: Date,
): UnpaidBill[] {
  const windowStart = subtractYears(startOfDay(asOf), 1);

  return bills
    .map((bill) => applyUnpaidBillStatusAsOf(bill, asOf))
    .filter((bill) => {
      if (bill.openBalance <= 0) return false;
      const due = parseTransactionDate(bill.dueDate);
      if (!due) return true;
      return startOfDay(due).getTime() >= windowStart.getTime();
    });
}

/** Open balance per supplier name from unpaid bills (single source of truth). */
export function openBalanceBySupplierName(bills: UnpaidBill[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const bill of bills) {
    if (bill.openBalance <= 0) continue;
    const key = supplierNameKey(bill.supplier);
    map.set(key, (map.get(key) ?? 0) + bill.openBalance);
  }
  return map;
}

/** Count of open unpaid bills per supplier name. */
export function openBillCountBySupplierName(bills: UnpaidBill[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const bill of bills) {
    if (bill.openBalance <= 0) continue;
    const key = supplierNameKey(bill.supplier);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/** Supplier names on the list that have at least one open unpaid bill. */
export function supplierNamesWithOpenBills(
  supplierNames: Iterable<string>,
  bills: UnpaidBill[],
): Set<string> {
  const keys = supplierNameSet(supplierNames);
  const result = new Set<string>();
  for (const bill of bills) {
    if (bill.openBalance > 0 && keys.has(supplierNameKey(bill.supplier))) {
      result.add(bill.supplier);
    }
  }
  return result;
}

/** Supplier names that have at least one overdue unpaid bill. */
export function overdueSupplierNames(
  supplierNames: Iterable<string>,
  bills: UnpaidBill[],
): Set<string> {
  const keys = supplierNameSet(supplierNames);
  const overdue = new Set<string>();
  for (const bill of bills) {
    if (
      bill.openBalance > 0 &&
      bill.statusType === "overdue" &&
      keys.has(supplierNameKey(bill.supplier))
    ) {
      overdue.add(bill.supplier);
    }
  }
  return overdue;
}

/** Open balance for a supplier: unpaid bills when present, else imported balance. */
export function resolveSupplierOpenBalance(
  supplier: { name: string; openBalance: number },
  bills: UnpaidBill[],
): number {
  const fromBills = openBalanceBySupplierName(bills).get(supplierNameKey(supplier.name));
  if (fromBills !== undefined && fromBills > 0) return fromBills;
  return supplier.openBalance;
}

/** Bills for vendors on the supplier list — same scope as the Bills → Unpaid tab. */
export function billsForSupplierList(
  supplierNames: Iterable<string>,
  bills: UnpaidBill[],
): UnpaidBill[] {
  const keys = supplierNameSet(supplierNames);
  return bills.filter(
    (b) => b.openBalance > 0 && keys.has(supplierNameKey(b.supplier)),
  );
}

/** Payables KPIs — amounts and counts from the same source (bills or supplier balances). */
export function computeSupplierPayablesSummary(
  suppliers: ReadonlyArray<{ name: string; openBalance: number }>,
  bills: UnpaidBill[],
  asOf?: Date,
): SupplierPayablesSummary {
  const prepared = asOf ? prepareUnpaidBillsForSupplierDashboard(bills, asOf) : bills;
  const names = suppliers.map((s) => s.name);
  const relevant = billsForSupplierList(names, prepared);

  if (relevant.length > 0) {
    const overdue = relevant.filter((b) => b.statusType === "overdue");
    return {
      overdue: {
        amount: overdue.reduce((sum, b) => sum + b.openBalance, 0),
        count: overdue.length,
      },
      openBills: {
        amount: relevant.reduce((sum, b) => sum + b.openBalance, 0),
        count: relevant.length,
      },
    };
  }

  const withBalance = suppliers.filter((s) => s.openBalance > 0);
  return {
    overdue: { amount: 0, count: 0 },
    openBills: {
      amount: withBalance.reduce((sum, s) => sum + s.openBalance, 0),
      count: withBalance.length,
    },
  };
}

export function buildSeedUnpaidBills(): UnpaidBill[] {
  return [];
}

export function filterUnpaidBills(
  bills: UnpaidBill[],
  options: {
    supplier?: string;
    dateRange?: ReportDateRange | null;
  },
): UnpaidBill[] {
  const { supplier = "All", dateRange = null } = options;
  return bills.filter((bill) => {
    if (supplier !== "All" && bill.supplier !== supplier) return false;
    if (!dateRange) return true;
    const raw = bill.billDate ?? bill.dueDate;
    const parsed = parseTransactionDate(raw);
    return parsed ? isDateInRange(parsed, dateRange) : false;
  });
}

/** @deprecated Use getUnpaidBillsSnapshot from the mock store. */
export const UNPAID_BILLS = buildSeedUnpaidBills();
