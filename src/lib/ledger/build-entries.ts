import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import {
  DEFAULT_AR_ACCOUNT_ID,
  DEFAULT_CASH_ACCOUNT_ID,
  DEFAULT_INCOME_ACCOUNT_ID,
  expenseAccountIdForCategory,
} from "./account-mapping";
import { parseTransactionDate } from "./date-utils";
import { expenseIncludedForBasis } from "./expense-inclusion";
import type { AccountingBasis, LedgerEntry } from "./types";

type BuildLedgerInput = {
  salesTransactions: MockSalesTransaction[];
  expenses: MockExpenseTransaction[];
  chartAccounts: MockChartAccount[];
  basis: AccountingBasis;
};

export function buildLedgerEntries(input: BuildLedgerInput): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  let seq = 0;
  const pushPair = (
    sourceType: LedgerEntry["sourceType"],
    sourceId: string,
    date: Date,
    debitAccountId: string,
    creditAccountId: string,
    amount: number,
    description?: string,
  ) => {
    if (amount <= 0) return;
    const base = `${sourceType}-${sourceId}-${seq++}`;
    entries.push({
      id: `${base}-dr`,
      date,
      accountId: debitAccountId,
      debit: amount,
      credit: 0,
      sourceType,
      sourceId,
      description,
    });
    entries.push({
      id: `${base}-cr`,
      date,
      accountId: creditAccountId,
      debit: 0,
      credit: amount,
      sourceType,
      sourceId,
      description,
    });
  };

  for (const sale of input.salesTransactions) {
    const date = parseTransactionDate(sale.date);
    if (!date || sale.type === "Estimate") continue;

    if (input.basis === "Accrual" && sale.type === "Invoice") {
      pushPair("invoice", sale.id, date, DEFAULT_AR_ACCOUNT_ID, DEFAULT_INCOME_ACCOUNT_ID, sale.amount, sale.customer);
    } else if (
      input.basis === "Cash" &&
      (sale.type === "Payment" || sale.type === "Sales receipt") &&
      (sale.type === "Sales receipt" || sale.status.kind === "closed")
    ) {
      pushPair(
        sale.type === "Payment" ? "payment" : "sales-receipt",
        sale.id,
        date,
        DEFAULT_CASH_ACCOUNT_ID,
        DEFAULT_INCOME_ACCOUNT_ID,
        sale.amount,
        sale.customer,
      );
    } else if (sale.type === "Sales receipt") {
      pushPair("sales-receipt", sale.id, date, DEFAULT_CASH_ACCOUNT_ID, DEFAULT_INCOME_ACCOUNT_ID, sale.amount, sale.customer);
    }
  }

  for (const expense of input.expenses) {
    if (!expenseIncludedForBasis(expense, input.basis)) continue;
    const date = parseTransactionDate(expense.date);
    if (!date) continue;
    const expenseAccountId = expenseAccountIdForCategory(expense.category, input.chartAccounts);
    pushPair(
      expense.type === "Bill" ? "bill" : "expense",
      expense.id,
      date,
      expenseAccountId,
      DEFAULT_CASH_ACCOUNT_ID,
      expense.total,
      expense.payee,
    );
  }

  return entries;
}
