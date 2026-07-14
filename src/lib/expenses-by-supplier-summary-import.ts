import {
  cellText,
  mapHeaders,
  normalizeHeader,
  parseMoney,
  pickCell,
  readSpreadsheetRows,
  safeLocalStorageSet,
  scoreHeaderRow,
} from "@/lib/import-spreadsheet-utils";
import { parseReportDate, startOfDay } from "@/lib/report-date-utils";

const STORAGE_KEY = "expenses-by-supplier-summary-snapshot";

const COLUMN_ALIASES = {
  supplier: [
    "supplier",
    "supplier full name",
    "supplier name",
    "vendor",
    "vendor full name",
    "vendor name",
    "payee",
    "name",
    "display name",
  ],
  amount: ["total", "amount", "sum", "balance"],
} as const;

export type ImportedExpensesBySupplierRow = {
  supplier: string;
  amount: number;
};

export type ImportedExpensesBySupplierSnapshot = {
  /** Period / as-of label from the QuickBooks export header when available. */
  periodLabel: string;
  rows: ImportedExpensesBySupplierRow[];
  /** QuickBooks TOTAL row — authoritative when present. */
  totalAmount?: number;
};

function rowLabel(row: unknown[]): string {
  return row.map(cellText).filter(Boolean).join(" ").trim();
}

function parseSignedMoney(value: unknown): number {
  return parseMoney(value);
}

function parsePeriodLabel(rows: unknown[][]): string {
  const limit = Math.min(rows.length, 14);
  for (let i = 0; i < limit; i += 1) {
    const text = rowLabel(rows[i] ?? []);
    if (!text) continue;
    if (/expenses by (supplier|vendor)/i.test(text)) continue;
    if (/^total$/i.test(text.trim())) continue;
    if (
      /\d{4}/.test(text) ||
      /january|february|march|april|may|june|july|august|september|october|november|december/i.test(
        text,
      ) ||
      /this year|year to date|custom/i.test(text)
    ) {
      return text;
    }
    const asOf =
      text.match(/as of\s+(\d{1,2}\/\d{1,2}\/\d{4})/i) ??
      text.match(/as of\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
    if (asOf?.[1]) {
      const parsed = parseReportDate(asOf[1]);
      if (parsed) {
        const d = startOfDay(parsed);
        return `As of ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      }
    }
  }
  return "";
}

/**
 * QuickBooks Expenses by Supplier Summary often has a blank first header cell
 * and only "Total" in the amount column — score 1, not 2.
 */
function findSummaryHeaderRowIndex(rows: unknown[][]): number {
  const aliasGroups = Object.values(COLUMN_ALIASES);
  let bestIndex = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 30);

  for (let i = 0; i < limit; i += 1) {
    const row = rows[i] ?? [];
    const score = scoreHeaderRow(row, aliasGroups);
    const normalized = row.map(normalizeHeader);
    const hasTotal = normalized.some(
      (header) => header === "total" || header === "amount" || header.includes("total"),
    );
    const hasSupplier = normalized.some(
      (header) =>
        header.includes("supplier") ||
        header.includes("vendor") ||
        header === "name" ||
        header === "payee",
    );

    // Prefer a real Total/Amount header even when Supplier header is blank.
    const effective = Math.max(score, hasTotal ? 1 : 0) + (hasSupplier ? 1 : 0);
    if (effective > bestScore) {
      bestScore = effective;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0 && bestScore >= 1) return bestIndex;

  // Fallback: first row after titles that is followed by name+money data pairs.
  for (let i = 0; i < limit - 1; i += 1) {
    const next = rows[i + 1] ?? [];
    const name = cellText(next[0]).trim();
    const money = parseSignedMoney(next[next.length - 1]);
    if (name && !/^total$/i.test(name) && money !== 0) {
      return i;
    }
  }

  throw new Error("Could not find a header row. Export from QuickBooks with column headers.");
}

function mapSummaryHeaders(headerRow: unknown[]) {
  const map = mapHeaders(headerRow, COLUMN_ALIASES);
  const normalized = headerRow.map(normalizeHeader);

  if (map.supplier == null) {
    const idx = normalized.findIndex(
      (header) =>
        header.includes("supplier") ||
        header.includes("vendor") ||
        header === "name" ||
        header === "payee",
    );
    if (idx >= 0) map.supplier = idx;
  }

  if (map.amount == null) {
    const idx = normalized.findIndex(
      (header) =>
        header === "total" ||
        header === "amount" ||
        header.includes("total") ||
        header === "sum",
    );
    if (idx >= 0) map.amount = idx;
  }

  // QB: blank supplier header + "Total" on the right → col 0 / last col
  if (map.amount == null && headerRow.length > 0) {
    map.amount = headerRow.length - 1;
  }
  if (map.supplier == null) {
    map.supplier = 0;
  }

  // Ensure supplier and amount are different columns when possible
  if (map.supplier === map.amount && headerRow.length > 1) {
    map.supplier = 0;
    map.amount = headerRow.length - 1;
  }

  return map;
}

function looksLikeReportJunk(supplier: string): boolean {
  const lower = supplier.toLowerCase();
  return (
    /expenses by (supplier|vendor)/i.test(lower) ||
    lower.includes("accrual basis") ||
    lower.includes("cash basis") ||
    lower.includes("petrosphere inc") ||
    lower.startsWith("as of ") ||
    lower.includes("distribution account")
  );
}

export async function parseExpensesBySupplierSummarySpreadsheet(
  file: File,
): Promise<ImportedExpensesBySupplierSnapshot> {
  const { rows } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");

  const periodLabel = parsePeriodLabel(rows);
  const headerRowIndex = findSummaryHeaderRowIndex(rows);
  const columnMap = mapSummaryHeaders(rows[headerRowIndex] ?? []);

  const lines: ImportedExpensesBySupplierRow[] = [];
  let totalAmount: number | undefined;

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (!row.some((cell) => cellText(cell))) continue;

    const supplier = pickCell(row, columnMap.supplier).trim();
    const amount = parseSignedMoney(pickCell(row, columnMap.amount));
    const lower = supplier.toLowerCase();

    if (!supplier && amount === 0) continue;

    if (lower === "total" || lower === "totals" || lower.startsWith("total ")) {
      totalAmount = amount;
      continue;
    }

    if (!supplier || looksLikeReportJunk(supplier)) continue;
    if (amount === 0) continue;

    lines.push({ supplier, amount });
  }

  // Some exports put TOTAL before detail or without a labeled header — try whole sheet.
  if (lines.length === 0) {
    for (let i = 0; i < rows.length; i += 1) {
      if (i === headerRowIndex) continue;
      const row = rows[i] ?? [];
      const supplier = cellText(row[0]).trim();
      const amount = parseSignedMoney(row[row.length - 1]);
      const lower = supplier.toLowerCase();
      if (!supplier || amount === 0 || looksLikeReportJunk(supplier)) continue;
      if (lower === "total" || lower === "totals" || lower.startsWith("total ")) {
        totalAmount = amount;
        continue;
      }
      lines.push({ supplier, amount });
    }
  }

  if (lines.length === 0) {
    throw new Error("No supplier expense rows were found in the export.");
  }

  if (totalAmount == null) {
    totalAmount = lines.reduce((sum, row) => sum + row.amount, 0);
  }

  return { periodLabel, rows: lines, totalAmount };
}

export function readImportedExpensesBySupplierSnapshot(): ImportedExpensesBySupplierSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportedExpensesBySupplierSnapshot;
    if (!parsed.rows?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveImportedExpensesBySupplierSnapshot(
  snapshot: ImportedExpensesBySupplierSnapshot,
): void {
  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(snapshot));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("expenses-by-supplier-summary-imported"));
  }
}
