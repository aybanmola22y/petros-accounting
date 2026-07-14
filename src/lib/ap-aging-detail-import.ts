import {
  cellText,
  findHeaderRowIndex,
  mapHeaders,
  normalizeHeader,
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

const STORAGE_KEY = "ap-aging-detail-snapshot";

const COLUMN_ALIASES = {
  date: ["date"],
  transactionType: ["transaction type", "type"],
  number: ["no", "num", "number"],
  // Prefer specific labels — do NOT include bare "name" here (QBO often has both
  // an empty Name column and a filled Supplier/Vendor column; "name" would win first).
  supplier: [
    "supplier",
    "supplier full name",
    "supplier name",
    "vendor",
    "vendor full name",
    "vendor name",
    "payee",
  ],
  location: ["location", "location full name", "location name"],
  dueDate: ["due date"],
  pastDue: ["past due", "days past due", "aging"],
  amount: ["amount"],
  openBalance: ["open balance", "balance", "open bal"],
} as const;

const DATA_TRANSACTION_TYPES = new Set([
  "bill",
  "supplier credit",
  "vendor credit",
  "bill payment",
  "bill payment (cheque)",
  "bill payment (check)",
  "expense",
  "cheque",
  "check",
  "journal entry",
  "credit card credit",
  "credit card expense",
]);

export type ImportedApAgingDetailBucket =
  | "current"
  | "days1to30"
  | "days31to60"
  | "days61to90"
  | "days91plus";

export type ImportedApAgingDetailLine = {
  referenceNumber: string;
  transactionType: string;
  date: string;
  supplier: string;
  location: string;
  dueDate: string;
  pastDueDays?: number;
  amount: number;
  openBalance: number;
  bucket: ImportedApAgingDetailBucket;
};

export type ImportedApAgingDetailSnapshot = {
  asOf: string;
  lines: ImportedApAgingDetailLine[];
  totalAmount?: number;
  totalOpenBalance?: number;
};

function bucketKeyForDaysPastDue(daysPastDue: number): ImportedApAgingDetailBucket {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "days1to30";
  if (daysPastDue <= 60) return "days31to60";
  if (daysPastDue <= 90) return "days61to90";
  return "days91plus";
}

function rowLabel(row: unknown[]): string {
  return row.map(cellText).filter(Boolean).join(" ").trim();
}

function bucketFromSectionLabel(label: string): ImportedApAgingDetailBucket | null {
  const lower = label.trim().toLowerCase();
  if (!lower || lower.startsWith("total for") || lower === "total") return null;
  if (/91/.test(lower) && /(or more|and over|\+)/.test(lower)) return "days91plus";
  if (/61\s*[-–—]\s*90/.test(lower)) return "days61to90";
  if (/31\s*[-–—]\s*60/.test(lower)) return "days31to60";
  if (/\b1\s*[-–—]\s*30\b/.test(lower)) return "days1to30";
  if (lower === "current" || lower.startsWith("current")) return "current";
  return null;
}

function sectionBucketFromRow(row: unknown[]): ImportedApAgingDetailBucket | null {
  for (const cell of row) {
    const bucket = bucketFromSectionLabel(cellText(cell));
    if (bucket) return bucket;
  }
  return bucketFromSectionLabel(rowLabel(row));
}

function parseSignedMoney(value: unknown): number {
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
  sectionBucket: ImportedApAgingDetailBucket | null,
): ImportedApAgingDetailBucket {
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
    type === "supplier credit" ||
    type === "vendor credit" ||
    type === "bill payment" ||
    type.includes("bill payment") ||
    type === "cheque" ||
    type === "check" ||
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
  const dateRaw = columnMap.date != null ? row[columnMap.date] : undefined;
  return Boolean(formatSpreadsheetDate(dateRaw ?? ""));
}

/** Map Supplier/Vendor even when export labels vary. */
function mapApAgingHeaders(headerRow: unknown[]) {
  const map = mapHeaders(headerRow, COLUMN_ALIASES);
  const normalized = headerRow.map(normalizeHeader);

  const preferIdx = normalized.findIndex(
    (header) =>
      header === "supplier" ||
      header === "supplier full name" ||
      header === "supplier name" ||
      header === "vendor" ||
      header === "vendor full name" ||
      header === "vendor name",
  );
  if (preferIdx >= 0) {
    map.supplier = preferIdx;
  } else if (map.supplier == null) {
    const fuzzy = normalized.findIndex(
      (header) =>
        header.includes("supplier") ||
        (header.includes("vendor") && !header.includes("credit")) ||
        header === "payee" ||
        header === "name" ||
        header === "display name",
    );
    if (fuzzy >= 0) map.supplier = fuzzy;
  }

  return map;
}

/** QuickBooks often lists the supplier as a group header above its bills. */
function supplierGroupHeaderName(
  row: unknown[],
  columnMap: Partial<Record<keyof typeof COLUMN_ALIASES, number>>,
): string | null {
  if (isDataRow(row, columnMap)) return null;

  const fromCol = pickCell(row, columnMap.supplier).trim();
  const first = cellText(row[0]).trim();
  const candidate = fromCol || first;
  if (!candidate) return null;

  const lower = candidate.toLowerCase();
  if (lower.startsWith("total") || bucketFromSectionLabel(lower)) return null;
  if (
    lower.startsWith("as of") ||
    lower.includes("ageing detail") ||
    lower.includes("aging detail") ||
    lower === "distribution account"
  ) {
    return null;
  }

  const amount = parseSignedMoney(pickCell(row, columnMap.amount));
  const openBalance = parseSignedMoney(pickCell(row, columnMap.openBalance));
  if (amount !== 0 || openBalance !== 0) return null;

  return candidate;
}

export async function parseApAgingDetailSpreadsheet(
  file: File,
): Promise<ImportedApAgingDetailSnapshot> {
  const { rows } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");

  const asOf = parseAsOfDate(rows);
  const aliasGroups = Object.values(COLUMN_ALIASES);
  const headerRowIndex = findHeaderRowIndex(rows, aliasGroups);
  const columnMap = mapApAgingHeaders(rows[headerRowIndex] ?? []);

  if (columnMap.openBalance == null) {
    throw new Error('Could not find an "Open balance" column in the A/P Ageing Detail export.');
  }

  const lines: ImportedApAgingDetailLine[] = [];
  let sectionBucket: ImportedApAgingDetailBucket | null = null;
  let currentSupplier = "";
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
    if (firstCell.startsWith("total for") || firstCell === "total") {
      const amount = parseSignedMoney(pickCell(row, columnMap.amount));
      const openBalance = parseSignedMoney(pickCell(row, columnMap.openBalance));
      if (firstCell === "total" || /91/.test(firstCell)) {
        if (firstCell === "total" || totalAmount == null) {
          totalAmount = amount;
          totalOpenBalance = openBalance;
        }
      }
      continue;
    }

    const groupName = supplierGroupHeaderName(row, columnMap);
    if (groupName) {
      currentSupplier = groupName;
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

    if (isCreditLikeType(transactionType)) {
      if (amount > 0) amount = -amount;
      if (openBalance > 0) openBalance = -openBalance;
    }

    const pastDueRaw = columnMap.pastDue != null ? pickCell(row, columnMap.pastDue) : "";
    const pastDueParsed = Number.parseInt(pastDueRaw.replace(/[^\d-]/g, ""), 10);
    const pastDueDays = Number.isFinite(pastDueParsed) ? pastDueParsed : undefined;

    const supplierFromCell = pickCell(row, columnMap.supplier).trim();
    if (supplierFromCell) currentSupplier = supplierFromCell;

    lines.push({
      referenceNumber,
      transactionType,
      date,
      supplier: supplierFromCell || currentSupplier,
      location: pickCell(row, columnMap.location).trim(),
      dueDate,
      pastDueDays,
      amount,
      openBalance,
      bucket: resolveLineBucket(dueDate, asOf, sectionBucket),
    });
  }

  if (lines.length === 0) {
    throw new Error("No open payable rows were found in the A/P Ageing Detail export.");
  }

  if (totalAmount == null || totalOpenBalance == null) {
    totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
    totalOpenBalance = lines.reduce((sum, line) => sum + line.openBalance, 0);
  }

  const asOfLabel = `${asOf.getMonth() + 1}/${asOf.getDate()}/${asOf.getFullYear()}`;
  return { asOf: asOfLabel, lines, totalAmount, totalOpenBalance };
}

export function readImportedApAgingDetailSnapshot(): ImportedApAgingDetailSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportedApAgingDetailSnapshot;
    if (!parsed.lines?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveImportedApAgingDetailSnapshot(snapshot: ImportedApAgingDetailSnapshot): void {
  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(snapshot));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ap-aging-detail-imported"));
  }
}
