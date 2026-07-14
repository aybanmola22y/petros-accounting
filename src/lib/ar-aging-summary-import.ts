import {
  cellText,
  mapHeaders,
  parseMoney,
  readSpreadsheetRows,
  safeLocalStorageSet,
} from "@/lib/import-spreadsheet-utils";
import type { CustomerAgingRow } from "@/lib/ar-aging-from-receivables";
import { rowTotal } from "@/lib/ar-aging-from-receivables";
import { parseReportDate, startOfDay } from "@/lib/report-date-utils";

const STORAGE_KEY = "ar-aging-summary-snapshot";

const SUMMARY_HEADER_ALIASES = {
  current: ["current"],
  days1to30: ["1 - 30", "1-30"],
  days31to60: ["31 - 60", "31-60"],
  days61to90: ["61 - 90", "61-90"],
  days91plus: ["91 and over", "91 or more", "91+"],
} as const;

export type ImportedArAgingSummarySnapshot = {
  asOf: string;
  rows: CustomerAgingRow[];
};

function rowLabel(row: unknown[]): string {
  return row.map(cellText).filter(Boolean).join(" ").trim();
}

function parseSignedMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = cellText(value).trim();
  const negative = text.startsWith("(") && text.endsWith(")");
  const amount = parseMoney(text);
  return negative ? -Math.abs(amount) : amount;
}

function parseAsOfDate(rows: unknown[][]): Date {
  const limit = Math.min(rows.length, 12);
  for (let i = 0; i < limit; i += 1) {
    const text = rowLabel(rows[i] ?? []);
    const match =
      text.match(/as of\s+(\d{1,2}\s+[A-Za-z]+\s*,?\s*\d{4})/i) ??
      text.match(/as of\s+(\d{1,2}\/\d{1,2}\/\d{4})/i) ??
      text.match(/as of\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
    if (match?.[1]) {
      const qbDayMonth = match[1].trim();
      const fromQb = new Date(qbDayMonth.replace(/,/g, ""));
      if (!Number.isNaN(fromQb.getTime())) return startOfDay(fromQb);
      const parsed = parseReportDate(qbDayMonth);
      if (parsed) return startOfDay(parsed);
    }
  }
  return startOfDay(new Date());
}

export function isArAgingSummarySpreadsheet(rows: unknown[][]): boolean {
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i += 1) {
    const text = rowLabel(rows[i] ?? []).toLowerCase();
    if (text.includes("ageing summary") || text.includes("aging summary")) {
      return true;
    }
  }

  for (let i = 0; i < limit; i += 1) {
    const columnMap = mapHeaders(rows[i] ?? [], SUMMARY_HEADER_ALIASES);
    if (columnMap.current != null && columnMap.days91plus != null) {
      return true;
    }
  }

  return false;
}

function findSummaryHeaderRowIndex(rows: unknown[][]): number {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i += 1) {
    const columnMap = mapHeaders(rows[i] ?? [], SUMMARY_HEADER_ALIASES);
    if (
      columnMap.current != null &&
      columnMap.days1to30 != null &&
      columnMap.days31to60 != null &&
      columnMap.days61to90 != null &&
      columnMap.days91plus != null
    ) {
      return i;
    }
  }
  throw new Error(
    'Could not find summary column headers (Current, 1 - 30, …, 91 and over).',
  );
}

function customerKey(name: string): string {
  return name.trim().toLowerCase() || "unknown-customer";
}

export async function parseArAgingSummarySpreadsheet(
  file: File,
): Promise<ImportedArAgingSummarySnapshot> {
  const { rows } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");
  if (!isArAgingSummarySpreadsheet(rows)) {
    throw new Error("This file does not look like an A/R Ageing Summary export.");
  }

  const asOf = parseAsOfDate(rows);
  const headerRowIndex = findSummaryHeaderRowIndex(rows);
  const columnMap = mapHeaders(rows[headerRowIndex] ?? [], SUMMARY_HEADER_ALIASES);
  const customerRows: CustomerAgingRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const customer = cellText(row[0]).trim();
    if (!customer) continue;
    if (customer.toLowerCase() === "total") break;

    const buckets = {
      current: parseSignedMoney(row[columnMap.current ?? -1]),
      days1to30: parseSignedMoney(row[columnMap.days1to30 ?? -1]),
      days31to60: parseSignedMoney(row[columnMap.days31to60 ?? -1]),
      days61to90: parseSignedMoney(row[columnMap.days61to90 ?? -1]),
      days91plus: parseSignedMoney(row[columnMap.days91plus ?? -1]),
    };

    if (rowTotal(buckets) === 0) continue;

    customerRows.push({
      id: customerKey(customer),
      customer,
      buckets,
    });
  }

  if (customerRows.length === 0) {
    throw new Error("No customer rows were found in the A/R Ageing Summary export.");
  }

  customerRows.sort((a, b) => a.customer.localeCompare(b.customer));

  const asOfLabel = `${asOf.getMonth() + 1}/${asOf.getDate()}/${asOf.getFullYear()}`;
  return { asOf: asOfLabel, rows: customerRows };
}

export function readImportedArAgingSummarySnapshot(): ImportedArAgingSummarySnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportedArAgingSummarySnapshot;
    if (!parsed.rows?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveImportedArAgingSummarySnapshot(snapshot: ImportedArAgingSummarySnapshot): void {
  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(snapshot));
}
