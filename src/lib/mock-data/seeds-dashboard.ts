/** Sales line chart — amounts must sum to totalAmount shown on the card. */
export const SEED_SALES_BY_MONTH = [
  { month: "Jan", amount: 698_000 },
  { month: "Feb", amount: 412_000 },
  { month: "Mar", amount: 218_000 },
  { month: "Apr", amount: 385_000 },
  { month: "May", amount: 95_685 },
  { month: "Jun", amount: 142_000 },
] as const;

/** Income vs expenses by month (profit & loss trend / period cards). */
export const SEED_REVENUE_BY_MONTH = [
  { month: "Jan", revenue: 180_000, expenses: 120_000 },
  { month: "Feb", revenue: 220_000, expenses: 140_000 },
  { month: "Mar", revenue: 250_000, expenses: 150_000 },
  { month: "Apr", revenue: 210_000, expenses: 130_000 },
  { month: "May", revenue: 356_800, expenses: 249_743 },
  { month: "Jun", revenue: 150_000, expenses: 120_000 },
] as const;

export const SEED_PAYABLES = {
  openBillsCount: 5,
  overdueBillsCount: 3,
  openBillsAmount: 287_005,
  overdueAmount: 214_870.5,
} as const;

export const SEED_RECENT_TRANSACTIONS = [
  {
    id: "tx-1",
    description: "Client payment — Apple Revillas",
    date: "2026-05-20",
    type: "credit" as const,
    amount: 22_000,
  },
  {
    id: "tx-2",
    description: "Client payment — Globe Business",
    date: "2026-05-18",
    type: "credit" as const,
    amount: 64_684.5,
  },
  {
    id: "tx-3",
    description: "Office supplies",
    date: "2026-05-17",
    type: "debit" as const,
    amount: 234.5,
  },
  {
    id: "tx-4",
    description: "Payroll — May",
    date: "2026-05-15",
    type: "debit" as const,
    amount: 12_500,
  },
] as const;

/** Current period label for KPI cards (matches May in seed months). */
export const DASHBOARD_CURRENT_MONTH = "May";
