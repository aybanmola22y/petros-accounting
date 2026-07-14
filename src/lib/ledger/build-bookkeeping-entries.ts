import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import {
  defaultPaymentAccountId,
  expenseAccountIdForExpense,
  paymentDepositAccountId,
  resolveAccountsPayableAccountId,
  resolveAccountsReceivableAccountId,
  resolveSaleIncomeAccountId,
} from "./account-mapping";
import { parseTransactionDate } from "./date-utils";
import { expenseLedgerStatus } from "./expense-inclusion";
import type { LedgerEntry } from "./types";

type BookkeepingInput = {
  salesTransactions: MockSalesTransaction[];
  expenses: MockExpenseTransaction[];
  chartAccounts: MockChartAccount[];
};

/** Full double-entry lines for chart-of-accounts balances (accrual bookkeeping). */
export function buildBookkeepingEntries(input: BookkeepingInput): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  let seq = 0;
  const arAccountId = resolveAccountsReceivableAccountId(input.chartAccounts);
  const apAccountId = resolveAccountsPayableAccountId(input.chartAccounts);

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

    if (sale.type === "Invoice") {
      pushPair(
        "invoice",
        sale.id,
        date,
        arAccountId,
        resolveSaleIncomeAccountId(sale, input.chartAccounts),
        sale.amount,
        sale.customer,
      );
    } else if (sale.type === "Sales receipt") {
      pushPair(
        "sales-receipt",
        sale.id,
        date,
        defaultPaymentAccountId(input.chartAccounts),
        resolveSaleIncomeAccountId(sale, input.chartAccounts),
        sale.amount,
        sale.customer,
      );
    } else if (sale.type === "Payment" && sale.status.kind === "closed") {
      pushPair(
        "payment",
        sale.id,
        date,
        paymentDepositAccountId(sale.depositToAccountId, input.chartAccounts),
        arAccountId,
        sale.amount,
        sale.customer,
      );
    }
  }

  for (const expense of input.expenses) {
    const date = parseTransactionDate(expense.date);
    if (!date) continue;
    const expenseAccountId = expenseAccountIdForExpense(expense, input.chartAccounts);

    const ledgerStatus = expenseLedgerStatus(expense);

    if (ledgerStatus === "paid") {
      const paymentAccountId =
        expense.paymentAccountId ?? defaultPaymentAccountId(input.chartAccounts);
      const amount = Math.abs(expense.total);
      pushPair(
        expense.type === "Bill" ? "bill" : "expense",
        expense.id,
        date,
        expenseAccountId,
        paymentAccountId,
        amount,
        expense.payee,
      );
    } else if (ledgerStatus === "pending") {
      pushPair(
        "bill",
        expense.id,
        date,
        expenseAccountId,
        apAccountId,
        Math.abs(expense.total),
        expense.payee,
      );
    }
  }

  return entries;
}
