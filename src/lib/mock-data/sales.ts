import { computeSalesDashboardSlice } from "@/lib/ledger/compute-sales";
import { SEED_SALES_BY_MONTH } from "./seeds-dashboard";

export type MockSalesTransaction = {
  id: string;
  date: string;
  type:
    | "Payment"
    | "Invoice"
    | "Sales receipt"
    | "Estimate"
    | "Credit Note"
    | "Refund"
    | "Charge"
    | "Journal Entry"
    | "Change order";
  number: string;
  customer: string;
  memo: string;
  amount: number;
  status: { kind: "closed" } | { kind: "unapplied" } | { kind: "overdue"; detail: string };
  /** Raw QuickBooks status from import (paid, overdue, open, etc.). */
  qbStatus?: string;
  /** QuickBooks location (when present on export or enriched from AR detail report). */
  location?: string;
  /** Invoice delivery preference when created in-app. */
  deliveryMethod?: "send_later" | "print_later";
  /** Online delivery failed for this transaction. */
  deliveryError?: boolean;
  /** Receive-payment deposit account (chart of accounts id). */
  depositToAccountId?: string;
  /** Income account name from QuickBooks (e.g. Sales, Sales of Product Income). */
  incomeAccount?: string;
  /** When the row was saved to the ledger (used for dashboard recency). */
  recordedAt?: string;
};

export type SalesPeriod = "year" | "fy-ytd" | "12m" | "q";

export type SalesMonthPoint = {
  month: string;
  amount: number;
};

export type SalesDashboardSlice = {
  totalAmount: number;
  amountLabel: string;
  byMonth: SalesMonthPoint[];
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export const FY26_START = { month: 7, year: 2025 };
export const SALES_CURRENT = { month: 5, year: 2026 };

export const SALES_PERIOD_LABELS: Record<SalesPeriod, string> = {
  year: "Total Amount",
  "fy-ytd": "Total Amount (FY26 to date)",
  "12m": "Total Amount (last 12 months)",
  q: "Total Amount (this quarter)",
};

/** Recent activity on Sales Transactions page. */
const RECENT_SALES: MockSalesTransaction[] = [
  {
    id: "st-1",
    date: "05/21/2026",
    type: "Payment",
    number: "PMT-1842",
    customer: "Ms. Aprlyn Pinca",
    memo: "",
    amount: 15_000,
    status: { kind: "closed" },
  },
  {
    id: "st-2",
    date: "05/21/2026",
    type: "Invoice",
    number: "INV-1204",
    customer: "Apple Revillas",
    memo: "",
    amount: 28_500,
    status: { kind: "overdue", detail: "Overdue 1 day" },
  },
  {
    id: "st-3",
    date: "05/20/2026",
    type: "Payment",
    number: "PMT-1840",
    customer: "Prime Packaging Solutions",
    memo: "",
    amount: 42_000,
    status: { kind: "unapplied" },
  },
  {
    id: "st-4",
    date: "05/20/2026",
    type: "Invoice",
    number: "INV-1201",
    customer: "ABC Logistics Corp.",
    memo: "Q2 freight services",
    amount: 45_200,
    status: { kind: "overdue", detail: "Partially paid, ₱3,500.00 due" },
  },
  {
    id: "st-5",
    date: "05/19/2026",
    type: "Invoice",
    number: "INV-1198",
    customer: "Michelle J. Dumaran",
    memo: "",
    amount: 18_500,
    status: { kind: "overdue", detail: "Overdue 3 days" },
  },
  {
    id: "st-6",
    date: "05/19/2026",
    type: "Payment",
    number: "PMT-1835",
    customer: "Cebu Office Supplies",
    memo: "",
    amount: 12_890.5,
    status: { kind: "closed" },
  },
  {
    id: "st-7",
    date: "05/18/2026",
    type: "Invoice",
    number: "INV-1195",
    customer: "Mr. Hartwell C. Capistrano",
    memo: "",
    amount: 43_062,
    status: { kind: "overdue", detail: "Overdue 5 days" },
  },
  {
    id: "st-8",
    date: "05/18/2026",
    type: "Payment",
    number: "PMT-1831",
    customer: "Globe Business",
    memo: "April retainer",
    amount: 64_684.5,
    status: { kind: "closed" },
  },
  {
    id: "st-9",
    date: "05/17/2026",
    type: "Invoice",
    number: "INV-1190",
    customer: "Manila Water Co.",
    memo: "",
    amount: 8_450,
    status: { kind: "closed" },
  },
  {
    id: "st-10",
    date: "05/16/2026",
    type: "Payment",
    number: "PMT-1828",
    customer: "Juan Dela Cruz",
    memo: "",
    amount: 5_250,
    status: { kind: "unapplied" },
  },
  {
    id: "st-11",
    date: "05/15/2026",
    type: "Invoice",
    number: "INV-1185",
    customer: "Apple Revillas",
    memo: "Design package",
    amount: 12_750,
    status: { kind: "closed" },
  },
  {
    id: "st-12",
    date: "05/14/2026",
    type: "Sales receipt",
    number: "SR-442",
    customer: "Ms. Aprlyn Pinca",
    memo: "",
    amount: 3_200,
    status: { kind: "closed" },
  },
];

function monthInvoice(
  id: string,
  month: number,
  year: number,
  amount: number,
  label: string,
): MockSalesTransaction {
  return {
    id,
    date: `${String(month).padStart(2, "0")}/15/${year}`,
    type: "Invoice",
    number: `INV-Y26-${String(month).padStart(2, "0")}`,
    customer: "Various customers",
    memo: label,
    amount,
    status: { kind: "closed" },
  };
}

/** Monthly recognized income — aligns chart with historical seed curve (accrual / invoice). */
function buildMonthlyIncome(): MockSalesTransaction[] {
  const rows: MockSalesTransaction[] = [];
  SEED_SALES_BY_MONTH.filter((row) => row.month !== "May").forEach((row) => {
    const monthIndex = MONTH_LABELS.indexOf(row.month as (typeof MONTH_LABELS)[number]);
    if (monthIndex < 0) return;
    rows.push(
      monthInvoice(
        `st-y26-${row.month.toLowerCase()}`,
        monthIndex + 1,
        2026,
        row.amount,
        `${row.month} sales`,
      ),
    );
  });
  return rows;
}

export const SEED_SALES_TRANSACTIONS: MockSalesTransaction[] = [
  ...RECENT_SALES,
  ...buildMonthlyIncome(),
];

export function parseSalesDate(
  date: string,
): { month: number; year: number; day: number } | null {
  const long = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (long) {
    return { month: Number(long[1]), day: Number(long[2]), year: Number(long[3]) };
  }
  const short = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (short) {
    return { month: Number(short[1]), day: Number(short[2]), year: 2000 + Number(short[3]) };
  }
  return null;
}

function compareMonthYear(a: { month: number; year: number }, b: { month: number; year: number }) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function isOnOrAfter(d: { month: number; year: number }, start: { month: number; year: number }) {
  return compareMonthYear(d, start) >= 0;
}

function isOnOrBefore(d: { month: number; year: number }, end: { month: number; year: number }) {
  return compareMonthYear(d, end) <= 0;
}

function matchesPeriod(d: { month: number; year: number }, period: SalesPeriod): boolean {
  switch (period) {
    case "year":
      return d.year === 2026;
    case "fy-ytd":
      return isOnOrAfter(d, FY26_START) && isOnOrBefore(d, SALES_CURRENT);
    case "12m":
      return isOnOrAfter(d, { month: 6, year: 2025 }) && isOnOrBefore(d, SALES_CURRENT);
    case "q":
      return d.year === 2026 && d.month >= 4 && d.month <= SALES_CURRENT.month;
    default:
      return false;
  }
}

export function isRecognizedSale(transaction: MockSalesTransaction): boolean {
  if (transaction.type === "Estimate") return false;
  if (transaction.status.kind !== "closed") return false;
  return (
    transaction.type === "Payment" ||
    transaction.type === "Sales receipt" ||
    transaction.type === "Invoice"
  );
}

export function filterSalesByPeriod(
  transactions: MockSalesTransaction[] = [],
  period: SalesPeriod,
): MockSalesTransaction[] {
  return (transactions ?? []).filter((t) => {
    const parsed = parseSalesDate(t.date);
    return parsed ? matchesPeriod(parsed, period) : false;
  });
}

function aggregateByMonth(transactions: MockSalesTransaction[]): SalesMonthPoint[] {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (!isRecognizedSale(t)) continue;
    const parsed = parseSalesDate(t.date);
    if (!parsed) continue;
    const label = MONTH_LABELS[parsed.month - 1] ?? `M${parsed.month}`;
    totals.set(label, (totals.get(label) ?? 0) + t.amount);
  }
  const orderedMonths = MONTH_LABELS.filter((m) => totals.has(m));
  return orderedMonths.map((month) => ({ month, amount: totals.get(month) ?? 0 }));
}

export function computeSalesDashboard(
  transactions: MockSalesTransaction[],
  period: SalesPeriod = "year",
): SalesDashboardSlice {
  return computeSalesDashboardSlice(transactions, period, "Accrual");
}

export function computeDefaultSalesDashboard(
  transactions: MockSalesTransaction[],
): SalesDashboardSlice {
  return computeSalesDashboard(transactions, "year");
}

export function salesChartYMax(byMonth: SalesMonthPoint[]): number {
  const max = Math.max(...byMonth.map((r) => r.amount), 1);
  const step = max > 500_000 ? 175_000 : max > 100_000 ? 50_000 : 25_000;
  return Math.ceil(max / step) * step;
}
