import {
  cellText,
  findHeaderRowIndex,
  mapHeaders,
  parseMoney,
  pickCell,
  readSpreadsheetRows,
  SPREADSHEET_IMPORT_ACCEPT,
} from "@/lib/import-spreadsheet-utils";
import { parseTransactionDate } from "@/lib/ledger/date-utils";

export type ParsedSalesTransactionImportRow = {
  rowNumber: number;
  date: string;
  transactionType: string;
  referenceNumber: string;
  customer: string;
  memo: string;
  location?: string;
  incomeAccount?: string;
  amount: number;
  status: string;
};

export type ParseSalesTransactionsSpreadsheetResult = {
  rows: ParsedSalesTransactionImportRow[];
  skippedRows: Array<{ rowNumber: number; reason: string }>;
  sheetName: string;
  headerRowNumber: number;
};

const COLUMN_ALIASES = {
  date: ["date", "transaction date"],
  transactionType: ["type", "transaction type"],
  referenceNumber: ["no", "number", "ref no", "reference number"],
  customer: ["customer", "customer name", "name", "display name"],
  memo: ["memo", "description"],
  location: ["location", "location full name", "location name", "department"],
  amount: ["amount", "total"],
  status: ["status"],
  incomeAccount: ["income account", "account", "distribution account", "category"],
} as const;

export const SALES_TRANSACTIONS_IMPORT_ACCEPT = SPREADSHEET_IMPORT_ACCEPT;

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

function rowToSalesTransaction(
  row: unknown[],
  rowNumber: number,
  columnMap: Partial<Record<keyof typeof COLUMN_ALIASES, number>>,
): ParsedSalesTransactionImportRow | { error: string } {
  const date = parseImportDate(row[columnMap.date ?? -1]);
  if (!date) return { error: "Missing or invalid date" };

  const transactionType = pickCell(row, columnMap.transactionType);
  if (!transactionType) return { error: "Missing transaction type" };

  const amountRaw = pickCell(row, columnMap.amount);
  const amount = Math.abs(parseMoney(amountRaw));
  const status = pickCell(row, columnMap.status) || "open";
  const memo = pickCell(row, columnMap.memo);

  return {
    rowNumber,
    date,
    transactionType,
    referenceNumber: pickCell(row, columnMap.referenceNumber),
    customer: pickCell(row, columnMap.customer),
    memo,
    location: pickCell(row, columnMap.location),
    incomeAccount: pickCell(row, columnMap.incomeAccount),
    amount,
    status,
  };
}

export async function parseSalesTransactionsSpreadsheet(
  file: File,
): Promise<ParseSalesTransactionsSpreadsheetResult> {
  const { rows, sheetName } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");

  const aliasGroups = Object.values(COLUMN_ALIASES);
  const headerRowIndex = findHeaderRowIndex(rows, aliasGroups);
  const columnMap = mapHeaders(rows[headerRowIndex] ?? [], COLUMN_ALIASES);

  if (columnMap.date == null) {
    throw new Error('Could not find a "Date" column in the spreadsheet.');
  }
  if (columnMap.transactionType == null) {
    throw new Error('Could not find a "Type" column in the spreadsheet.');
  }
  if (columnMap.amount == null) {
    throw new Error('Could not find an "Amount" column in the spreadsheet.');
  }

  const parsedRows: ParsedSalesTransactionImportRow[] = [];
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (!row.some((cell) => cellText(cell))) continue;

    const rowNumber = i + 1;
    const parsed = rowToSalesTransaction(row, rowNumber, columnMap);
    if ("error" in parsed) {
      skippedRows.push({ rowNumber, reason: parsed.error });
      continue;
    }

    parsedRows.push(parsed);
  }

  if (parsedRows.length === 0) {
    throw new Error("No sales transaction rows were found below the header row.");
  }

  return {
    rows: parsedRows,
    skippedRows,
    sheetName,
    headerRowNumber: headerRowIndex + 1,
  };
}
