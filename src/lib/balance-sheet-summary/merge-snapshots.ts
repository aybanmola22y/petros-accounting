import type {
  ImportedBalanceSheetAccountRow,
  ImportedBalanceSheetSnapshot,
  BalanceSheetSection,
} from "@/lib/balance-sheet-summary-import";
import type { ReportDateRange } from "@/lib/report-date-utils";
import { startOfDay } from "@/lib/report-date-utils";

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function monthIndex(token: string): number {
  const key = token.trim().toLowerCase().slice(0, 3);
  return MONTH_INDEX[key] ?? 0;
}

function accountKey(section: BalanceSheetSection, accountName: string): string {
  return `${section}::${accountName.trim().toLowerCase()}`;
}

/** Parse QuickBooks Balance Sheet period ("As of …" or "All Dates"). */
export function balanceSheetPeriodLabelToAsOf(periodLabel: string): Date {
  const text = periodLabel.trim();

  const allDatesAsOf = /all dates\s*\(as of\s+(\d{1,2})\s+([a-z]+),?\s*(20\d{2})\)/i.exec(
    text,
  );
  if (allDatesAsOf) {
    return startOfDay(
      new Date(
        Number(allDatesAsOf[3]),
        monthIndex(allDatesAsOf[2]),
        Number(allDatesAsOf[1]),
      ),
    );
  }

  if (/^all dates$/i.test(text)) {
    return startOfDay(new Date());
  }

  const asOfMatch = /as of\s+(\d{1,2})\s+([a-z]+),?\s*(20\d{2})/i.exec(text);
  if (asOfMatch) {
    return startOfDay(
      new Date(Number(asOfMatch[3]), monthIndex(asOfMatch[2]), Number(asOfMatch[1])),
    );
  }

  // QuickBooks often uses "As of July 13, 2026" (month day year).
  const monthFirst = /as of\s+([a-z]+)\s+(\d{1,2}),?\s*(20\d{2})/i.exec(text);
  if (monthFirst) {
    return startOfDay(
      new Date(Number(monthFirst[3]), monthIndex(monthFirst[1]), Number(monthFirst[2])),
    );
  }

  const allDatesMonthFirst =
    /all dates\s*\(as of\s+([a-z]+)\s+(\d{1,2}),?\s*(20\d{2})\)/i.exec(text);
  if (allDatesMonthFirst) {
    return startOfDay(
      new Date(
        Number(allDatesMonthFirst[3]),
        monthIndex(allDatesMonthFirst[1]),
        Number(allDatesMonthFirst[2]),
      ),
    );
  }

  const slashMatch = /(\d{1,2})\/(\d{1,2})\/(20\d{2})/.exec(text);
  if (slashMatch) {
    return startOfDay(
      new Date(Number(slashMatch[3]), Number(slashMatch[1]) - 1, Number(slashMatch[2])),
    );
  }

  return startOfDay(new Date());
}

export function isBalanceSheetAllDatesPeriod(periodLabel: string): boolean {
  return /all dates/i.test(periodLabel.trim());
}

/** Live "All dates" header — uses today, not the stale QuickBooks import snapshot date. */
export function formatBalanceSheetAllDatesAsOfLabel(asOf: Date = startOfDay(new Date())): string {
  return `All dates (as of ${asOf.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })})`;
}

export function balanceSheetAsOfRange(asOf: Date): ReportDateRange {
  return { from: new Date(1900, 0, 1), to: startOfDay(asOf) };
}

/**
 * QuickBooks import + local activity after the import as-of date:
 * displayed = imported + (ledgerAsOfToday − ledgerAsOfImport)
 *
 * Using ledger-at-import-as-of (recomputed) instead of a frozen import-time
 * baseline cancels historical gaps in the app ledger, so a fresh All Dates
 * import matches QuickBooks on that day.
 *
 * Duplicate account names keep the imported amount (name-only matching is unsafe).
 * Accounts missing from the ledger side keep the imported amount.
 */
export function mergeBalanceSheetWithLedgerDelta(
  imported: ImportedBalanceSheetSnapshot,
  baseline: ImportedBalanceSheetSnapshot,
  currentRows: ImportedBalanceSheetAccountRow[],
): ImportedBalanceSheetSnapshot {
  if (baseline.rows.length === 0) {
    return imported;
  }

  const nameCounts = new Map<string, number>();
  for (const row of imported.rows) {
    const key = accountKey(row.section, row.accountName);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  const baselineMap = new Map(
    baseline.rows.map((row) => [accountKey(row.section, row.accountName), row.amount]),
  );
  const currentMap = new Map(
    currentRows.map((row) => [accountKey(row.section, row.accountName), row.amount]),
  );

  const merged: ImportedBalanceSheetAccountRow[] = [];

  for (const importedRow of imported.rows) {
    const key = accountKey(importedRow.section, importedRow.accountName);
    let amount = importedRow.amount;

    // Same display name appears more than once in QB — leave each row as imported.
    if ((nameCounts.get(key) ?? 0) <= 1) {
      const baselineAmount = baselineMap.get(key);
      const currentAmount = currentMap.get(key);
      if (baselineAmount !== undefined && currentAmount !== undefined) {
        amount = importedRow.amount + (currentAmount - baselineAmount);
      }
    }

    if (amount === 0) continue;

    merged.push({
      ...importedRow,
      amount,
    });
  }

  return { periodLabel: imported.periodLabel, rows: merged };
}
