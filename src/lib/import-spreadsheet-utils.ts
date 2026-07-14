import { loadXlsx } from "@/lib/load-xlsx";

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\ufeff/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

export function parseMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = cellText(value);
  if (!text || text === "-") return 0;

  const parenNegative = /^\(.*\)$/.test(text.trim());
  const cleaned = text.replace(/[₱$,\s()]/g, "");
  const negative = parenNegative || cleaned.startsWith("-");
  const amountStr = cleaned.replace(/^-+/, "").replace(/^(?:php|usd|eur|gbp|aud|cad)/i, "");
  if (!amountStr) return 0;

  const n = Number.parseFloat(amountStr);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : Math.abs(n);
}

export function scoreHeaderRow(cells: unknown[], aliasGroups: readonly (readonly string[])[]): number {
  const normalized = cells.map(normalizeHeader);
  let score = 0;
  for (const aliases of aliasGroups) {
    if (aliases.some((alias) => normalized.includes(normalizeHeader(alias)))) score += 1;
  }
  return score;
}

export function mapHeaders(
  cells: unknown[],
  columnAliases: Record<string, readonly string[]>,
): Partial<Record<string, number>> {
  const normalized = cells.map(normalizeHeader);
  const map: Partial<Record<string, number>> = {};

  for (const [key, aliases] of Object.entries(columnAliases)) {
    const index = normalized.findIndex((header) =>
      aliases.some((alias) => normalizeHeader(alias) === header),
    );
    if (index >= 0) map[key] = index;
  }

  return map;
}

/** Fuzzy header match when exact aliases miss QuickBooks export variants. */
export function mapHeadersWithFuzzyBalance(
  cells: unknown[],
  columnAliases: Record<string, readonly string[]>,
): Partial<Record<string, number>> {
  const map = mapHeaders(cells, columnAliases);
  const normalized = cells.map(normalizeHeader);

  if (map.bankBalance == null) {
    const bankIdx = normalized.findIndex(
      (header) => header.includes("bank") && header.includes("balance"),
    );
    if (bankIdx >= 0) map.bankBalance = bankIdx;
  }

  if (map.balance == null) {
    const qbIdx = normalized.findIndex(
      (header) =>
        header.includes("quickbooks") &&
        header.includes("balance") &&
        !header.includes("bank"),
    );
    if (qbIdx >= 0) {
      map.balance = qbIdx;
    } else {
      const balanceIdx = normalized.findIndex(
        (header) =>
          (header === "balance" ||
            header === "total balance" ||
            header === "ending balance" ||
            header === "current balance") &&
          !header.includes("bank"),
      );
      if (balanceIdx >= 0) map.balance = balanceIdx;
    }
  }

  return map;
}

export function pickCell(row: unknown[], index: number | undefined): string {
  if (index == null || index < 0) return "";
  return cellText(row[index]);
}

export function parseCsv(text: string): unknown[][] {
  const rows: unknown[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === "," || char === "\t")) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }

  return rows;
}

export async function readSpreadsheetRows(
  file: File,
): Promise<{ rows: unknown[][]; sheetName: string }> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv") || lowerName.endsWith(".txt")) {
    const text = await file.text();
    return { rows: parseCsv(text), sheetName: file.name };
  }

  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0] ?? "Sheet1";
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("The spreadsheet has no readable sheets.");
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];
  return { rows, sheetName };
}

export function findHeaderRowIndex(
  rows: unknown[][],
  aliasGroups: readonly (readonly string[])[],
): number {
  let bestIndex = 0;
  let bestScore = 0;
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i += 1) {
    const score = scoreHeaderRow(rows[i] ?? [], aliasGroups);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  if (bestScore < 2) {
    throw new Error("Could not find a header row. Export from QuickBooks with column headers.");
  }
  return bestIndex;
}

export const SPREADSHEET_IMPORT_ACCEPT = ".xls,.xlsx,.csv,.tsv";

/** Best-effort browser cache — never throws when quota is exceeded. */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
