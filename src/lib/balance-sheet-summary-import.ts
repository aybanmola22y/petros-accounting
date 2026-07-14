import {
  cellText,
  parseMoney,
  readSpreadsheetRows,
} from "@/lib/import-spreadsheet-utils";

export type BalanceSheetSection = "assets" | "liabilities" | "equity" | "net_income";

export type ImportedBalanceSheetAccountRow = {
  accountName: string;
  section: BalanceSheetSection;
  /** Parent group path, e.g. "Current Assets|Accounts Receivable" */
  groupPath: string;
  amount: number;
  sortOrder: number;
};

export type ImportedBalanceSheetSnapshot = {
  periodLabel: string;
  rows: ImportedBalanceSheetAccountRow[];
};

function rowLabel(row: unknown[]): string {
  return cellText(row[0]).trim();
}

function parseSignedMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cellText(value).trim();
  if (!text) return 0;
  const negative = text.startsWith("(") && text.endsWith(")");
  const amount = parseMoney(text);
  return negative ? -Math.abs(amount) : amount;
}

function isEquitySectionLabel(label: string): boolean {
  return /^shareholders?'? equity$/i.test(label.trim());
}

function isTopSectionLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return (
    normalized === "assets" ||
    normalized.includes("liabilities and shareholder") ||
    isEquitySectionLabel(label)
  );
}

function isSummaryRow(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith("total for")) return true;
  if (normalized === "assets") return true;
  if (normalized.includes("liabilities and shareholder")) return true;
  if (isEquitySectionLabel(label)) return true;
  if (normalized.includes("accrual basis")) return true;
  return false;
}

function parseFooterAsOf(rows: unknown[][]): string | null {
  const footerLimit = Math.min(5, rows.length);
  for (let i = rows.length - 1; i >= rows.length - footerLimit; i -= 1) {
    const text = rows[i]?.map(cellText).filter(Boolean).join(" ").trim() ?? "";
    if (!/accrual basis|cash basis/i.test(text)) continue;
    const dayFirst = /(\d{1,2})\s+([a-z]+),?\s+(20\d{2})/i.exec(text);
    if (dayFirst) {
      return `${dayFirst[1]} ${dayFirst[2]} ${dayFirst[3]}`;
    }
    const monthFirst = /([a-z]+)\s+(\d{1,2}),?\s+(20\d{2})/i.exec(text);
    if (monthFirst) {
      return `${monthFirst[2]} ${monthFirst[1]} ${monthFirst[3]}`;
    }
  }
  return null;
}

function parsePeriodLabel(rows: unknown[][]): string {
  let allDates = false;

  const headerLimit = Math.min(rows.length, 12);
  for (let i = 0; i < headerLimit; i += 1) {
    const text = rows[i]?.map(cellText).filter(Boolean).join(" ").trim() ?? "";
    if (/as of/i.test(text)) return text;
    if (/^all dates$/i.test(text)) allDates = true;
    const label = rowLabel(rows[i] ?? []);
    if (/^all dates$/i.test(label)) allDates = true;
  }

  const footerAsOf = parseFooterAsOf(rows);
  if (allDates) {
    return footerAsOf ? `All Dates (as of ${footerAsOf})` : "All Dates";
  }

  if (footerAsOf) {
    return `As of ${footerAsOf}`;
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

function amountCellEmpty(row: unknown[], totalColumn: number): boolean {
  const raw = row[totalColumn];
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "number") return false;
  return cellText(raw).trim() === "";
}

function popGroupForTotal(label: string, groupStack: string[]): void {
  const match = /^Total for (.+)$/i.exec(label.trim());
  if (!match) return;
  const name = match[1].trim();
  const index = groupStack.lastIndexOf(name);
  if (index >= 0) groupStack.splice(index);
}

export function isBalanceSheetSummarySpreadsheet(rows: unknown[][]): boolean {
  const limit = Math.min(rows.length, 12);
  for (let i = 0; i < limit; i += 1) {
    const text = rowLabel(rows[i] ?? []).toLowerCase();
    if (text.includes("balance sheet")) return true;
  }
  return false;
}

export async function parseBalanceSheetSummarySpreadsheet(
  file: File,
): Promise<ImportedBalanceSheetSnapshot> {
  const { rows } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");
  if (!isBalanceSheetSummarySpreadsheet(rows)) {
    throw new Error("This file does not look like a QuickBooks Balance Sheet export.");
  }

  const periodLabel = parsePeriodLabel(rows);
  const totalColumn = findTotalColumnIndex(rows);
  let section: Exclude<BalanceSheetSection, "net_income"> | null = null;
  const groupStack: string[] = [];
  const parsedRows: ImportedBalanceSheetAccountRow[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const label = rowLabel(row);
    if (!label) continue;

    const normalized = label.trim().toLowerCase();
    if (normalized === "assets") {
      section = "assets";
      groupStack.length = 0;
      continue;
    }
    if (normalized.includes("liabilities and shareholder")) {
      section = "liabilities";
      groupStack.length = 0;
      continue;
    }
    if (isEquitySectionLabel(label)) {
      section = "equity";
      groupStack.length = 0;
      groupStack.push(label.trim());
      continue;
    }

    if (isSummaryRow(label)) {
      popGroupForTotal(label, groupStack);
      continue;
    }

    if (!section) continue;

    if (amountCellEmpty(row, totalColumn)) {
      if (!isTopSectionLabel(label)) {
        groupStack.push(label);
      }
      continue;
    }

    const amount = parseSignedMoney(row[totalColumn]);
    if (amount === 0) continue;

    const isNetIncome = normalized === "net income";
    parsedRows.push({
      accountName: label,
      section: isNetIncome ? "net_income" : section,
      groupPath: groupStack.join("|"),
      amount,
      sortOrder: parsedRows.length + 1,
    });
  }

  if (parsedRows.length === 0) {
    throw new Error("No account rows were found in the Balance Sheet export.");
  }

  return { periodLabel, rows: parsedRows };
}
