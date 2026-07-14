import {
  cellText,
  findHeaderRowIndex,
  mapHeaders,
  parseMoney,
  pickCell,
  readSpreadsheetRows,
  safeLocalStorageSet,
} from "@/lib/import-spreadsheet-utils";
import {
  daysBetween,
  parseReportDate,
  startOfDay,
} from "@/lib/report-date-utils";

const STORAGE_KEY = "ar-aging-detail-snapshot";

const COLUMN_ALIASES = {
  date: ["date"],
  transactionType: ["transaction type", "type"],
  number: ["no", "num", "number"],
  customer: ["customer", "customer full name", "customer name", "name", "display name"],
  location: ["location", "location full name", "location name"],
  dueDate: ["due date"],
  amount: ["amount"],
  openBalance: ["open balance", "balance", "open bal"],
} as const;

const DATA_TRANSACTION_TYPES = new Set([
  "invoice",
  "payment",
  "credit memo",
  "credit note",
  "sales receipt",
  "journal entry",
  "cheque",
  "check",
  "refund",
  "delayed charge",
  "statement charge",
  "billable expense charge",
  "credit card credit",
  "cash sale",
]);

export type ImportedArAgingDetailBucket =
  | "current"
  | "days1to30"
  | "days31to60"
  | "days61to90"
  | "days91plus";

export type ImportedArAgingDetailLine = {
  referenceNumber: string;
  transactionType: string;
  date: string;
  customer: string;
  location: string;
  dueDate: string;
  amount: number;
  openBalance: number;
  bucket: ImportedArAgingDetailBucket;
};

export type ImportedArAgingDetailSnapshot = {
  asOf: string;
  lines: ImportedArAgingDetailLine[];
  /** QuickBooks "TOTAL" row from the export — authoritative when present. */
  totalAmount?: number;
  totalOpenBalance?: number;
};

function bucketKeyForDaysPastDue(daysPastDue: number): ImportedArAgingDetailBucket {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "days1to30";
  if (daysPastDue <= 60) return "days31to60";
  if (daysPastDue <= 90) return "days61to90";
  return "days91plus";
}

function rowLabel(row: unknown[]): string {
  return row.map(cellText).filter(Boolean).join(" ").trim();
}

function bucketFromSectionLabel(label: string): ImportedArAgingDetailBucket | null {
  const lower = label.trim().toLowerCase();
  if (!lower || lower.startsWith("total for") || lower === "total") return null;
  // QB uses "91 or more" and "91 and over"
  if (/91/.test(lower) && /(or more|and over|\+)/.test(lower)) return "days91plus";
  if (/61\s*[-–—]\s*90/.test(lower)) return "days61to90";
  if (/31\s*[-–—]\s*60/.test(lower)) return "days31to60";
  if (/\b1\s*[-–—]\s*30\b/.test(lower)) return "days1to30";
  if (lower === "current" || lower.startsWith("current")) return "current";
  return null;
}

function sectionBucketFromRow(row: unknown[]): ImportedArAgingDetailBucket | null {
  for (const cell of row) {
    const bucket = bucketFromSectionLabel(cellText(cell));
    if (bucket) return bucket;
  }
  return bucketFromSectionLabel(rowLabel(row));
}

function parseSignedMoney(value: unknown): number {
  // parseMoney already handles -, (), and PHP prefixes
  return parseMoney(value);
}

function formatSpreadsheetDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = value.getMonth() + 1;
    const day = value.getDate();
    const year = value.getFullYear();
    return `${month}/${day}/${year}`;
  }
  return cellText(value);
}

function parseAsOfDate(rows: unknown[][]): Date {
  const limit = Math.min(rows.length, 12);
  for (let i = 0; i < limit; i += 1) {
    const text = rowLabel(rows[i] ?? []);
    const match =
      text.match(/as of\s+(\d{1,2}\/\d{1,2}\/\d{4})/i) ??
      text.match(/as of\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
    if (match?.[1]) {
      const parsed = parseReportDate(match[1]);
      if (parsed) return startOfDay(parsed);
    }
  }
  return startOfDay(new Date());
}

function resolveLineBucket(
  dueDateRaw: string,
  asOf: Date,
  sectionBucket: ImportedArAgingDetailBucket | null,
): ImportedArAgingDetailBucket {
  // Prefer QuickBooks section headers so totals match the QB report buckets.
  if (sectionBucket) return sectionBucket;
  const due = parseReportDate(dueDateRaw);
  if (due) {
    return bucketKeyForDaysPastDue(daysBetween(due, startOfDay(asOf)));
  }
  return "days91plus";
}

function isCreditLikeType(transactionType: string): boolean {
  const type = transactionType.trim().toLowerCase();
  return (
    type === "payment" ||
    type === "credit memo" ||
    type === "credit note" ||
    type === "cheque" ||
    type === "check" ||
    type === "refund" ||
    type === "credit card credit"
  );
}

function isDataRow(
  row: unknown[],
  columnMap: Partial<Record<keyof typeof COLUMN_ALIASES, number>>,
): boolean {
  const transactionType = pickCell(row, columnMap.transactionType).trim();
  if (!transactionType) return false;
  const lower = transactionType.toLowerCase();
  if (lower.startsWith("total") || bucketFromSectionLabel(lower)) return false;

  if (DATA_TRANSACTION_TYPES.has(lower)) return true;

  // Unknown QB types (e.g. regional labels) — keep if the row has a date.
  const dateRaw = columnMap.date != null ? row[columnMap.date] : undefined;
  return Boolean(formatSpreadsheetDate(dateRaw ?? ""));
}

export async function parseArAgingDetailSpreadsheet(
  file: File,
): Promise<ImportedArAgingDetailSnapshot> {
  const { rows } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");

  const asOf = parseAsOfDate(rows);
  const aliasGroups = Object.values(COLUMN_ALIASES);
  const headerRowIndex = findHeaderRowIndex(rows, aliasGroups);
  const columnMap = mapHeaders(rows[headerRowIndex] ?? [], COLUMN_ALIASES);

  if (columnMap.openBalance == null) {
    throw new Error('Could not find an "Open balance" column in the AR Ageing Detail export.');
  }

  const lines: ImportedArAgingDetailLine[] = [];
  let sectionBucket: ImportedArAgingDetailBucket | null = null;
  let totalAmount: number | undefined;
  let totalOpenBalance: number | undefined;

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (!row.some((cell) => cellText(cell))) continue;

    const detectedSection = sectionBucketFromRow(row);
    if (detectedSection) {
      sectionBucket = detectedSection;
      if (!isDataRow(row, columnMap)) continue;
    }

    const firstCell = cellText(row[0]).toLowerCase();
    // Capture QuickBooks total rows — these are the figures on the PDF footer.
    if (firstCell.startsWith("total for") || firstCell === "total") {
      const amount = parseSignedMoney(pickCell(row, columnMap.amount));
      const openBalance = parseSignedMoney(pickCell(row, columnMap.openBalance));
      if (firstCell === "total" || /91/.test(firstCell)) {
        // Prefer the grand TOTAL row; fall back to the 91+ section total.
        if (firstCell === "total" || totalAmount == null) {
          totalAmount = amount;
          totalOpenBalance = openBalance;
        }
      }
      continue;
    }
    if (!isDataRow(row, columnMap)) continue;

    const referenceNumber = pickCell(row, columnMap.number).trim();
    const transactionType = pickCell(row, columnMap.transactionType).trim();
    const date = formatSpreadsheetDate(row[columnMap.date ?? -1]);
    const dueDateRaw = pickCell(row, columnMap.dueDate);
    const dueParsed = parseReportDate(dueDateRaw);
    const dueDate = dueParsed
      ? `${dueParsed.getMonth() + 1}/${dueParsed.getDate()}/${dueParsed.getFullYear()}`
      : dueDateRaw;
    let amount = parseSignedMoney(pickCell(row, columnMap.amount));
    let openBalance = parseSignedMoney(pickCell(row, columnMap.openBalance));
    if (openBalance === 0 && amount === 0) continue;
    if (openBalance === 0) continue;

    // QB shows payments/credits as negatives; Excel sometimes exports abs values.
    if (isCreditLikeType(transactionType)) {
      if (amount > 0) amount = -amount;
      if (openBalance > 0) openBalance = -openBalance;
    }

    lines.push({
      referenceNumber,
      transactionType,
      date,
      customer: pickCell(row, columnMap.customer).trim(),
      location: pickCell(row, columnMap.location).trim(),
      dueDate,
      amount,
      openBalance,
      bucket: resolveLineBucket(dueDate, asOf, sectionBucket),
    });
  }

  if (lines.length === 0) {
    throw new Error("No open receivable rows were found in the AR Ageing Detail export.");
  }

  // If the export had no TOTAL row, use the sum of imported lines.
  if (totalAmount == null || totalOpenBalance == null) {
    totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
    totalOpenBalance = lines.reduce((sum, line) => sum + line.openBalance, 0);
  }

  const asOfLabel = `${asOf.getMonth() + 1}/${asOf.getDate()}/${asOf.getFullYear()}`;
  return { asOf: asOfLabel, lines, totalAmount, totalOpenBalance };
}

export function readImportedArAgingDetailSnapshot(): ImportedArAgingDetailSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return readLegacyImportedLines();
    const parsed = JSON.parse(raw) as ImportedArAgingDetailSnapshot;
    if (!parsed.lines?.length) return null;
    return parsed;
  } catch {
    return readLegacyImportedLines();
  }
}

function readLegacyImportedLines(): ImportedArAgingDetailSnapshot | null {
  try {
    const raw = window.localStorage.getItem("ar-aging-detail-lines");
    if (!raw) return null;
    const lines = JSON.parse(raw) as ImportedArAgingDetailLine[];
    if (!lines.length) return null;
    return { asOf: "", lines };
  } catch {
    return null;
  }
}

export function readImportedArAgingDetailLines(): ImportedArAgingDetailLine[] {
  return readImportedArAgingDetailSnapshot()?.lines ?? [];
}

export function saveImportedArAgingDetailSnapshot(snapshot: ImportedArAgingDetailSnapshot): void {
  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(snapshot));
}

export function importedArAgingDetailToLocationMap(
  lines: readonly ImportedArAgingDetailLine[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of lines) {
    const number = line.referenceNumber.trim();
    const location = line.location.trim();
    if (number && location) map.set(number, location);
  }
  return map;
}
