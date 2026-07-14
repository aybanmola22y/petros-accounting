import {
  cellText,
  parseMoney,
  readSpreadsheetRows,
} from "@/lib/import-spreadsheet-utils";

export type ProfitLossSection =
  | "income"
  | "cost_of_sales"
  | "expenses"
  | "other_income"
  | "other_expenses";

export type ImportedProfitLossAccountRow = {
  accountName: string;
  section: ProfitLossSection;
  amount: number;
};

export type ImportedProfitLossSnapshot = {
  periodLabel: string;
  rows: ImportedProfitLossAccountRow[];
};

function rowLabel(row: unknown[]): string {
  return cellText(row[0]).trim();
}

function parseSignedMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cellText(value).trim();
  const negative = text.startsWith("(") && text.endsWith(")");
  const amount = parseMoney(text);
  return negative ? -Math.abs(amount) : amount;
}

function detectSection(label: string): ProfitLossSection | null {
  const normalized = label.trim().toLowerCase();
  if (normalized === "income") return "income";
  if (normalized === "cost of sales" || normalized === "cost of goods sold") {
    return "cost_of_sales";
  }
  if (normalized === "expenses") return "expenses";
  if (normalized === "other income") return "other_income";
  if (normalized === "other expenses") return "other_expenses";
  return null;
}

function isSummaryRow(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith("total ")) return true;
  if (normalized === "gross profit") return true;
  if (normalized === "net income" || normalized === "net earnings") return true;
  if (normalized === "net operating income") return true;
  if (normalized.includes("profit and loss")) return true;
  return false;
}

function parsePeriodLabel(rows: unknown[][]): string {
  const limit = Math.min(rows.length, 12);
  for (let i = 0; i < limit; i += 1) {
    const text = rows[i]?.map(cellText).filter(Boolean).join(" ").trim() ?? "";
    if (/january|february|march|april|may|june|july|august|september|october|november|december/i.test(text)) {
      return text;
    }
    if (/\d{4}/.test(text) && text.includes("-")) return text;
  }
  return "";
}

function findTotalColumnIndex(rows: unknown[][]): number {
  const limit = Math.min(rows.length, 25);
  for (let i = 0; i < limit; i += 1) {
    const row = rows[i] ?? [];
    for (let col = 0; col < row.length; col += 1) {
      if (cellText(row[col]).trim().toLowerCase() === "total") {
        return col;
      }
    }
  }
  return 1;
}

export function isProfitLossSummarySpreadsheet(rows: unknown[][]): boolean {
  const limit = Math.min(rows.length, 12);
  for (let i = 0; i < limit; i += 1) {
    const text = rowLabel(rows[i] ?? []).toLowerCase();
    if (text.includes("profit and loss") || text.includes("profit & loss")) {
      return true;
    }
  }
  return false;
}

export async function parseProfitLossSummarySpreadsheet(
  file: File,
): Promise<ImportedProfitLossSnapshot> {
  const { rows } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");
  if (!isProfitLossSummarySpreadsheet(rows)) {
    throw new Error("This file does not look like a QuickBooks Profit and Loss export.");
  }

  const periodLabel = parsePeriodLabel(rows);
  const totalColumn = findTotalColumnIndex(rows);
  let currentSection: ProfitLossSection | null = null;
  const parsedRows: ImportedProfitLossAccountRow[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const label = rowLabel(row);
    if (!label) continue;

    const section = detectSection(label);
    if (section) {
      currentSection = section;
      continue;
    }

    if (!currentSection || isSummaryRow(label)) continue;

    const amount = parseSignedMoney(row[totalColumn]);
    if (amount === 0) continue;

    parsedRows.push({
      accountName: label,
      section: currentSection,
      amount,
    });
  }

  if (parsedRows.length === 0) {
    throw new Error("No account rows were found in the Profit and Loss export.");
  }

  return { periodLabel, rows: parsedRows };
}
