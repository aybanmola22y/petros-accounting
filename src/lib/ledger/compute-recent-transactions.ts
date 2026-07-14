import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import { parseTransactionDate } from "./date-utils";
import { expenseCountsAsCashOutflow } from "./expense-inclusion";

export type RecentTransactionRow = {
  id: string | number;
  description: string;
  date: string;
  type: "credit" | "debit";
  amount: number;
};

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sortTimeForRow(recordedAt: string | undefined, transactionDate: Date): number {
  if (recordedAt) {
    const recorded = new Date(recordedAt);
    if (!Number.isNaN(recorded.getTime())) return recorded.getTime();
  }
  return transactionDate.getTime();
}

/** Latest payments and expenses — most recently saved first, then by transaction date. */
export function computeRecentTransactions(
  salesTransactions: MockSalesTransaction[],
  expenses: MockExpenseTransaction[],
  limit = 4,
): RecentTransactionRow[] {
  const rows: (RecentTransactionRow & { sortTime: number })[] = [];

  for (const sale of salesTransactions) {
    if (sale.type !== "Payment" || sale.status.kind !== "closed") continue;
    const date = parseTransactionDate(sale.date);
    if (!date) continue;
    rows.push({
      id: sale.id,
      description: `Client payment — ${sale.customer}`,
      date: toIsoDate(date),
      type: "credit",
      amount: sale.amount,
      sortTime: sortTimeForRow(sale.recordedAt, date),
    });
  }

  for (const expense of expenses) {
    if (!expenseCountsAsCashOutflow(expense)) continue;
    const date = parseTransactionDate(expense.date);
    if (!date) continue;
    rows.push({
      id: expense.id,
      description: expense.payee,
      date: toIsoDate(date),
      type: "debit",
      amount: expense.total,
      sortTime: sortTimeForRow(expense.recordedAt, date),
    });
  }

  return rows
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, limit)
    .map(({ sortTime: _sortTime, ...row }) => row);
}
