import { dashboardLedgerAnchor } from "./dashboard-ledger-anchor";
import {
  currentFiscalYearEnd,
  fiscalYearLabel,
  resolveFiscalAwareReportRange,
} from "./profit-loss-dashboard-periods";
import type { ReportDateRange, ReportRangePeriod } from "@/lib/report-date-utils";

/** QuickBooks-style sales dashboard period menu. */
export const SALES_DASHBOARD_PERIODS = [
  "Today",
  "This week",
  "This week to date",
  "This fiscal week",
  "This month",
  "This month to date",
  "This quarter",
  "This quarter to date",
  "This fiscal quarter",
  "This fiscal quarter to date",
  "This year",
  "This year to date",
  "This year to last month",
  "This financial year",
  "This financial year to date",
  "This financial year to last month",
  "Last 6 months",
  "Yesterday",
  "Recent",
  "Last week",
  "Last week to date",
  "Last week to today",
  "Last month",
  "Last month to date",
  "Last month to today",
  "Last quarter",
  "Last quarter to date",
  "Last quarter to today",
  "Last fiscal quarter",
  "Last fiscal quarter to date",
  "Last year",
  "Last year to date",
  "Last year to today",
  "Last financial year",
  "Last financial year to date",
  "Last 7 days",
  "Last 30 days",
  "Last 90 days",
  "Last 12 months",
  "Since 30 days ago",
  "Since 60 days ago",
  "Since 90 days ago",
  "Since 365 days ago",
  "Next week",
  "Next 4 weeks",
  "Next month",
  "Next quarter",
  "Next fiscal quarter",
  "Next year",
  "Next financial year",
] as const satisfies readonly ReportRangePeriod[];

export type SalesDashboardPeriod = (typeof SALES_DASHBOARD_PERIODS)[number];

const LEGACY_SALES_PERIOD_MAP = {
  year: "This year",
  "fy-ytd": "This financial year to date",
  "12m": "Last 12 months",
  q: "This fiscal quarter",
} as const satisfies Record<string, SalesDashboardPeriod>;

export type LegacySalesPeriod = keyof typeof LEGACY_SALES_PERIOD_MAP;

export function isLegacySalesPeriod(
  period: SalesDashboardPeriod | LegacySalesPeriod,
): period is LegacySalesPeriod {
  return Object.prototype.hasOwnProperty.call(LEGACY_SALES_PERIOD_MAP, period);
}

export function resolveSalesDashboardPeriod(
  period: SalesDashboardPeriod | LegacySalesPeriod,
): SalesDashboardPeriod {
  return isLegacySalesPeriod(period) ? LEGACY_SALES_PERIOD_MAP[period] : period;
}

export function resolveSalesDashboardRange(
  period: SalesDashboardPeriod | LegacySalesPeriod,
  anchor = dashboardLedgerAnchor(),
): ReportDateRange {
  return resolveFiscalAwareReportRange(resolveSalesDashboardPeriod(period), anchor);
}

export function salesDashboardAmountLabel(
  period: SalesDashboardPeriod,
  anchor = dashboardLedgerAnchor(),
): string {
  switch (period) {
    case "This year":
    case "This year to date":
      return "Total Amount";
    case "This financial year to date":
      return `Total Amount (${fiscalYearLabel(currentFiscalYearEnd(anchor))} to date)`;
    case "This financial year":
      return `Total Amount (${fiscalYearLabel(currentFiscalYearEnd(anchor))})`;
    case "Last 12 months":
      return "Total Amount (last 12 months)";
    case "This fiscal quarter":
    case "This fiscal quarter to date":
      return "Total Amount (this quarter)";
    default:
      return "Total Amount";
  }
}
