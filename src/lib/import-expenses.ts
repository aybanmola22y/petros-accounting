import {
  cellText,
  findHeaderRowIndex,
  mapHeaders,
  parseMoney,
  pickCell,
  readSpreadsheetRows,
} from "@/lib/import-spreadsheet-utils";
import { parseTransactionDate } from "@/lib/ledger/date-utils";

export type ParsedExpenseImportRow = {
  rowNumber: number;
  date: string;
  transactionType: string;
  referenceNumber: string;
  payee: string;
  category: string;
  totalBeforeTax: number;
  salesTax: number;
  total: number;
  isSplit: boolean;
};

export type ParseExpensesSpreadsheetResult = {
  rows: ParsedExpenseImportRow[];
  skippedRows: Array<{ rowNumber: number; reason: string }>;
  sheetName: string;
  headerRowNumber: number;
};

const COLUMN_ALIASES = {
  date: ["date", "transaction date"],
  transactionType: ["type", "transaction type"],
  referenceNumber: ["no", "number", "ref no", "reference number", "check no"],
  payee: ["payee", "vendor", "supplier", "name"],
  category: ["category", "account", "distribution account", "expense account"],
  totalBeforeTax: [
    "total before sales tax",
    "total before tax",
    "amount before tax",
    "subtotal",
  ],
  salesTax: ["sales tax", "tax", "vat"],
  total: ["total", "amount"],
} as const;

function parseImportDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = value.getMonth() + 1;
    const day = value.getDate();
    const year = value.getFullYear();
    return `${month}/${day}/${year}`;
  }

  const text = cellText(value);
  if (!text) return null;
  return parseTransactionDate(text) ? text : null;
}

function rowToExpense(
  row: unknown[],
  rowNumber: number,
  columnMap: Partial<Record<keyof typeof COLUMN_ALIASES, number>>,
): ParsedExpenseImportRow | { error: string } {
  const date = parseImportDate(row[columnMap.date ?? -1]);
  if (!date) return { error: "Missing or invalid date" };

  const transactionType = pickCell(row, columnMap.transactionType);
  if (!transactionType) return { error: "Missing transaction type" };

  const category = pickCell(row, columnMap.category);
  const totalBeforeTax = parseMoney(pickCell(row, columnMap.totalBeforeTax));
  const salesTax = parseMoney(pickCell(row, columnMap.salesTax));
  const totalRaw = pickCell(row, columnMap.total);
  const total = totalRaw ? parseMoney(totalRaw) : totalBeforeTax + salesTax;

  return {
    rowNumber,
    date,
    transactionType,
    referenceNumber: pickCell(row, columnMap.referenceNumber),
    payee: pickCell(row, columnMap.payee),
    category,
    totalBeforeTax,
    salesTax,
    total,
    isSplit: category.trim().toLowerCase() === "--split--",
  };
}

export async function parseExpensesSpreadsheet(
  file: File,
): Promise<ParseExpensesSpreadsheetResult> {
  const { rows, sheetName } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");

  const aliasGroups = Object.values(COLUMN_ALIASES);
  const headerRowIndex = findHeaderRowIndex(rows, aliasGroups);
  const columnMap = mapHeaders(rows[headerRowIndex] ?? [], COLUMN_ALIASES);

  if (columnMap.date == null) {
    throw new Error('Could not find a "Date" column.');
  }
  if (columnMap.transactionType == null) {
    throw new Error('Could not find a "Type" column.');
  }
  if (columnMap.total == null && columnMap.totalBeforeTax == null) {
    throw new Error('Could not find a "Total" or "Total before sales tax" column.');
  }

  const parsedRows: ParsedExpenseImportRow[] = [];
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (!row.some((cell) => cellText(cell))) continue;

    const rowNumber = i + 1;
    const parsed = rowToExpense(row, rowNumber, columnMap);
    if ("error" in parsed) {
      skippedRows.push({ rowNumber, reason: parsed.error });
      continue;
    }

    parsedRows.push(parsed);
  }

  if (parsedRows.length === 0) {
    throw new Error("No expense rows were found below the header row.");
  }

  return {
    rows: parsedRows,
    skippedRows,
    sheetName,
    headerRowNumber: headerRowIndex + 1,
  };
}
