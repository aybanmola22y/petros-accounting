import { isDateInRange, parseTransactionDate } from "@/lib/ledger/date-utils";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import {
  resolveReportRange,
  startOfDay,
  type ReportDateRange,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";

/** QuickBooks-style invoice list date presets. */
export const INVOICE_DATE_FILTER_OPTIONS = [
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

export type InvoiceDateFilter = (typeof INVOICE_DATE_FILTER_OPTIONS)[number];

type PresetInvoiceDateFilter = Exclude<InvoiceDateFilter, "Last 3 months" | `${number}`>;

const INVOICE_DATE_FILTER_TO_REPORT_PERIOD: Record<PresetInvoiceDateFilter, ReportRangePeriod> = {
  Today: "Today",
  Yesterday: "Yesterday",
  "This week": "This week",
  "Last week": "Last week",
  "This month": "This month",
  "Last month": "Last month",
  "Last 30 days": "Last 30 days",
  "This quarter": "This quarter",
  "Last quarter": "Last quarter",
  "Last 6 months": "Last 6 months",
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

export function invoiceListDateRange(
  filter: InvoiceDateFilter | string,
  asOf = dashboardLedgerAnchor(),
): ReportDateRange {
  const anchor = startOfDay(asOf);

  if (filter === "Last 3 months") {
    const from = new Date(anchor);
    from.setMonth(from.getMonth() - 3);
    return { from: startOfDay(from), to: anchor };
  }

  const yearMatch = filter.match(/^(\d{4})$/);
  if (yearMatch) {
    return calendarYearRange(Number(yearMatch[1]));
  }

  const mapped = INVOICE_DATE_FILTER_TO_REPORT_PERIOD[filter as PresetInvoiceDateFilter];
  if (mapped) {
    return resolveReportRange(mapped, anchor, anchor, anchor);
  }

  return resolveReportRange("Last 12 months", anchor, anchor, anchor);
}

export function invoiceMatchesDateFilter(
  invoiceDate: string,
  filter: InvoiceDateFilter | string,
  asOf = dashboardLedgerAnchor(),
): boolean {
  const range = invoiceListDateRange(filter, asOf);
  const date = parseTransactionDate(invoiceDate);
  return date ? isDateInRange(date, range) : false;
}
