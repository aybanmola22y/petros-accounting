import { parseTransactionDate } from "@/lib/ledger/date-utils";
import {
  cellText,
  findHeaderRowIndex,
  mapHeaders,
  parseMoney,
  pickCell,
  readSpreadsheetRows,
  SPREADSHEET_IMPORT_ACCEPT,
} from "@/lib/import-spreadsheet-utils";

export type ParsedUnpaidBillImportRow = {
  rowNumber: number;
  supplierName: string;
  dueDate: string;
  billAmount: number;
  openBalance: number;
  status: string;
  billNo?: string;
};

export type ParseUnpaidBillsSpreadsheetResult = {
  rows: ParsedUnpaidBillImportRow[];
  skippedRows: Array<{ rowNumber: number; reason: string }>;
  sheetName: string;
  headerRowNumber: number;
};

const COLUMN_ALIASES = {
  supplier: ["supplier", "vendor", "payee", "vendor name", "supplier name"],
  dueDate: ["due date", "duedate"],
  billAmount: ["amount", "bill amount", "original amount"],
  openBalance: ["balance", "open balance", "amount due", "open amount"],
  status: ["status"],
  billNo: ["no", "num", "number", "bill no", "bill number", "ref no", "reference number"],
} as const;

export const UNPAID_BILLS_IMPORT_ACCEPT = SPREADSHEET_IMPORT_ACCEPT;

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

function rowToUnpaidBill(
  row: unknown[],
  rowNumber: number,
  columnMap: Partial<Record<keyof typeof COLUMN_ALIASES, number>>,
): ParsedUnpaidBillImportRow | { error: string } {
  const supplierName = pickCell(row, columnMap.supplier);
  if (!supplierName) return { error: "Missing supplier name" };

  const dueDate = parseImportDate(row[columnMap.dueDate ?? -1]);
  if (!dueDate) return { error: "Missing or invalid due date" };

  const billAmount = parseMoney(pickCell(row, columnMap.billAmount));
  const balanceRaw = pickCell(row, columnMap.openBalance);
  const openBalance = balanceRaw ? parseMoney(balanceRaw) : billAmount;
  if (billAmount <= 0 && openBalance <= 0) {
    return { error: "Missing bill amount or open balance" };
  }

  const status = pickCell(row, columnMap.status) || "Open";
  const billNo = pickCell(row, columnMap.billNo).trim();

  return {
    rowNumber,
    supplierName,
    dueDate,
    billAmount: billAmount > 0 ? billAmount : openBalance,
    openBalance: openBalance > 0 ? openBalance : billAmount,
    status,
    billNo: billNo || undefined,
  };
}

export async function parseUnpaidBillsSpreadsheet(
  file: File,
): Promise<ParseUnpaidBillsSpreadsheetResult> {
  const { rows, sheetName } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");

  const aliasGroups = Object.values(COLUMN_ALIASES);
  const headerRowIndex = findHeaderRowIndex(rows, aliasGroups);
  const columnMap = mapHeaders(rows[headerRowIndex] ?? [], COLUMN_ALIASES);

  if (columnMap.supplier == null) {
    throw new Error('Could not find a "Supplier" column in the spreadsheet.');
  }
  if (columnMap.dueDate == null) {
    throw new Error('Could not find a "Due Date" column in the spreadsheet.');
  }
  if (columnMap.openBalance == null && columnMap.billAmount == null) {
    throw new Error('Could not find an "amount" or "balance" column in the spreadsheet.');
  }

  const parsedRows: ParsedUnpaidBillImportRow[] = [];
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (!row.some((cell) => cellText(cell))) continue;

    const rowNumber = i + 1;
    const parsed = rowToUnpaidBill(row, rowNumber, columnMap);
    if ("error" in parsed) {
      skippedRows.push({ rowNumber, reason: parsed.error });
      continue;
    }

    parsedRows.push(parsed);
  }

  if (parsedRows.length === 0) {
    throw new Error("No unpaid bill rows were found below the header row.");
  }

  return {
    rows: parsedRows,
    skippedRows,
    sheetName,
    headerRowNumber: headerRowIndex + 1,
  };
}
