import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { ReportDateRange } from "@/lib/report-date-utils";
import {
  DEFAULT_CASH_ACCOUNT_ID,
} from "./account-mapping";
import { isDateInRange, parseTransactionDate } from "./date-utils";
import { expenseIncludedForBasis } from "./expense-inclusion";
import type { AccountingBasis } from "./types";

export type TransactionDetailRow = {
  id: string;
  date: string;
  type: string;
  number: string;
  name: string;
  location: string;
  className: string;
  description: string;
  split: string;
  amount: number;
  balance: number;
};

export type TransactionDetailAccountGroup = {
  accountName: string;
  rows: TransactionDetailRow[];
  total: number;
};

export type TransactionDetailByAccountResult = {
  groups: TransactionDetailAccountGroup[];
  grandTotal: number;
};

const DEFAULT_LOCATION = "Head Office - Puerto Princesa";

const SPENDING_TRANSACTION_TYPES = new Set(["Expense", "Check"]);

function isSpendingTransaction(expense: MockExpenseTransaction): boolean {
  return SPENDING_TRANSACTION_TYPES.has(expense.type);
}

function countsAsExpense(expense: MockExpenseTransaction, basis: AccountingBasis): boolean {
  return expenseIncludedForBasis(expense, basis);
}

function splitAccountName(chartAccounts: MockChartAccount[]): string {
  return (
    chartAccounts.find((a) => a.id === DEFAULT_CASH_ACCOUNT_ID)?.name ?? "Cash on hand"
  );
}

function compareByDate(a: MockExpenseTransaction, b: MockExpenseTransaction): number {
  const da = parseTransactionDate(a.date)?.getTime() ?? 0;
  const db = parseTransactionDate(b.date)?.getTime() ?? 0;
  if (da !== db) return da - db;
  return a.number.localeCompare(b.number);
}

/** Expense transactions grouped by chart account for Transaction Detail by Account. */
export function computeExpenseTransactionDetailByAccount(
  expenses: MockExpenseTransaction[],
  range: ReportDateRange,
  chartAccounts: MockChartAccount[],
  basis: AccountingBasis = "Accrual",
): TransactionDetailByAccountResult {
  const split = splitAccountName(chartAccounts);
  const filtered = expenses
    .filter((expense) => {
      if (!isSpendingTransaction(expense)) return false;
      if (!countsAsExpense(expense, basis)) return false;
      const date = parseTransactionDate(expense.date);
      return date ? isDateInRange(date, range) : false;
    })
    .sort(compareByDate);

  const byAccount = new Map<string, MockExpenseTransaction[]>();
  for (const expense of filtered) {
    const accountName = expense.category;
    const list = byAccount.get(accountName) ?? [];
    list.push(expense);
    byAccount.set(accountName, list);
  }

  const groups: TransactionDetailAccountGroup[] = [...byAccount.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([accountName, items]) => {
      let running = 0;
      const rows: TransactionDetailRow[] = items.map((expense) => {
        running += expense.total;
        return {
          id: expense.id,
          date: expense.date,
          type: expense.type,
          number: expense.number,
          name: expense.payee,
          location: DEFAULT_LOCATION,
          className: "",
          description: expense.payee,
          split,
          amount: expense.total,
          balance: running,
        };
      });
      return {
        accountName,
        rows,
        total: running,
      };
    });

  const grandTotal = groups.reduce((sum, group) => sum + group.total, 0);
  return { groups, grandTotal };
}
