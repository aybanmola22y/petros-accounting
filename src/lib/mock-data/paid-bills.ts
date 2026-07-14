import { isDateInRange, parseTransactionDate } from "@/lib/ledger/date-utils";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import {
  addDays,
  resolveReportRange,
  startOfDay,
  type ReportDateRange,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";

export type PaidBill = {
  id: string;
  supplier: string;
  dueDate: string;
  billDate?: string;
  billAmount: number;
  paidAmount: number;
  paidDate: string;
  billNo?: string;
};

export type PaidBillsSummary = {
  amount: number;
  count: number;
};

/** Demo books date — matches seed transaction dates (May–Jun 2026). */
export const PAYABLES_REFERENCE_DATE = new Date(2026, 5, 9);

export function buildSeedPaidBills(): PaidBill[] {
  return [];
}

function paidBillsInLast30Days(
  paidBills: PaidBill[],
  asOf: Date = PAYABLES_REFERENCE_DATE,
): PaidBill[] {
  const end = startOfDay(asOf);
  // QuickBooks Suppliers "Paid last 30 days" includes today and the prior 30 days
  // (31 calendar dates). Example: as of 7/10, window starts 6/10.
  const start = addDays(end, -30);

  return paidBills.filter((bill) => {
    const paid = parseTransactionDate(bill.paidDate);
    return paid ? isDateInRange(paid, { from: start, to: end }) : false;
  });
}

export function computePaidLast30Days(
  paidBills: PaidBill[],
  asOf: Date = PAYABLES_REFERENCE_DATE,
): PaidBillsSummary {
  const inRange = paidBillsInLast30Days(paidBills, asOf);
  return {
    amount: inRange.reduce((sum, bill) => sum + bill.paidAmount, 0),
    count: inRange.length,
  };
}

export function supplierNamesWithPaidBillsLast30Days(
  paidBills: PaidBill[],
  asOf: Date = PAYABLES_REFERENCE_DATE,
): Set<string> {
  return new Set(paidBillsInLast30Days(paidBills, asOf).map((bill) => bill.supplier));
}

/** QuickBooks-style bill date presets on the Bills page. */
export const BILL_DATE_FILTER_OPTIONS = [
  "Custom",
  "Last 7 Days",
  "Last 14 Days",
  "Last 30 Days",
  "Last 90 Days",
  "Last 12 months",
  "Last week",
  "Last month",
  "This month",
  "Last quarter",
  "This quarter",
  "This Year",
  "Last Year",
] as const;

export type BillDateFilter = (typeof BILL_DATE_FILTER_OPTIONS)[number];

const BILL_DATE_FILTER_TO_REPORT_PERIOD: Record<
  Exclude<BillDateFilter, "Custom" | "Last 14 Days">,
  ReportRangePeriod
> = {
  "Last 7 Days": "Last 7 days",
  "Last 30 Days": "Last 30 days",
  "Last 90 Days": "Last 90 days",
  "Last 12 months": "Last 12 months",
  "Last week": "Last week",
  "Last month": "Last month",
  "This month": "This month",
  "Last quarter": "Last quarter",
  "This quarter": "This quarter",
  "This Year": "This year",
  "Last Year": "Last year",
};

export function defaultBillDateRange(
  filter: BillDateFilter = "Last 12 months",
  asOf = dashboardLedgerAnchor(),
): ReportDateRange {
  return billListDateRange(filter, { asOf }) ?? {
    from: startOfDay(asOf),
    to: startOfDay(asOf),
  };
}

export function billListDateRange(
  filter: BillDateFilter | string,
  options: {
    customFrom?: Date;
    customTo?: Date;
    asOf?: Date;
  } = {},
): ReportDateRange | null {
  const asOf = startOfDay(options.asOf ?? dashboardLedgerAnchor());

  if (filter === "Custom") {
    if (options.customFrom && options.customTo) {
      return resolveReportRange("Custom dates", options.customFrom, options.customTo, asOf);
    }
    return null;
  }

  if (filter === "Last 14 Days") {
    const from = new Date(asOf);
    from.setDate(from.getDate() - 13);
    return { from: startOfDay(from), to: asOf };
  }

  const mapped =
    BILL_DATE_FILTER_TO_REPORT_PERIOD[
      filter as Exclude<BillDateFilter, "Custom" | "Last 14 Days">
    ];
  if (mapped) {
    return resolveReportRange(mapped, asOf, asOf, asOf);
  }

  return null;
}

export function formatBillDateRangeLabel(range: ReportDateRange): string {
  const fmt = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  return `${fmt(range.from)}–${fmt(range.to)}`;
}

export function filterPaidBills(
  bills: PaidBill[],
  options: {
    supplier?: string;
    dateRange?: ReportDateRange | null;
    dateField?: "paidDate" | "billDate";
  },
): PaidBill[] {
  const { supplier = "All", dateRange = null, dateField = "billDate" } = options;
  return bills.filter((bill) => {
    if (supplier !== "All" && bill.supplier !== supplier) return false;
    if (!dateRange) return true;
    const raw =
      dateField === "paidDate"
        ? bill.paidDate
        : bill.billDate ?? bill.paidDate;
    const parsed = parseTransactionDate(raw);
    return parsed ? isDateInRange(parsed, dateRange) : false;
  });
}
