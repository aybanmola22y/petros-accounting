import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import type {
  ImportedProfitLossAccountRow,
  ProfitLossSection,
} from "@/lib/profit-loss-summary-import";
import type { ReportLine } from "@/views/financial-report-shared";
import {
  isCogsAccount,
  isExpenseAccount,
  isOperatingIncomeAccount,
  isOtherExpenseAccount,
  isOtherIncomeAccount,
} from "./account-mapping";
import { buildBookkeepingEntries } from "./build-bookkeeping-entries";
import { countsAsSale } from "./compute-sales";
import { isDateInRange, parseTransactionDate } from "./date-utils";
import { expenseIncludedForBasis } from "./expense-inclusion";
import type { LedgerEntry, ProfitLossInput } from "./types";

function filterProfitLossTransactions(input: ProfitLossInput): {
  sales: MockSalesTransaction[];
  expenses: MockExpenseTransaction[];
} {
  const sales = input.salesTransactions.filter((transaction) => {
    const date = parseTransactionDate(transaction.date);
    if (!date || !isDateInRange(date, input.range)) return false;
    return countsAsSale(transaction, input.basis);
  });

  const expenses = input.expenses.filter((expense) => {
    const date = parseTransactionDate(expense.date);
    if (!date || !isDateInRange(date, input.range)) return false;
    return expenseIncludedForBasis(expense, input.basis);
  });

  return { sales, expenses };
}

function plAmountForAccount(
  entries: LedgerEntry[],
  accountId: string,
  isIncome: boolean,
): number {
  const net = entries
    .filter((entry) => entry.accountId === accountId)
    .reduce((sum, entry) => sum + entry.debit - entry.credit, 0);
  return isIncome ? -net : net;
}

function compareAccounts(a: MockChartAccount, b: MockChartAccount): number {
  const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return a.name.localeCompare(b.name);
}

function accountSection(
  account: MockChartAccount,
): { section: ProfitLossSection; isIncome: boolean } | null {
  if (isOperatingIncomeAccount(account)) {
    return { section: "income", isIncome: true };
  }
  if (isOtherIncomeAccount(account)) {
    return { section: "other_income", isIncome: true };
  }
  if (isCogsAccount(account)) {
    return { section: "cost_of_sales", isIncome: false };
  }
  if (isExpenseAccount(account)) {
    return { section: "expenses", isIncome: false };
  }
  if (isOtherExpenseAccount(account)) {
    return { section: "other_expenses", isIncome: false };
  }
  return null;
}

function accountLines(
  accounts: MockChartAccount[],
  entries: LedgerEntry[],
  section: ProfitLossSection,
  predicate: (account: MockChartAccount) => boolean,
  isIncome: boolean,
): ReportLine[] {
  return accounts
    .filter((account) => account.isActive && predicate(account))
    .sort(compareAccounts)
    .map((account) => ({
      id: `acct-${section}-${account.id}`,
      label: account.name,
      amount: plAmountForAccount(entries, account.id, isIncome),
      isAccountLine: true,
    }))
    .filter((line) => (line.amount ?? 0) !== 0);
}

function sumLines(lines: ReportLine[]): number {
  return lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
}

function buildSection(
  sectionId: string,
  headerLabel: string,
  totalLabel: string,
  accountRows: ReportLine[],
): ReportLine[] {
  if (accountRows.length === 0) return [];

  const total = sumLines(accountRows);
  return [
    { id: `${sectionId}-header`, label: headerLabel, isSectionHeader: true },
    ...accountRows,
    { id: `${sectionId}-total`, label: totalLabel, amount: total, isSectionTotal: true },
  ];
}

export function buildProfitLossLedgerEntries(input: ProfitLossInput): {
  entries: LedgerEntry[];
  sales: MockSalesTransaction[];
  expenses: MockExpenseTransaction[];
} {
  const { sales, expenses } = filterProfitLossTransactions(input);
  const entries = buildBookkeepingEntries({
    salesTransactions: sales,
    expenses,
    chartAccounts: input.chartAccounts,
  });
  return { entries, sales, expenses };
}

/** Per-account ledger totals for P&L merge (import baseline + live deltas). */
export function computeProfitLossAccountRows(
  input: ProfitLossInput,
): ImportedProfitLossAccountRow[] {
  const { entries } = buildProfitLossLedgerEntries(input);
  const rows: ImportedProfitLossAccountRow[] = [];

  for (const account of input.chartAccounts) {
    if (!account.isActive) continue;
    const mapping = accountSection(account);
    if (!mapping) continue;
    const amount = plAmountForAccount(entries, account.id, mapping.isIncome);
    if (amount === 0) continue;
    rows.push({
      accountName: account.name,
      section: mapping.section,
      amount,
    });
  }

  return rows;
}

/** QuickBooks-style P&L: section header → accounts → section total. */
export function computeProfitAndLossLinesFromLedger(input: ProfitLossInput): ReportLine[] {
  const { entries } = buildProfitLossLedgerEntries(input);

  const incomeRows = accountLines(
    input.chartAccounts,
    entries,
    "income",
    isOperatingIncomeAccount,
    true,
  );
  const otherIncomeRows = accountLines(
    input.chartAccounts,
    entries,
    "other_income",
    isOtherIncomeAccount,
    true,
  );
  const cogsRows = accountLines(
    input.chartAccounts,
    entries,
    "cost_of_sales",
    isCogsAccount,
    false,
  );
  const expenseRows = accountLines(
    input.chartAccounts,
    entries,
    "expenses",
    isExpenseAccount,
    false,
  );
  const otherExpenseRows = accountLines(
    input.chartAccounts,
    entries,
    "other_expenses",
    isOtherExpenseAccount,
    false,
  );

  const income = sumLines(incomeRows);
  const costOfSales = sumLines(cogsRows);
  const expensesTotal = sumLines(expenseRows);
  const otherExpenses = sumLines(otherExpenseRows);
  const otherIncome = sumLines(otherIncomeRows);
  const grossProfit = income - costOfSales;
  const netEarnings = grossProfit - expensesTotal - otherExpenses + otherIncome;

  const lines: ReportLine[] = [
    ...buildSection("income", "Income", "Total Income", incomeRows),
    ...buildSection("cost-of-sales", "Cost of Sales", "Total Cost of Sales", cogsRows),
    {
      id: "gross-profit",
      label: "Gross Profit",
      amount: grossProfit,
      isSubtotal: true,
    },
    ...buildSection("expenses", "Expenses", "Total Expenses", expenseRows),
    ...buildSection("other-income", "Other Income", "Total Other Income", otherIncomeRows),
    ...buildSection("other-expenses", "Other Expenses", "Total Other Expenses", otherExpenseRows),
    {
      id: "net-earnings",
      label: "Net Earnings",
      amount: netEarnings,
      isGrandTotal: true,
    },
  ];

  return lines.filter((line) => {
    if (line.isSectionHeader || line.isAccountLine || line.isSectionTotal) return true;
    if (line.isSubtotal || line.isGrandTotal) return true;
    return (line.amount ?? 0) !== 0;
  });
}
