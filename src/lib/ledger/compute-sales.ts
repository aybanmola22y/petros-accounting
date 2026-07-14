import {
  type MockSalesTransaction,
  type SalesDashboardSlice,
  type SalesMonthPoint,
} from "@/lib/mock-data/sales";
import type { ReportDateRange } from "@/lib/report-date-utils";
import { isDateInRange, parseTransactionDate } from "./date-utils";
import { dashboardLedgerAnchor } from "./dashboard-ledger-anchor";
import { monthBucketsInRange } from "./period-ranges";
import {
  resolveSalesDashboardPeriod,
  resolveSalesDashboardRange,
  salesDashboardAmountLabel,
  type LegacySalesPeriod,
  type SalesDashboardPeriod,
} from "./sales-dashboard-periods";
import type { AccountingBasis, SalesTotalBreakdown } from "./types";

export type { SalesDashboardPeriod } from "./sales-dashboard-periods";
export { SALES_DASHBOARD_PERIODS } from "./sales-dashboard-periods";

export function countsAsSale(transaction: MockSalesTransaction, basis: AccountingBasis): boolean {
  if (transaction.type === "Estimate") return false;
  if (basis === "Accrual") {
    return transaction.type === "Invoice" || transaction.type === "Sales receipt";
  }
  if (transaction.type === "Sales receipt") return true;
  if (transaction.type === "Payment") return transaction.status.kind === "closed";
  return false;
}

function inRange(transaction: MockSalesTransaction, range: ReportDateRange): boolean {
  const date = parseTransactionDate(transaction.date);
  return date ? isDateInRange(date, range) : false;
}

export function computeSalesTotal(
  transactions: MockSalesTransaction[],
  range: ReportDateRange,
  basis: AccountingBasis = "Accrual",
): number {
  return computeSalesBreakdown(transactions, range, basis).total;
}

export function computeSalesBreakdown(
  transactions: MockSalesTransaction[],
  range: ReportDateRange,
  basis: AccountingBasis = "Accrual",
): SalesTotalBreakdown {
  let invoiceAmount = 0;
  let paymentAmount = 0;
  let salesReceiptAmount = 0;
  let transactionCount = 0;
  for (const transaction of transactions) {
    if (!countsAsSale(transaction, basis) || !inRange(transaction, range)) continue;
    transactionCount += 1;
    if (transaction.type === "Invoice") invoiceAmount += transaction.amount;
    else if (transaction.type === "Payment") paymentAmount += transaction.amount;
    else if (transaction.type === "Sales receipt") salesReceiptAmount += transaction.amount;
  }
  return {
    total: invoiceAmount + paymentAmount + salesReceiptAmount,
    invoiceAmount,
    paymentAmount,
    salesReceiptAmount,
    transactionCount,
    basis,
  };
}

export type SalesByCustomerRow = {
  customer: string;
  amount: number;
};

/** Customer-level sales totals for a period using the same recognition rules as P&L income. */
export function computeSalesByCustomerSummary(
  transactions: MockSalesTransaction[],
  range: ReportDateRange,
  basis: AccountingBasis = "Accrual",
): SalesByCustomerRow[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (!countsAsSale(transaction, basis) || !inRange(transaction, range)) continue;
    const customer = transaction.customer.trim() || "Unknown customer";
    totals.set(customer, (totals.get(customer) ?? 0) + transaction.amount);
  }
  return [...totals.entries()]
    .map(([customer, amount]) => ({ customer, amount }))
    .filter((row) => row.amount !== 0)
    .sort((a, b) => a.customer.localeCompare(b.customer, undefined, { sensitivity: "base" }));
}

/** Monthly sales totals within a range using the same recognition rules as P&L income. */
export function computeSalesByMonth(
  transactions: MockSalesTransaction[],
  range: ReportDateRange,
  basis: AccountingBasis = "Accrual",
): SalesMonthPoint[] {
  return monthBucketsInRange(range).map((bucket) => ({
    month: bucket.label,
    amount: computeSalesTotal(transactions, bucket, basis),
  }));
}

/** Sales card / dashboard slice — ledger-backed, matches P&L accrual income rules. */
export function computeSalesDashboardSlice(
  transactions: MockSalesTransaction[],
  period: SalesDashboardPeriod | LegacySalesPeriod,
  basis: AccountingBasis = "Accrual",
): SalesDashboardSlice {
  const dashboardPeriod = resolveSalesDashboardPeriod(period);
  const anchor = dashboardLedgerAnchor();
  const range = resolveSalesDashboardRange(dashboardPeriod, anchor);
  return {
    totalAmount: computeSalesTotal(transactions, range, basis),
    amountLabel: salesDashboardAmountLabel(dashboardPeriod, anchor),
    byMonth: computeSalesByMonth(transactions, range, basis),
  };
}
