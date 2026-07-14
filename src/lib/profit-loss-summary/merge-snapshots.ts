import type {
  ImportedProfitLossAccountRow,
  ImportedProfitLossSnapshot,
  ProfitLossSection,
} from "@/lib/profit-loss-summary-import";
import type { ReportDateRange } from "@/lib/report-date-utils";
import { startOfDay } from "@/lib/report-date-utils";

function accountKey(section: ProfitLossSection, accountName: string): string {
  return `${section}::${accountName.trim().toLowerCase()}`;
}

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function monthIndex(name: string): number {
  return MONTH_INDEX[name.trim().toLowerCase()] ?? 0;
}

export function reportRangesEqual(a: ReportDateRange, b: ReportDateRange): boolean {
  return (
    startOfDay(a.from).getTime() === startOfDay(b.from).getTime() &&
    startOfDay(a.to).getTime() === startOfDay(b.to).getTime()
  );
}

/** Clip a ledger/report range to the overlap of two date windows. */
export function intersectReportRanges(
  a: ReportDateRange,
  b: ReportDateRange,
): ReportDateRange {
  const from = startOfDay(new Date(Math.max(a.from.getTime(), b.from.getTime())));
  const to = startOfDay(new Date(Math.min(a.to.getTime(), b.to.getTime())));
  if (from.getTime() > to.getTime()) return { from: a.from, to: a.to };
  return { from, to };
}

/** Map a QuickBooks P&L period label to a report date range (best effort). */
export function profitLossPeriodLabelToRange(periodLabel: string): ReportDateRange {
  const text = periodLabel.trim();
  if (!text) {
    const anchor = startOfDay(new Date());
    return { from: startOfDay(new Date(anchor.getFullYear(), 0, 1)), to: anchor };
  }

  const months =
    "january|february|march|april|may|june|july|august|september|october|november|december";
  const dash = String.raw`(?:-|–|—|to)`;

  // "January 1 – July 13, 2026" (US month-day)
  const monthDay = new RegExp(
    String.raw`(${months})\s+(\d{1,2})\s*${dash}\s*(${months})\s+(\d{1,2}),?\s*(20\d{2})`,
    "i",
  ).exec(text);
  if (monthDay) {
    const year = Number(monthDay[5]);
    return {
      from: startOfDay(new Date(year, monthIndex(monthDay[1]), Number(monthDay[2]))),
      to: startOfDay(new Date(year, monthIndex(monthDay[3]), Number(monthDay[4]))),
    };
  }

  // "1 January–13 July, 2026" (day-month — common QB Excel export)
  const dayMonth = new RegExp(
    String.raw`(\d{1,2})\s+(${months})\s*${dash}\s*(\d{1,2})\s+(${months}),?\s*(20\d{2})`,
    "i",
  ).exec(text);
  if (dayMonth) {
    const year = Number(dayMonth[5]);
    return {
      from: startOfDay(new Date(year, monthIndex(dayMonth[2]), Number(dayMonth[1]))),
      to: startOfDay(new Date(year, monthIndex(dayMonth[4]), Number(dayMonth[3]))),
    };
  }

  // "January 1, 2026 – July 13, 2026"
  const monthDayYearEach = new RegExp(
    String.raw`(${months})\s+(\d{1,2}),?\s+(20\d{2})\s*${dash}\s*(${months})\s+(\d{1,2}),?\s+(20\d{2})`,
    "i",
  ).exec(text);
  if (monthDayYearEach) {
    return {
      from: startOfDay(
        new Date(
          Number(monthDayYearEach[3]),
          monthIndex(monthDayYearEach[1]),
          Number(monthDayYearEach[2]),
        ),
      ),
      to: startOfDay(
        new Date(
          Number(monthDayYearEach[6]),
          monthIndex(monthDayYearEach[4]),
          Number(monthDayYearEach[5]),
        ),
      ),
    };
  }

  // "1 January 2026 – 13 July 2026"
  const dayMonthYearEach = new RegExp(
    String.raw`(\d{1,2})\s+(${months})\s+(20\d{2})\s*${dash}\s*(\d{1,2})\s+(${months})\s+(20\d{2})`,
    "i",
  ).exec(text);
  if (dayMonthYearEach) {
    return {
      from: startOfDay(
        new Date(
          Number(dayMonthYearEach[3]),
          monthIndex(dayMonthYearEach[2]),
          Number(dayMonthYearEach[1]),
        ),
      ),
      to: startOfDay(
        new Date(
          Number(dayMonthYearEach[6]),
          monthIndex(dayMonthYearEach[5]),
          Number(dayMonthYearEach[4]),
        ),
      ),
    };
  }

  const slashRange = new RegExp(
    String.raw`(\d{1,2})/(\d{1,2})/(20\d{2})\s*${dash}\s*(\d{1,2})/(\d{1,2})/(20\d{2})`,
    "i",
  ).exec(text);
  if (slashRange) {
    return {
      from: startOfDay(
        new Date(Number(slashRange[3]), Number(slashRange[1]) - 1, Number(slashRange[2])),
      ),
      to: startOfDay(
        new Date(Number(slashRange[6]), Number(slashRange[4]) - 1, Number(slashRange[5])),
      ),
    };
  }

  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  const year = years.at(-1) ?? new Date().getFullYear();
  return {
    from: startOfDay(new Date(year, 0, 1)),
    to: startOfDay(new Date(year, 11, 31)),
  };
}

/**
 * QuickBooks import + local activity after the import period:
 * displayed = imported + (ledger(currentRange) − ledger(importRange))
 *
 * Recomputing ledger-through-import (not a frozen baseline) cancels historical
 * gaps so a matching Accrual export stays faithful on that period.
 */
export function mergeProfitLossWithLedgerDelta(
  imported: ImportedProfitLossSnapshot,
  baseline: ImportedProfitLossSnapshot,
  currentRows: ImportedProfitLossAccountRow[],
): ImportedProfitLossSnapshot {
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

  const merged: ImportedProfitLossAccountRow[] = [];

  for (const importedRow of imported.rows) {
    const key = accountKey(importedRow.section, importedRow.accountName);
    let amount = importedRow.amount;

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
