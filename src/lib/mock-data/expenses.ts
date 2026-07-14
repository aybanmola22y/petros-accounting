import { computeExpenseDashboardSlice } from "@/lib/ledger/compute-expenses";
import { resolveExpenseCategoryDisplayName } from "@/lib/ledger/expense-category-display";
import { expensePeriodKeyToRange } from "@/lib/ledger/expense-dashboard-periods";
import { isDateInRange, parseTransactionDate } from "@/lib/ledger/date-utils";
import { startOfDay } from "@/lib/report-date-utils";
import type { MockExpenseCategory } from "./expense-categories";

export type MockExpenseTransaction = {
  id: string;
  date: string;
  type: string;
  number: string;
  payee: string;
  /** Only set for transactions created in-app; QuickBooks imports have no status column. */
  status?: "paid" | "pending" | "approved";
  category: string;
  /** Resolved chart-of-accounts id for the expense category (QuickBooks import). */
  categoryAccountId?: string;
  isSplit?: boolean;
  totalBeforeTax: number;
  salesTax: number;
  total: number;
  /** Chart of accounts id used to pay (paid expenses only). */
  paymentAccountId?: string;
  /** When the row was saved to the ledger (used for dashboard recency). */
  recordedAt?: string;
};

export type ExpensePeriodKey = "fy-ytd" | "12m" | "q" | "month";

/** @deprecated Use ExpensePeriodKey */
export type ExpensePeriod = ExpensePeriodKey;

export { EXPENSE_PERIOD_KEY_TO_DASHBOARD } from "@/lib/ledger/expense-dashboard-periods";

export type ExpenseCategorySlice = {
  category: string;
  amount: number;
  changePercent: number;
};

export type ExpenseDashboardSlice = {
  total: number;
  trendPercent: number;
  periodLabel: string;
  trendLabel: string;
  categories: ExpenseCategorySlice[];
};

/** Fiscal year 2026 starts 1 July 2025 (matches QuickBooks-style FY26 label). */
export const FY26_START = { month: 7, year: 2025 };
export const FY25_START = { month: 7, year: 2024 };
/** @deprecated Use live anchor; kept for legacy expense list filters. */
export const DASHBOARD_EXPENSE_MONTH = { month: 5, year: 2026 };

function monthsFromFyStartThroughAnchor(fyStart: { month: number; year: number }): { m: number; y: number }[] {
  const anchor = startOfDay(new Date());
  const months: { m: number; y: number }[] = [];
  let m = fyStart.month;
  let y = fyStart.year;
  const endMonth = anchor.getMonth() + 1;
  const endYear = anchor.getFullYear();

  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push({ m, y });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return months;
}

/** Detail rows shown on the Expenses page (recent activity). */
const RECENT_DETAIL: MockExpenseTransaction[] = [
  {
    id: "exp-1",
    date: "05/21/2026",
    type: "Expense",
    number: "77332",
    payee: "water district",
    status: "paid",
    category: "Utilities",
    totalBeforeTax: 308,
    salesTax: 0,
    total: 308,
  },
  {
    id: "exp-2",
    date: "05/20/2026",
    type: "Expense",
    number: "77328",
    payee: "Paleco",
    status: "paid",
    category: "Utilities",
    totalBeforeTax: 12_450,
    salesTax: 0,
    total: 12_450,
  },
  {
    id: "exp-3",
    date: "05/19/2026",
    type: "Expense",
    number: "77315",
    payee: "Eliza Baac",
    status: "paid",
    category: "Employee Salary",
    totalBeforeTax: 28_500,
    salesTax: 0,
    total: 28_500,
  },
  {
    id: "exp-4",
    date: "05/18/2026",
    type: "Expense",
    number: "77302",
    payee: "Petron Station — Roxas",
    status: "paid",
    category: "Transportation Expenses",
    totalBeforeTax: 4_820.5,
    salesTax: 0,
    total: 4_820.5,
  },
  {
    id: "exp-5",
    date: "05/17/2026",
    type: "Expense",
    number: "77288",
    payee: "Office Depot",
    status: "paid",
    isSplit: true,
    category: "--Split--",
    totalBeforeTax: 2_340,
    salesTax: 280.8,
    total: 2_620.8,
  },
  {
    id: "exp-6",
    date: "05/16/2026",
    type: "Expense",
    number: "77271",
    payee: "Globe Telecom",
    status: "paid",
    category: "Utilities",
    totalBeforeTax: 8_900,
    salesTax: 0,
    total: 8_900,
  },
  {
    id: "exp-7",
    date: "05/15/2026",
    type: "Expense",
    number: "77255",
    payee: "Cebu Landlords Assoc.",
    status: "paid",
    category: "Rent",
    totalBeforeTax: 45_000,
    salesTax: 0,
    total: 45_000,
  },
  {
    id: "exp-8",
    date: "05/14/2026",
    type: "Expense",
    number: "77240",
    payee: "Grab Philippines",
    status: "pending",
    category: "Transportation Expenses",
    totalBeforeTax: 1_250,
    salesTax: 0,
    total: 1_250,
  },
  {
    id: "exp-9",
    date: "05/12/2026",
    type: "Expense",
    number: "77218",
    payee: "Manila Water",
    status: "paid",
    category: "Utilities",
    totalBeforeTax: 1_890,
    salesTax: 0,
    total: 1_890,
  },
  {
    id: "exp-10",
    date: "05/10/2026",
    type: "Expense",
    number: "77195",
    payee: "Juan Dela Cruz",
    status: "paid",
    isSplit: true,
    category: "--Split--",
    totalBeforeTax: 15_200,
    salesTax: 0,
    total: 15_200,
  },
];

function monthEntry(
  id: string,
  month: number,
  year: number,
  category: string,
  payee: string,
  total: number,
  number: string,
): MockExpenseTransaction {
  return {
    id,
    date: `${String(month).padStart(2, "0")}/15/${year}`,
    type: "Expense",
    number,
    payee,
    status: "paid",
    category,
    totalBeforeTax: total,
    salesTax: 0,
    total,
  };
}

/** FY26 & FY25 periodic entries — generated through the current month. */
function buildPeriodicExpenses(): MockExpenseTransaction[] {
  const rows: MockExpenseTransaction[] = [];
  const fy26Months = monthsFromFyStartThroughAnchor(FY26_START);

  const salaryMonthly = 81_431.39;
  const trainerMonthly = 81_131.27;
  const rentMonthly = 24_727.27;
  const utilitiesMonthly = 9_828.3;

  fy26Months.forEach(({ m, y }, i) => {
    const n = 76000 + i;
    rows.push(
      monthEntry(`exp-fy26-sal-${i}`, m, y, "Employee Salary", "Payroll — staff", salaryMonthly, String(n)),
      monthEntry(
        `exp-fy26-trn-${i}`,
        m,
        y,
        "Professional Fees",
        "Trainer/facilitator fees",
        trainerMonthly,
        String(n + 100),
      ),
      monthEntry(`exp-fy26-rent-${i}`, m, y, "Rent", "Office lease", rentMonthly, String(n + 200)),
      monthEntry(`exp-fy26-util-${i}`, m, y, "Utilities", "Utilities bundle", utilitiesMonthly, String(n + 300)),
    );
  });

  rows.push(
    monthEntry("exp-fy26-other-1", 3, 2026, "Office Supplies", "Supplies & misc", 198_000, "76250"),
    monthEntry("exp-fy26-other-2", 4, 2026, "Meals & Entertainment", "Events & travel", 210_000, "76251"),
    monthEntry("exp-fy26-other-3", 4, 2026, "Transportation Expenses", "Fleet & logistics", 188_512.71, "76252"),
  );

  const fy25Months = fy26Months.map(({ m, y }) => ({ m, y: y - 1 }));
  const priorFactor = 0.562;

  fy25Months.forEach(({ m, y }, i) => {
    const n = 75000 + i;
    rows.push(
      monthEntry(
        `exp-fy25-sal-${i}`,
        m,
        y,
        "Employee Salary",
        "Payroll — staff",
        Math.round(salaryMonthly * priorFactor * 100) / 100,
        String(n),
      ),
      monthEntry(
        `exp-fy25-trn-${i}`,
        m,
        y,
        "Professional Fees",
        "Trainer/facilitator fees",
        Math.round(trainerMonthly * priorFactor * 100) / 100,
        String(n + 100),
      ),
      monthEntry(
        `exp-fy25-rent-${i}`,
        m,
        y,
        "Rent",
        "Office lease",
        Math.round(rentMonthly * priorFactor * 100) / 100,
        String(n + 200),
      ),
      monthEntry(
        `exp-fy25-util-${i}`,
        m,
        y,
        "Utilities",
        "Utilities bundle",
        Math.round(utilitiesMonthly * priorFactor * 100) / 100,
        String(n + 300),
      ),
    );
  });

  rows.push(
    monthEntry(
      "exp-fy25-other-1",
      3,
      2025,
      "Office Supplies",
      "Supplies & misc",
      Math.round(198_000 * priorFactor),
      "75250",
    ),
  );

  return rows;
}

export const SEED_EXPENSE_TRANSACTIONS: MockExpenseTransaction[] = [
  ...RECENT_DETAIL,
  ...buildPeriodicExpenses(),
];

export const EXPENSE_CATEGORIES = [
  "Utilities",
  "Transportation Expenses",
  "Employee Salary",
  "Office Supplies",
  "Rent",
  "Meals & Entertainment",
  "Professional Fees",
] as const;

export function parseExpenseDate(date: string): { month: number; year: number; day: number } | null {
  const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return { month: Number(m[1]), day: Number(m[2]), year: Number(m[3]) };
}

export function displayExpenseCategory(category: string): string {
  return resolveExpenseCategoryDisplayName(category);
}

export function filterExpensesByPeriod(
  expenses: MockExpenseTransaction[],
  period: ExpensePeriodKey,
): MockExpenseTransaction[] {
  const range = expensePeriodKeyToRange(period);
  return expenses.filter((expense) => {
    const date = parseTransactionDate(expense.date);
    return date ? isDateInRange(date, range) : false;
  });
}

export const EXPENSE_PERIOD_LABELS: Record<ExpensePeriodKey, string> = {
  "fy-ytd": "Spending for FY26 to date",
  "12m": "Spending for last 12 months",
  q: "Spending this quarter",
  month: "Spending this month",
};

/** Date range options for the Expenses table filter chip and Filter menu. */
export const EXPENSE_DATE_FILTER_OPTIONS: { value: ExpensePeriodKey; chipLabel: string }[] = [
  { value: "12m", chipLabel: "Last 12 months" },
  { value: "fy-ytd", chipLabel: "This financial year to date" },
  { value: "q", chipLabel: "This quarter" },
  { value: "month", chipLabel: "This month" },
];

export function expenseDateChipLabel(period: ExpensePeriodKey): string {
  return (
    EXPENSE_DATE_FILTER_OPTIONS.find((o) => o.value === period)?.chipLabel ?? period
  );
}

export function computeExpenseDashboard(
  expenses: MockExpenseTransaction[],
  period: ExpensePeriodKey = "fy-ytd",
  categories?: readonly MockExpenseCategory[],
): ExpenseDashboardSlice {
  return computeExpenseDashboardSlice(expenses, period, "Accrual", categories);
}

/** Default FY26 slice for dashboard snapshot caching. */
export function computeDefaultExpenseDashboard(
  expenses: MockExpenseTransaction[],
): ExpenseDashboardSlice {
  return computeExpenseDashboard(expenses, "fy-ytd");
}
