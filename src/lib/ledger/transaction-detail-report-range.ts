import {
  resolveReportRange,
  startOfDay,
  type ReportDateRange,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";
import { dashboardLedgerAnchor } from "./dashboard-ledger-anchor";
import {
  PROFIT_LOSS_DASHBOARD_PERIODS,
  profitLossDashboardPeriodToRange,
  type ProfitLossDashboardPeriod,
} from "./profit-loss-dashboard-periods";

export const TRANSACTION_DETAIL_REPORT_PERIODS = PROFIT_LOSS_DASHBOARD_PERIODS;

/** Period dropdown options including custom date range. */
export const TRANSACTION_DETAIL_REPORT_PERIOD_OPTIONS = [
  ...TRANSACTION_DETAIL_REPORT_PERIODS,
  "Custom dates",
] as const satisfies readonly ReportRangePeriod[];

export function isTransactionDetailReportPeriod(
  period: string | null,
): period is ProfitLossDashboardPeriod {
  return (
    period !== null &&
    (TRANSACTION_DETAIL_REPORT_PERIODS as readonly string[]).includes(period)
  );
}

/** Date range for Transaction Detail by Account — fiscal-aware dashboard presets. */
export function resolveTransactionDetailReportRange(
  period: ReportRangePeriod,
  fromDate: Date,
  toDate: Date,
  anchor = dashboardLedgerAnchor(),
): ReportDateRange {
  if (period === "Custom dates") {
    return {
      from: startOfDay(fromDate),
      to: startOfDay(toDate),
    };
  }
  if (isTransactionDetailReportPeriod(period)) {
    return profitLossDashboardPeriodToRange(period, anchor);
  }
  return resolveReportRange(period, fromDate, toDate, anchor);
}
