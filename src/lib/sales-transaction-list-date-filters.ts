import { isDateInRange, parseTransactionDate } from "@/lib/ledger/date-utils";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import {
  resolveReportRange,
  startOfDay,
  type ReportDateRange,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";

/** QuickBooks-style sales transaction list date presets. */
export const SALES_TRANSACTION_DATE_FILTER_OPTIONS = [
  "All",
  "Custom dates",
  "Today",
  "Yesterday",
  "This week",
  "Last week",
  "This month",
  "Last month",
  "Last 30 days",
  "This quarter",
  "Last quarter",
  "Last 3 months",
  "Last 6 months",
  "Last 12 months",
  "Year to date",
  "This year",
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2019",
  "2018",
  "2017",
  "2016",
  "2015",
] as const;

export type SalesTransactionDateFilter = (typeof SALES_TRANSACTION_DATE_FILTER_OPTIONS)[number];

type PresetSalesTransactionDateFilter = Exclude<
  SalesTransactionDateFilter,
  "All" | "Custom dates" | "Last 3 months" | "Last 6 months" | `${number}`
>;

const SALES_DATE_FILTER_TO_REPORT_PERIOD: Record<
  PresetSalesTransactionDateFilter,
  ReportRangePeriod
> = {
  Today: "Today",
  Yesterday: "Yesterday",
  "This week": "This week",
  "Last week": "Last week",
  "This month": "This month",
  "Last month": "Last month",
  "Last 30 days": "Last 30 days",
  "This quarter": "This quarter",
  "Last quarter": "Last quarter",
  "Last 12 months": "Last 12 months",
  "Year to date": "This year to date",
  "This year": "This year",
};

function calendarYearRange(year: number): ReportDateRange {
  return {
    from: startOfDay(new Date(year, 0, 1)),
    to: startOfDay(new Date(year, 11, 31)),
  };
}

/**
 * QuickBooks sales lists include future-dated transactions when using rolling
 * "Last …" presets (upper bound is not capped at today).
 */
function salesListOpenEndedTo(anchor: Date): Date {
  return startOfDay(new Date(anchor.getFullYear() + 100, 11, 31));
}

function rollingMonthsRange(anchor: Date, months: number): ReportDateRange {
  const from = new Date(anchor);
  from.setMonth(from.getMonth() - months);
  return { from: startOfDay(from), to: salesListOpenEndedTo(anchor) };
}

export function salesTransactionListDateRange(
  filter: SalesTransactionDateFilter | string,
  options: {
    customFrom?: Date;
    customTo?: Date;
    asOf?: Date;
  } = {},
): ReportDateRange | null {
  const anchor = startOfDay(options.asOf ?? dashboardLedgerAnchor());

  if (filter === "All") return null;

  if (filter === "Custom dates") {
    if (options.customFrom && options.customTo) {
      return resolveReportRange("Custom dates", options.customFrom, options.customTo, anchor);
    }
    return null;
  }

  if (filter === "Last 3 months") {
    return rollingMonthsRange(anchor, 3);
  }

  if (filter === "Last 6 months") {
    return rollingMonthsRange(anchor, 6);
  }

  const yearMatch = filter.match(/^(\d{4})$/);
  if (yearMatch) {
    return calendarYearRange(Number(yearMatch[1]));
  }

  const mapped = SALES_DATE_FILTER_TO_REPORT_PERIOD[filter as PresetSalesTransactionDateFilter];
  if (mapped) {
    const range = resolveReportRange(mapped, anchor, anchor, anchor);
    // Rolling lookbacks on the sales list keep future-dated rows visible.
    if (
      filter === "Last 30 days" ||
      filter === "Last 12 months"
    ) {
      return { from: range.from, to: salesListOpenEndedTo(anchor) };
    }
    return range;
  }

  return null;
}

export function salesTransactionMatchesDateFilter(
  transactionDate: string,
  filter: SalesTransactionDateFilter | string,
  options: {
    customFrom?: Date;
    customTo?: Date;
    asOf?: Date;
  } = {},
): boolean {
  const range = salesTransactionListDateRange(filter, options);
  if (!range) return true;
  const date = parseTransactionDate(transactionDate);
  return date ? isDateInRange(date, range) : false;
}

export function defaultSalesTransactionCustomDateRange(
  asOf = dashboardLedgerAnchor(),
): ReportDateRange {
  return (
    salesTransactionListDateRange("Last 3 months", { asOf }) ?? {
      from: startOfDay(asOf),
      to: startOfDay(asOf),
    }
  );
}
