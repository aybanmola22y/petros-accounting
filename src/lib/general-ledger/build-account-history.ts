import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import { startOfDay, type ReportDateRange } from "@/lib/report-date-utils";
import type {
  AccountQuickReportResult,
  AccountQuickReportRow,
} from "@/lib/ledger/compute-account-quick-report";
import { isBankRegisterAccount } from "@/lib/ledger/is-bank-register-account";
import type { GeneralLedgerAccountRow } from "./repository";

function parseIsoToDate(iso: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatDisplayDate(rawDate: string, iso: string | null): string {
  const parsed = parseIsoToDate(iso);
  if (parsed) {
    return parsed.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  }
  return rawDate;
}

/**
 * Build an account history result from imported QuickBooks General Ledger rows.
 * GL provides the real per-account running balance, so balances match QuickBooks exactly.
 */
export function buildAccountHistoryFromGeneralLedger(
  account: MockChartAccount,
  glRows: GeneralLedgerAccountRow[],
  range: ReportDateRange,
): AccountQuickReportResult {
  const sorted = [...glRows].sort((a, b) => a.sortOrder - b.sortOrder);

  const rangeStart = startOfDay(range.from).getTime();
  const rangeEnd = startOfDay(range.to).getTime();

  let beginningBalance = 0;
  const inRange: GeneralLedgerAccountRow[] = [];

  for (const row of sorted) {
    const date = parseIsoToDate(row.isoDate);
    const day = date ? startOfDay(date).getTime() : null;

    if (day !== null && day < rangeStart) {
      // Everything before the range contributes to the opening balance.
      beginningBalance = row.balance;
      continue;
    }
    if (day !== null && day > rangeEnd) continue;
    inRange.push(row);
  }

  const rows: AccountQuickReportRow[] = inRange.map((row) => {
    const amount = row.amount;
    const counterpart = row.splitAccount;
    const payeeAccount = row.payeeName || counterpart;
    return {
      id: row.id,
      distributionAccount: counterpart,
      date: formatDisplayDate(row.rawDate, row.isoDate),
      transactionType: row.transactionType,
      number: row.refNumber,
      name: row.payeeName,
      description: row.description,
      fullName: row.payeeName,
      cleared: "",
      amount,
      debit: amount > 0 ? amount : 0,
      credit: amount < 0 ? Math.abs(amount) : 0,
      payment: amount < 0 ? Math.abs(amount) : 0,
      deposit: amount > 0 ? amount : 0,
      payeeAccount,
      memo: row.description,
      classLocation: row.classLocation,
      foreignCurrencyExchangeRate: row.foreignCurrencyExchangeRate,
      tax: row.tax,
      balance: row.balance,
    };
  });

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalDebits = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredits = rows.reduce((sum, row) => sum + row.credit, 0);
  const totalPayments = rows.reduce((sum, row) => sum + row.payment, 0);
  const totalDeposits = rows.reduce((sum, row) => sum + row.deposit, 0);
  const endingBalance = rows.length > 0 ? rows[rows.length - 1]!.balance : beginningBalance;

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
    endingBalance,
  };
}
