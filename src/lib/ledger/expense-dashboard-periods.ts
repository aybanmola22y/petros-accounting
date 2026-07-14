import {
  formatReportRangeLabel,
  daysBetween,
  resolveReportRange,
  startOfDay,
  type ReportDateRange,
} from "@/lib/report-date-utils";
import { dashboardLedgerAnchor } from "./dashboard-ledger-anchor";
import {
  PROFIT_LOSS_DASHBOARD_PERIODS,
  currentFiscalYearEnd,
  fiscalYearLabel,
  priorProfitLossDashboardRange,
  profitLossDashboardPeriodToRange,
  profitLossDashboardTrendLabel,
  resolveFiscalAwareReportRange,
  type ProfitLossDashboardPeriod,
} from "./profit-loss-dashboard-periods";

export const EXPENSE_DASHBOARD_PERIODS = PROFIT_LOSS_DASHBOARD_PERIODS;
export type ExpenseDashboardPeriod = ProfitLossDashboardPeriod;

/** Short keys used by expense transaction filters. */
export type ExpensePeriodKey = "fy-ytd" | "12m" | "q" | "month";

export const EXPENSE_PERIOD_KEY_TO_DASHBOARD: Record<
  ExpensePeriodKey,
  ExpenseDashboardPeriod
> = {
  "fy-ytd": "This financial year to date",
  "12m": "Last 30 days",
  q: "This fiscal quarter to date",
  month: "This month to date",
};

/** @deprecated Use dashboardLedgerAnchor */
export function expenseLedgerAnchor(): Date {
  return dashboardLedgerAnchor();
}

export function expenseDashboardPeriodToRange(
  period: ExpenseDashboardPeriod,
  anchor = dashboardLedgerAnchor(),
): ReportDateRange {
  return profitLossDashboardPeriodToRange(period, anchor);
}

export function priorExpenseDashboardRange(
  period: ExpenseDashboardPeriod,
  current: ReportDateRange,
  anchor = dashboardLedgerAnchor(),
): ReportDateRange {
  return priorProfitLossDashboardRange(period, current, anchor);
}

function fiscalQuarterLabel(range: ReportDateRange): string {
  const fyEnd = currentFiscalYearEnd(range.to);
  const fyStart = startOfDay(new Date(fyEnd - 1, 6, 1));
  const monthOffset =
    (range.to.getFullYear() - fyStart.getFullYear()) * 12 +
    (range.to.getMonth() - fyStart.getMonth());
  const quarter = Math.floor(monthOffset / 3) + 1;
  return `Q${quarter} ${fiscalYearLabel(fyEnd)}`;
}

export function expenseDashboardPeriodLabel(
  period: ExpenseDashboardPeriod,
  range: ReportDateRange,
): string {
  if (period === "This month" || period === "This month to date" || period === "Last month") {
    const month = range.to.toLocaleDateString("en-US", { month: "long" });
    return `Spending for ${month}`;
  }

  if (
    period === "This fiscal quarter" ||
    period === "This fiscal quarter to date" ||
    period === "Last fiscal quarter"
  ) {
    return `Spending for ${fiscalQuarterLabel(range)}`;
  }

  if (period === "This financial year to date") {
    return `Spending for ${fiscalYearLabel(currentFiscalYearEnd(range.to))} to date`;
  }

  if (period === "This financial year" || period === "Last financial year") {
    return `Spending for ${fiscalYearLabel(currentFiscalYearEnd(range.to))}`;
  }

  if (period === "Last 30 days") {
    return `Spending for ${formatReportRangeLabel(range)}`;
  }

  return `Spending for ${period}`;
}

export function expenseDashboardTrendLabel(
  period: ExpenseDashboardPeriod,
  anchor = dashboardLedgerAnchor(),
): string {
  if (period === "This financial year to date") {
    return `from this time in ${fiscalYearLabel(currentFiscalYearEnd(anchor) - 1)}`;
  }
  return profitLossDashboardTrendLabel(period);
}

export function expensePeriodKeyToRange(
  period: ExpensePeriodKey,
  anchor = dashboardLedgerAnchor(),
): ReportDateRange {
  switch (period) {
    case "12m":
      return resolveReportRange("Last 12 months", anchor, anchor, anchor);
    case "month":
      return resolveReportRange("This month to date", anchor, anchor, anchor);
    case "fy-ytd":
      return resolveFiscalAwareReportRange("This financial year to date", anchor);
    case "q":
      return resolveFiscalAwareReportRange("This fiscal quarter to date", anchor);
    default:
      return resolveReportRange("Last 12 months", anchor, anchor, anchor);
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

export function priorExpensePeriodKeyRange(
  period: ExpensePeriodKey,
  anchor = dashboardLedgerAnchor(),
): ReportDateRange {
  if (period === "12m") {
    const current = expensePeriodKeyToRange(period, anchor);
    const length = daysBetween(current.from, current.to) + 1;
    return {
      from: addDays(current.from, -length),
      to: addDays(current.from, -1),
    };
  }
  const dashboardPeriod = EXPENSE_PERIOD_KEY_TO_DASHBOARD[period];
  const current = expenseDashboardPeriodToRange(dashboardPeriod, anchor);
  return priorExpenseDashboardRange(dashboardPeriod, current, anchor);
}
