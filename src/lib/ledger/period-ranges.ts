import {
  expensePeriodKeyToRange,
  priorExpensePeriodKeyRange,
  type ExpensePeriodKey,
} from "./expense-dashboard-periods";
import { type SalesPeriod } from "@/lib/mock-data/sales";
import { startOfDay, type ReportDateRange } from "@/lib/report-date-utils";
import { dashboardLedgerAnchor } from "./dashboard-ledger-anchor";
import { resolveSalesDashboardRange } from "./sales-dashboard-periods";

export type MonthBucket = {
  label: string;
  from: Date;
  to: Date;
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function salesPeriodEnd(): Date {
  return dashboardLedgerAnchor();
}

/** Map dashboard sales period presets to report date ranges (ledger-backed). */
export function salesPeriodToRange(period: SalesPeriod): ReportDateRange {
  return resolveSalesDashboardRange(period, salesPeriodEnd());
}

/** Chronological month slices within a report range. */
export function monthBucketsInRange(range: ReportDateRange): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  let year = range.from.getFullYear();
  let month = range.from.getMonth();
  const endTime = startOfDay(range.to).getTime();

  while (true) {
    const from = startOfDay(new Date(year, month, 1));
    if (from.getTime() > endTime) break;

    const monthEnd = startOfDay(new Date(year, month + 1, 0));
    const to = monthEnd.getTime() > endTime ? startOfDay(range.to) : monthEnd;
    buckets.push({ label: MONTH_LABELS[month] ?? `M${month + 1}`, from, to });

    if (to.getTime() >= endTime) break;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return buckets;
}

export function expensePeriodToRange(period: ExpensePeriodKey): ReportDateRange {
  return expensePeriodKeyToRange(period);
}

/** Prior window for expense trend comparison. */
export function priorExpensePeriodRange(period: ExpensePeriodKey): ReportDateRange {
  return priorExpensePeriodKeyRange(period);
}
