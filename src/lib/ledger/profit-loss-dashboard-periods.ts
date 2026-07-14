import {
  daysBetween,
  formatReportRangeLabel,
  resolveReportRange,
  startOfDay,
  type ReportDateRange,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";
import { dashboardLedgerAnchor } from "./dashboard-ledger-anchor";

export const PROFIT_LOSS_DASHBOARD_PERIODS = [
  "Last 30 days",
  "This month",
  "This month to date",
  "This fiscal quarter",
  "This fiscal quarter to date",
  "This financial year",
  "This financial year to date",
  "Last month",
  "Last fiscal quarter",
  "Last financial year",
] as const;

export type ProfitLossDashboardPeriod = (typeof PROFIT_LOSS_DASHBOARD_PERIODS)[number];

/** July–June fiscal year (matches FY26 seed data). */
const FISCAL_YEAR_START_MONTH = 6;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function startOfMonth(date: Date, monthOffset = 0): Date {
  return startOfDay(new Date(date.getFullYear(), date.getMonth() + monthOffset, 1));
}

function endOfMonth(date: Date, monthOffset = 0): Date {
  return startOfDay(new Date(date.getFullYear(), date.getMonth() + monthOffset + 1, 0));
}

function startOfQuarter(date: Date, quarterOffset = 0): Date {
  const month = Math.floor(date.getMonth() / 3) * 3 + quarterOffset * 3;
  const year = date.getFullYear() + Math.floor(month / 12);
  const normalizedMonth = ((month % 12) + 12) % 12;
  return startOfDay(new Date(year, normalizedMonth, 1));
}

function endOfQuarter(date: Date, quarterOffset = 0): Date {
  const start = startOfQuarter(date, quarterOffset);
  return startOfDay(new Date(start.getFullYear(), start.getMonth() + 3, 0));
}

function startOfYear(date: Date, yearOffset = 0): Date {
  return startOfDay(new Date(date.getFullYear() + yearOffset, 0, 1));
}

function endOfYear(date: Date, yearOffset = 0): Date {
  return startOfDay(new Date(date.getFullYear() + yearOffset, 11, 31));
}

export function currentFiscalYearEnd(anchor: Date): number {
  return anchor.getMonth() >= FISCAL_YEAR_START_MONTH
    ? anchor.getFullYear() + 1
    : anchor.getFullYear();
}

export function fiscalYearStartForEnd(fyEndYear: number): Date {
  return startOfDay(new Date(fyEndYear - 1, FISCAL_YEAR_START_MONTH, 1));
}

export function fiscalYearEndForEnd(fyEndYear: number): Date {
  return startOfDay(new Date(fyEndYear, FISCAL_YEAR_START_MONTH, 0));
}

export function fiscalYearLabel(fyEndYear: number): string {
  return `FY${String(fyEndYear).slice(-2)}`;
}

function fiscalQuarterRange(anchor: Date, toDate: boolean): ReportDateRange {
  const fyStart = fiscalYearStartForEnd(currentFiscalYearEnd(anchor));
  const monthOffset =
    (anchor.getFullYear() - fyStart.getFullYear()) * 12 +
    (anchor.getMonth() - fyStart.getMonth());
  const quarterIndex = Math.floor(monthOffset / 3);
  const from = startOfDay(
    new Date(fyStart.getFullYear(), fyStart.getMonth() + quarterIndex * 3, 1),
  );
  const to = toDate
    ? anchor
    : startOfDay(new Date(from.getFullYear(), from.getMonth() + 3, 0));
  return { from, to };
}

function priorFiscalQuarterRange(anchor: Date): ReportDateRange {
  const currentStart = fiscalQuarterRange(anchor, false).from;
  const from = startOfDay(
    new Date(currentStart.getFullYear(), currentStart.getMonth() - 3, 1),
  );
  const to = startOfDay(new Date(currentStart.getFullYear(), currentStart.getMonth(), 0));
  return { from, to };
}

function twoFiscalQuartersAgoRange(anchor: Date): ReportDateRange {
  const currentStart = fiscalQuarterRange(anchor, false).from;
  const from = startOfDay(
    new Date(currentStart.getFullYear(), currentStart.getMonth() - 6, 1),
  );
  const to = startOfDay(
    new Date(currentStart.getFullYear(), currentStart.getMonth() - 3, 0),
  );
  return { from, to };
}

function monthToDatePriorRange(today: Date): ReportDateRange {
  const currentStart = startOfMonth(today);
  const elapsed = daysBetween(currentStart, today);
  const priorStart = startOfMonth(today, -1);
  const priorEnd = endOfMonth(today, -1);
  const priorTo = addDays(priorStart, Math.min(elapsed, daysBetween(priorStart, priorEnd)));
  return { from: priorStart, to: priorTo };
}

function fiscalQuarterToDatePriorRange(today: Date): ReportDateRange {
  const current = fiscalQuarterRange(today, true);
  const elapsed = daysBetween(current.from, today);
  const prior = priorFiscalQuarterRange(today);
  const priorTo = addDays(
    prior.from,
    Math.min(elapsed, daysBetween(prior.from, prior.to)),
  );
  return { from: prior.from, to: priorTo };
}

function fiscalYearToDatePriorRange(today: Date): ReportDateRange {
  const fyEnd = currentFiscalYearEnd(today);
  const currentStart = fiscalYearStartForEnd(fyEnd);
  const elapsed = daysBetween(currentStart, today);
  const priorStart = fiscalYearStartForEnd(fyEnd - 1);
  return { from: priorStart, to: addDays(priorStart, elapsed) };
}

/** Resolve report range with July–June fiscal year/quarter for financial presets. */
export function resolveFiscalAwareReportRange(
  period: ReportRangePeriod,
  anchor = dashboardLedgerAnchor(),
): ReportDateRange {
  const fyEnd = currentFiscalYearEnd(anchor);

  switch (period) {
    case "This fiscal quarter":
      return fiscalQuarterRange(anchor, false);
    case "This fiscal quarter to date":
      return fiscalQuarterRange(anchor, true);
    case "This financial year":
      return { from: fiscalYearStartForEnd(fyEnd), to: fiscalYearEndForEnd(fyEnd) };
    case "This financial year to date":
      return { from: fiscalYearStartForEnd(fyEnd), to: anchor };
    case "This financial year to last month": {
      const fyStart = fiscalYearStartForEnd(fyEnd);
      const lastMonthEnd = endOfMonth(anchor, -1);
      return {
        from: fyStart,
        to: lastMonthEnd.getTime() >= fyStart.getTime() ? lastMonthEnd : anchor,
      };
    }
    case "Last fiscal quarter":
      return priorFiscalQuarterRange(anchor);
    case "Last fiscal quarter to date": {
      const prior = priorFiscalQuarterRange(anchor);
      const elapsed = daysBetween(fiscalQuarterRange(anchor, true).from, anchor);
      return {
        from: prior.from,
        to: addDays(prior.from, Math.min(elapsed, daysBetween(prior.from, prior.to))),
      };
    }
    case "Last financial year": {
      const priorFyEnd = fyEnd - 1;
      return {
        from: fiscalYearStartForEnd(priorFyEnd),
        to: fiscalYearEndForEnd(priorFyEnd),
      };
    }
    case "Last financial year to date": {
      const priorFyEnd = fyEnd - 1;
      const priorStart = fiscalYearStartForEnd(priorFyEnd);
      const priorEnd = fiscalYearEndForEnd(priorFyEnd);
      const elapsed = daysBetween(fiscalYearStartForEnd(fyEnd), anchor);
      return {
        from: priorStart,
        to: addDays(priorStart, Math.min(elapsed, daysBetween(priorStart, priorEnd))),
      };
    }
    case "Next fiscal quarter": {
      const currentEnd = fiscalQuarterRange(anchor, false).to;
      const nextStart = addDays(currentEnd, 1);
      return {
        from: nextStart,
        to: startOfDay(new Date(nextStart.getFullYear(), nextStart.getMonth() + 3, 0)),
      };
    }
    case "Next financial year": {
      const nextFyEnd = fyEnd + 1;
      return {
        from: fiscalYearStartForEnd(nextFyEnd),
        to: fiscalYearEndForEnd(nextFyEnd),
      };
    }
    default:
      return resolveReportRange(period, anchor, anchor, anchor);
  }
}

/** Resolve dashboard P&L widget date range from preset. */
export function profitLossDashboardPeriodToRange(
  period: ProfitLossDashboardPeriod,
  anchor = dashboardLedgerAnchor(),
): ReportDateRange {
  return resolveFiscalAwareReportRange(period, anchor);
}

/** Comparison window for trend % on the dashboard P&L card. */
export function priorProfitLossDashboardRange(
  period: ProfitLossDashboardPeriod,
  current: ReportDateRange,
  anchor = dashboardLedgerAnchor(),
): ReportDateRange {
  const fyEnd = currentFiscalYearEnd(anchor);

  switch (period) {
    case "Last 30 days": {
      const length = daysBetween(current.from, current.to) + 1;
      return {
        from: addDays(current.from, -length),
        to: addDays(current.from, -1),
      };
    }
    case "This month":
      return resolveReportRange("Last month", anchor, anchor, anchor);
    case "This month to date":
      return monthToDatePriorRange(anchor);
    case "This fiscal quarter":
      return priorFiscalQuarterRange(anchor);
    case "This fiscal quarter to date":
      return fiscalQuarterToDatePriorRange(anchor);
    case "This financial year": {
      const priorFyEnd = fyEnd - 1;
      return {
        from: fiscalYearStartForEnd(priorFyEnd),
        to: fiscalYearEndForEnd(priorFyEnd),
      };
    }
    case "This financial year to date":
      return fiscalYearToDatePriorRange(anchor);
    case "Last month":
      return {
        from: startOfMonth(anchor, -2),
        to: endOfMonth(anchor, -2),
      };
    case "Last fiscal quarter":
      return twoFiscalQuartersAgoRange(anchor);
    case "Last financial year": {
      const priorFyEnd = fyEnd - 2;
      return {
        from: fiscalYearStartForEnd(priorFyEnd),
        to: fiscalYearEndForEnd(priorFyEnd),
      };
    }
    default:
      return resolveReportRange("Last month", anchor, anchor, anchor);
  }
}

function fiscalQuarterLabel(range: ReportDateRange): string {
  const fyEnd = currentFiscalYearEnd(range.to);
  const fyStart = fiscalYearStartForEnd(fyEnd);
  const monthOffset =
    (range.to.getFullYear() - fyStart.getFullYear()) * 12 +
    (range.to.getMonth() - fyStart.getMonth());
  const quarter = Math.floor(monthOffset / 3) + 1;
  return `Q${quarter} ${fiscalYearLabel(fyEnd)}`;
}

export function profitLossDashboardPeriodSubtitle(
  period: ProfitLossDashboardPeriod,
  range: ReportDateRange,
): string {
  if (period === "This month" || period === "This month to date" || period === "Last month") {
    const month = range.to.toLocaleDateString("en-US", { month: "long" });
    return `Net profit for ${month}`;
  }

  if (
    period === "This fiscal quarter" ||
    period === "This fiscal quarter to date" ||
    period === "Last fiscal quarter"
  ) {
    return `Net profit for ${fiscalQuarterLabel(range)}`;
  }

  if (period === "This financial year to date") {
    return `Net profit for ${fiscalYearLabel(currentFiscalYearEnd(range.to))} to date`;
  }

  if (period === "This financial year" || period === "Last financial year") {
    return `Net profit for ${fiscalYearLabel(currentFiscalYearEnd(range.to))}`;
  }

  if (period === "Last 30 days") {
    return `Net profit for ${formatReportRangeLabel(range)}`;
  }

  return `Net profit for ${period}`;
}

export function profitLossDashboardTrendLabel(period: ProfitLossDashboardPeriod): string {
  switch (period) {
    case "Last 30 days":
      return "from prior 30 days";
    case "This month":
    case "This month to date":
    case "Last month":
      return "from last month";
    case "This fiscal quarter":
    case "This fiscal quarter to date":
    case "Last fiscal quarter":
      return "from last quarter";
    case "This financial year":
    case "This financial year to date":
      return "from this time in prior year";
    case "Last financial year":
      return "from prior year";
    default:
      return "from prior period";
  }
}
