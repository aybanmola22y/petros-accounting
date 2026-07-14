import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import {
  EXPENSE_PERIOD_KEY_TO_DASHBOARD,
  type ExpenseCategorySlice,
  type ExpenseDashboardSlice,
  type ExpensePeriodKey,
  type MockExpenseTransaction,
} from "@/lib/mock-data/expenses";
import type { MockExpenseCategory } from "@/lib/mock-data/expense-categories";
import type { ReportDateRange } from "@/lib/report-date-utils";
import { isDateInRange, parseTransactionDate } from "./date-utils";
import { expenseDashboardCategoryLabel } from "./expense-category-display";
import {
  expenseDashboardPeriodLabel,
  expenseDashboardPeriodToRange,
  expenseDashboardTrendLabel,
  priorExpenseDashboardRange,
  type ExpenseDashboardPeriod,
} from "./expense-dashboard-periods";
import { dashboardLedgerAnchor } from "./dashboard-ledger-anchor";
import type { AccountingBasis } from "./types";
import { expenseIncludedForBasis } from "./expense-inclusion";
import {
  expenseAccountIdForExpense,
  isCogsAccount,
  isExpenseAccount,
  isOtherExpenseAccount,
} from "./account-mapping";

export type { ExpenseDashboardPeriod } from "./expense-dashboard-periods";
export { EXPENSE_DASHBOARD_PERIODS } from "./expense-dashboard-periods";

function isExpensePeriodKey(
  period: ExpenseDashboardPeriod | ExpensePeriodKey,
): period is ExpensePeriodKey {
  return Object.prototype.hasOwnProperty.call(EXPENSE_PERIOD_KEY_TO_DASHBOARD, period);
}

function resolveDashboardPeriod(
  period: ExpenseDashboardPeriod | ExpensePeriodKey,
): ExpenseDashboardPeriod {
  return isExpensePeriodKey(period)
    ? EXPENSE_PERIOD_KEY_TO_DASHBOARD[period]
    : period;
}

function inRange(expense: MockExpenseTransaction, range: ReportDateRange): boolean {
  const date = parseTransactionDate(expense.date);
  return date ? isDateInRange(date, range) : false;
}

function countsAsExpense(expense: MockExpenseTransaction, basis: AccountingBasis): boolean {
  return expenseIncludedForBasis(expense, basis);
}

export function computeExpenseTotal(
  expenses: MockExpenseTransaction[],
  range: ReportDateRange,
  basis: AccountingBasis = "Accrual",
): number {
  return expenses
    .filter((expense) => countsAsExpense(expense, basis) && inRange(expense, range))
    .reduce((sum, expense) => sum + expense.total, 0);
}

export type ExpensesBySupplierRow = {
  supplier: string;
  amount: number;
};

/**
 * QuickBooks Expenses by Supplier Summary only includes amounts posted to P&L
 * expense (and COGS / other expense) accounts — not bill payments / AP settlements
 * or purchases coded entirely to balance-sheet accounts.
 */
function countsTowardExpensesBySupplierSummary(
  expense: MockExpenseTransaction,
  chartAccounts: readonly MockChartAccount[],
  basis: AccountingBasis,
): boolean {
  if (!countsAsExpense(expense, basis)) return false;
  if (!expense.payee?.trim()) return false;

  const type = expense.type.trim().toLowerCase();
  if (type.includes("bill payment") || type.includes("bill pay")) return false;
  if (type.includes("purchase order")) return false;
  if (type.includes("transfer") || type.includes("deposit")) return false;

  if (chartAccounts.length === 0) {
    return (
      type === "expense" ||
      type === "bill" ||
      type === "check" ||
      type === "cheque" ||
      type.includes("supplier credit") ||
      type.includes("vendor credit") ||
      type.includes("credit card")
    );
  }

  const accountId = expenseAccountIdForExpense(expense, [...chartAccounts]);
  const account = chartAccounts.find((row) => row.id === accountId);
  if (!account) {
    return type === "expense" || type === "bill" || type === "check" || type === "cheque";
  }

  return (
    isExpenseAccount(account) ||
    isCogsAccount(account) ||
    isOtherExpenseAccount(account)
  );
}

/** Supplier-level expense totals for a period (QuickBooks Expenses by Supplier Summary). */
export function computeExpensesBySupplierSummary(
  expenses: MockExpenseTransaction[],
  range: ReportDateRange,
  basis: AccountingBasis = "Accrual",
  chartAccounts: readonly MockChartAccount[] = [],
): ExpensesBySupplierRow[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    if (!countsTowardExpensesBySupplierSummary(expense, chartAccounts, basis)) continue;
    if (!inRange(expense, range)) continue;
    const supplier = expense.payee.trim() || "Unknown supplier";
    totals.set(supplier, (totals.get(supplier) ?? 0) + expense.total);
  }
  return [...totals.entries()]
    .map(([supplier, amount]) => ({ supplier, amount }))
    .filter((row) => row.amount !== 0)
    .sort((a, b) => a.supplier.localeCompare(b.supplier, undefined, { sensitivity: "base" }));
}

export function computeExpensesByAccount(
  expenses: MockExpenseTransaction[],
  range: ReportDateRange,
  basis: AccountingBasis,
  accountIdForCategory: (category: string) => string,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    if (!countsAsExpense(expense, basis) || !inRange(expense, range)) continue;
    const accountId = accountIdForCategory(expense.category);
    totals.set(accountId, (totals.get(accountId) ?? 0) + expense.total);
  }
  return totals;
}

function expensesInRange(
  expenses: MockExpenseTransaction[],
  range: ReportDateRange,
  basis: AccountingBasis,
): MockExpenseTransaction[] {
  return expenses.filter(
    (expense) => countsAsExpense(expense, basis) && inRange(expense, range),
  );
}

function sumByDisplayCategory(
  items: MockExpenseTransaction[],
  categories?: readonly MockExpenseCategory[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const expense of items) {
    const label = expenseDashboardCategoryLabel(expense.category, categories);
    map.set(label, (map.get(label) ?? 0) + expense.total);
  }
  return map;
}

function buildCategorySlices(
  current: Map<string, number>,
  prior: Map<string, number>,
): ExpenseCategorySlice[] {
  const labels = new Set([...current.keys(), ...prior.keys()]);
  const slices: ExpenseCategorySlice[] = [...labels].map((category) => {
    const amount = current.get(category) ?? 0;
    const prev = prior.get(category) ?? 0;
    const changePercent =
      prev > 0 ? Math.round(((amount - prev) / prev) * 100) : amount > 0 ? 100 : 0;
    return { category, amount, changePercent };
  });
  slices.sort((a, b) => b.amount - a.amount);
  const top = slices.filter((s) => s.amount > 0).slice(0, 5);
  if (top.length === 0) return top;

  const otherAmount = slices.slice(5).reduce((sum, row) => sum + row.amount, 0);
  if (otherAmount > 0) {
    const otherPrior = [...prior.entries()]
      .filter(([key]) => !top.some((row) => row.category === key))
      .reduce((sum, [, value]) => sum + value, 0);
    const otherChange =
      otherPrior > 0
        ? Math.round(((otherAmount - otherPrior) / otherPrior) * 100)
        : 100;

    const existingOtherIndex = top.findIndex((row) => row.category === "Other");
    if (existingOtherIndex >= 0) {
      const existing = top[existingOtherIndex]!;
      const combinedAmount = existing.amount + otherAmount;
      const combinedPrior = (prior.get("Other") ?? 0) + otherPrior;
      top[existingOtherIndex] = {
        category: "Other",
        amount: combinedAmount,
        changePercent:
          combinedPrior > 0
            ? Math.round(((combinedAmount - combinedPrior) / combinedPrior) * 100)
            : combinedAmount > 0
              ? 100
              : 0,
      };
    } else {
      top.push({ category: "Other", amount: otherAmount, changePercent: otherChange });
    }
  }
  return top;
}

/** Expenses card slice — ledger-backed, matches P&L expense rules. */
export function computeExpenseDashboardSlice(
  expenses: MockExpenseTransaction[],
  period: ExpenseDashboardPeriod | ExpensePeriodKey,
  basis: AccountingBasis = "Accrual",
  categories?: readonly MockExpenseCategory[],
): ExpenseDashboardSlice {
  const dashboardPeriod = resolveDashboardPeriod(period);
  const anchor = dashboardLedgerAnchor();
  const range = expenseDashboardPeriodToRange(dashboardPeriod, anchor);
  const priorRange = priorExpenseDashboardRange(dashboardPeriod, range, anchor);
  const currentRows = expensesInRange(expenses, range, basis);
  const priorRows = expensesInRange(expenses, priorRange, basis);
  const total = currentRows.reduce((sum, expense) => sum + expense.total, 0);
  const priorTotal = priorRows.reduce((sum, expense) => sum + expense.total, 0);
  const trendPercent =
    priorTotal > 0 ? Math.round(((total - priorTotal) / priorTotal) * 100) : 0;

  return {
    total,
    trendPercent,
    periodLabel: expenseDashboardPeriodLabel(dashboardPeriod, range),
    trendLabel: expenseDashboardTrendLabel(dashboardPeriod, anchor),
    categories: buildCategorySlices(
      sumByDisplayCategory(currentRows, categories),
      sumByDisplayCategory(priorRows, categories),
    ),
  };
}
