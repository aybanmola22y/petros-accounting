import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import type { ReportDateRange } from "@/lib/report-date-utils";
import { computeExpenseTotal } from "./compute-expenses";
import { computeSalesTotal } from "./compute-sales";
import { monthBucketsInRange } from "./period-ranges";
import type { AccountingBasis } from "./types";

export type RevenueMonthPoint = {
  month: string;
  revenue: number;
  expenses: number;
};

/** Income vs expenses by month — same ledger rules as P&L and sales totals. */
export function computeRevenueByMonth(
  salesTransactions: MockSalesTransaction[],
  expenses: MockExpenseTransaction[],
  range: ReportDateRange,
  basis: AccountingBasis = "Accrual",
): RevenueMonthPoint[] {
  return monthBucketsInRange(range).map((bucket) => ({
    month: bucket.label,
    revenue: computeSalesTotal(salesTransactions, bucket, basis),
    expenses: computeExpenseTotal(expenses, bucket, basis),
  }));
}
