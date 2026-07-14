import { startOfDay } from "@/lib/report-date-utils";
import type { ReportDateRange } from "@/lib/report-date-utils";

/** Parse MM/DD/YYYY, MM/DD/YY, or YYYY-MM-DD into a local start-of-day Date. */
export function parseTransactionDate(date: string): Date | null {
  const trimmed = date.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return startOfDay(
      new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
    );
  }

  const long = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (long) {
    return startOfDay(
      new Date(Number(long[3]), Number(long[1]) - 1, Number(long[2])),
    );
  }
  const short = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (short) {
    return startOfDay(
      new Date(2000 + Number(short[3]), Number(short[1]) - 1, Number(short[2])),
    );
  }
  return null;
}

export function isDateInRange(date: Date, range: ReportDateRange): boolean {
  const day = startOfDay(date).getTime();
  return day >= startOfDay(range.from).getTime() && day <= startOfDay(range.to).getTime();
}

/** QuickBooks-style M/D/YY for tables and cards. */
export function formatTransactionDateDisplay(date: string): string {
  const parsed = parseTransactionDate(date);
  if (!parsed) return date;
  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();
  const year = parsed.getFullYear() % 100;
  return `${month}/${day}/${year.toString().padStart(2, "0")}`;
}
