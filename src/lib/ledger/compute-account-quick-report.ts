import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import { startOfDay, type ReportDateRange } from "@/lib/report-date-utils";
import { buildBookkeepingEntries } from "./build-bookkeeping-entries";
import { parseTransactionDate } from "./date-utils";
import { isBankRegisterAccount } from "./is-bank-register-account";
import type { LedgerEntry, LedgerSourceType } from "./types";

export type AccountQuickReportRow = {
  id: string;
  distributionAccount: string;
  date: string;
  transactionType: string;
  number: string;
  name: string;
  description: string;
  fullName: string;
  cleared: string;
  amount: number;
  debit: number;
  credit: number;
  /** Outgoing funds (bank register). */
  payment: number;
  /** Incoming funds (bank register). */
  deposit: number;
  /** Counterparty account or payee (bank register). */
  payeeAccount: string;
  memo: string;
  classLocation: string;
  foreignCurrencyExchangeRate: string;
  tax: string;
  balance: number;
  isBeginningBalance?: boolean;
};

export type AccountQuickReportResult = {
  accountName: string;
  accountNumber: string;
  registerStyle: "bank" | "register";
  ledgerBalance: number;
  bankBalance?: number;
  beginningBalance: number;
  rows: AccountQuickReportRow[];
  total: number;
  totalDebits: number;
  totalCredits: number;
  totalPayments: number;
  totalDeposits: number;
  endingBalance: number;
};

function formatLedgerDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function entryAmount(entry: LedgerEntry): number {
  return entry.debit - entry.credit;
}

function sourceKey(entry: LedgerEntry): string {
  return `${entry.sourceType}:${entry.sourceId}`;
}

function transactionTypeLabel(sourceType: LedgerSourceType, expense?: MockExpenseTransaction): string {
  if (sourceType === "bill" && expense?.type === "Check") return "Check";
  switch (sourceType) {
    case "invoice":
      return "Invoice";
    case "payment":
      return "Payment";
    case "sales-receipt":
      return "Sales receipt";
    case "expense":
      return "Expense";
    case "bill":
      return "Bill";
    default:
      return "Journal";
  }
}

function lookupSourceMeta(
  entry: LedgerEntry,
  expenses: MockExpenseTransaction[],
  sales: MockSalesTransaction[],
): {
  number: string;
  name: string;
  description: string;
  fullName: string;
  memo: string;
  transactionType: string;
} {
  if (entry.sourceType === "invoice" || entry.sourceType === "payment" || entry.sourceType === "sales-receipt") {
    const sale = sales.find((row) => row.id === entry.sourceId);
    if (!sale) {
      return {
        number: "",
        name: entry.description ?? "",
        description: entry.description ?? "",
        fullName: entry.description ?? "",
        memo: entry.description ?? "",
        transactionType: transactionTypeLabel(entry.sourceType),
      };
    }
    return {
      number: sale.number,
      name: sale.customer,
      description: sale.memo || sale.customer,
      fullName: sale.customer,
      memo: sale.memo?.trim() ?? "",
      transactionType: transactionTypeLabel(entry.sourceType),
    };
  }

  const expense = expenses.find((row) => row.id === entry.sourceId);
  if (!expense) {
    return {
      number: "",
      name: entry.description ?? "",
      description: entry.description ?? "",
      fullName: entry.description ?? "",
      memo: "",
      transactionType: transactionTypeLabel(entry.sourceType),
    };
  }

  return {
    number: expense.number,
    name: expense.payee,
    description: expense.payee,
    fullName: expense.payee,
    memo: "",
    transactionType: transactionTypeLabel(entry.sourceType, expense),
  };
}

function counterpartAccountName(
  entry: LedgerEntry,
  entriesBySource: Map<string, LedgerEntry[]>,
  accountNameById: Map<string, string>,
): string {
  const siblings = entriesBySource.get(sourceKey(entry)) ?? [];
  const counterpart = siblings.find((row) => row.accountId !== entry.accountId);
  if (!counterpart) return "";
  return accountNameById.get(counterpart.accountId) ?? "";
}

/** Ledger activity for a single chart account (QuickBooks Account QuickReport). */
export function computeAccountQuickReport(
  accountId: string,
  range: ReportDateRange,
  chartAccounts: MockChartAccount[],
  expenses: MockExpenseTransaction[],
  sales: MockSalesTransaction[],
): AccountQuickReportResult | null {
  const account = chartAccounts.find((row) => row.id === accountId);
  if (!account) return null;

  const entries = buildBookkeepingEntries({
    salesTransactions: sales,
    expenses,
    chartAccounts,
  });

  const accountNameById = new Map(chartAccounts.map((row) => [row.id, row.name]));
  const entriesBySource = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const key = sourceKey(entry);
    const list = entriesBySource.get(key) ?? [];
    list.push(entry);
    entriesBySource.set(key, list);
  }

  const accountEntries = entries
    .filter((entry) => entry.accountId === accountId)
    .sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

  const rangeStart = startOfDay(range.from).getTime();
  const rangeEnd = startOfDay(range.to).getTime();

  const activityFromRangeStart = accountEntries
    .filter((entry) => startOfDay(entry.date).getTime() >= rangeStart)
    .reduce((sum, entry) => sum + entryAmount(entry), 0);

  const beginningBalance = account.ledgerBalance - activityFromRangeStart;
  const periodEntries: LedgerEntry[] = [];

  for (const entry of accountEntries) {
    const entryDay = startOfDay(entry.date).getTime();
    if (entryDay < rangeStart || entryDay > rangeEnd) continue;
    periodEntries.push(entry);
  }

  let runningBalance = beginningBalance;
  const rows: AccountQuickReportRow[] = periodEntries.map((entry) => {
    const amount = entryAmount(entry);
    runningBalance += amount;
    const meta = lookupSourceMeta(entry, expenses, sales);
    const counterpart = counterpartAccountName(entry, entriesBySource, accountNameById);
    const payeeAccount = counterpart || meta.name;
    return {
      id: entry.id,
      distributionAccount: counterpart,
      date: formatLedgerDate(entry.date),
      transactionType: meta.transactionType,
      number: meta.number,
      name: meta.name,
      description: meta.description,
      fullName: meta.fullName,
      cleared: "",
      amount,
      debit: entry.debit,
      credit: entry.credit,
      payment: amount < 0 ? Math.abs(amount) : 0,
      deposit: amount > 0 ? amount : 0,
      payeeAccount,
      memo: meta.memo,
      classLocation: "",
      foreignCurrencyExchangeRate: "",
      tax: "",
      balance: runningBalance,
    };
  });

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalDebits = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredits = rows.reduce((sum, row) => sum + row.credit, 0);
  const totalPayments = rows.reduce((sum, row) => sum + row.payment, 0);
  const totalDeposits = rows.reduce((sum, row) => sum + row.deposit, 0);

  return {
    accountName: account.name,
    accountNumber: account.number,
    registerStyle: isBankRegisterAccount(account) ? "bank" : "register",
    ledgerBalance: account.ledgerBalance,
    bankBalance: account.bankBalance,
    beginningBalance,
    rows,
    total,
    totalDebits,
    totalCredits,
    totalPayments,
    totalDeposits,
    endingBalance: beginningBalance + total,
  };
}
