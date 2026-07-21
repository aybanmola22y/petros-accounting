import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import { startOfDay, type ReportDateRange } from "@/lib/report-date-utils";
import type {
  AccountQuickReportResult,
  AccountQuickReportRow,
} from "@/lib/ledger/compute-account-quick-report";
import { isBankRegisterAccount } from "@/lib/ledger/is-bank-register-account";
import type { GeneralLedgerAccountRow } from "./repository";

const BALANCE_EPSILON = 0.01;

function parseIsoToDate(iso: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function parseDisplayDate(date: string): Date | null {
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date.trim());
  if (!mdy) return null;
  return new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
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

function transactionSignature(
  row: Pick<AccountQuickReportRow, "date" | "number" | "transactionType" | "amount">,
): string {
  return `${row.date}|${row.number.trim().toLowerCase()}|${row.transactionType.trim().toLowerCase()}|${row.amount.toFixed(2)}`;
}

function glRowSignature(row: GeneralLedgerAccountRow): string {
  return transactionSignature({
    date: formatDisplayDate(row.rawDate, row.isoDate),
    number: row.refNumber,
    transactionType: row.transactionType,
    amount: row.amount,
  });
}

function latestGlTransactionDate(glRows: GeneralLedgerAccountRow[]): Date | null {
  let latest: Date | null = null;
  for (const row of glRows) {
    const date = parseIsoToDate(row.isoDate);
    if (!date) continue;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }
  return latest;
}

function rangeIncludesToday(range: ReportDateRange, anchor = new Date()): boolean {
  return startOfDay(range.to).getTime() >= startOfDay(anchor).getTime();
}

function summarizeRows(rows: AccountQuickReportRow[]) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalDebits = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredits = rows.reduce((sum, row) => sum + row.credit, 0);
  const totalPayments = rows.reduce((sum, row) => sum + row.payment, 0);
  const totalDeposits = rows.reduce((sum, row) => sum + row.deposit, 0);
  return { total, totalDebits, totalCredits, totalPayments, totalDeposits };
}

/**
 * QuickBooks General Ledger imports can lag behind the Chart of Accounts balance
 * (Account List). Merge newer sales/expense activity and reconcile the ending
 * balance to the chart account when the report includes today.
 */
export function mergeAccountHistoryWithComputedActivity(
  glResult: AccountQuickReportResult,
  computed: AccountQuickReportResult | null,
  account: MockChartAccount,
  allGlRows: GeneralLedgerAccountRow[],
  range: ReportDateRange,
): AccountQuickReportResult {
  if (!computed) {
    if (
      rangeIncludesToday(range) &&
      Math.abs(glResult.endingBalance - account.ledgerBalance) > BALANCE_EPSILON
    ) {
      return { ...glResult, endingBalance: account.ledgerBalance };
    }
    return glResult;
  }

  const glSignatures = new Set(allGlRows.map(glRowSignature));
  const latestGlDate = latestGlTransactionDate(allGlRows);
  const latestGlDay = latestGlDate ? startOfDay(latestGlDate).getTime() : null;
  const rangeStart = startOfDay(range.from).getTime();
  const rangeEnd = startOfDay(range.to).getTime();

  const supplemental = computed.rows
    .filter((row) => {
      if (glSignatures.has(transactionSignature(row))) return false;
      const day = parseDisplayDate(row.date);
      if (!day) return false;
      const dayTime = startOfDay(day).getTime();
      if (dayTime < rangeStart || dayTime > rangeEnd) return false;
      // Prefer activity on/after the last imported GL date so we fill gaps from a
      // stale General Ledger without inventing older duplicates.
      if (latestGlDay == null) return true;
      return dayTime >= latestGlDay;
    })
    .sort((a, b) => {
      const diff =
        (parseDisplayDate(a.date)?.getTime() ?? 0) - (parseDisplayDate(b.date)?.getTime() ?? 0);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

  let rows = glResult.rows;
  if (supplemental.length > 0) {
    let running =
      rows.length > 0 ? rows[rows.length - 1]!.balance : glResult.beginningBalance;
    const merged = [...rows];
    for (const row of supplemental) {
      running += row.amount;
      merged.push({
        ...row,
        id: `computed-${row.id}`,
        balance: running,
      });
    }
    rows = merged;
  }

  const totals = summarizeRows(rows);
  let endingBalance =
    rows.length > 0 ? rows[rows.length - 1]!.balance : glResult.beginningBalance;

  if (rangeIncludesToday(range)) {
    endingBalance = account.ledgerBalance;
  }

  return {
    ...glResult,
    rows,
    ...totals,
    endingBalance,
  };
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
