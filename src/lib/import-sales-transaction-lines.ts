import {
  cellText,
  findHeaderRowIndex,
  mapHeaders,
  parseMoney,
  pickCell,
  readSpreadsheetRows,
  SPREADSHEET_IMPORT_ACCEPT,
} from "@/lib/import-spreadsheet-utils";

export type ParsedSalesTransactionLineRow = {
  rowNumber: number;
  referenceNumber: string;
  transactionType: string;
  productService: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  sortOrder: number;
};

export type ParseSalesTransactionLinesResult = {
  rows: ParsedSalesTransactionLineRow[];
  skippedRows: Array<{ rowNumber: number; reason: string }>;
  sheetName: string;
  headerRowNumber: number;
  invoiceCount: number;
  productCount: number;
};

const COLUMN_ALIASES = {
  transactionDate: ["transaction date", "date"],
  transactionType: ["transaction type", "type"],
  referenceNumber: ["number", "no", "ref no", "reference number", "num"],
  customer: ["customer full name", "customer", "name"],
  description: ["description", "memo"],
  quantity: ["quantity", "qty"],
  salesPrice: ["sales price", "rate", "price", "unit price"],
  amount: ["amount", "total"],
} as const;

export const SALES_TRANSACTION_LINES_IMPORT_ACCEPT = SPREADSHEET_IMPORT_ACCEPT;

function parseQty(value: unknown): number {
  const text = cellText(value).replace(/,/g, "");
  if (!text) return 1;
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : 1;
}

export async function parseSalesTransactionLinesSpreadsheet(
  file: File,
): Promise<ParseSalesTransactionLinesResult> {
  const { rows, sheetName } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");

  const aliasGroups = Object.values(COLUMN_ALIASES);
  const headerRowIndex = findHeaderRowIndex(rows, aliasGroups);
  const columnMap = mapHeaders(rows[headerRowIndex] ?? [], COLUMN_ALIASES);

  if (columnMap.referenceNumber == null) {
    throw new Error('Could not find a "Number" column. Export the Sales by Product/Service Detail report.');
  }
  if (columnMap.amount == null) {
    throw new Error('Could not find an "Amount" column in the spreadsheet.');
  }

  const parsedRows: ParsedSalesTransactionLineRow[] = [];
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];
  const invoices = new Set<string>();
  const products = new Set<string>();

  let currentProduct = "";
  let sortOrder = 0;

  const firstDataColumn = Math.min(
    ...[
      columnMap.transactionDate,
      columnMap.transactionType,
      columnMap.referenceNumber,
    ].filter((v): v is number => v != null),
  );

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (!row.some((cell) => cellText(cell))) continue;
    const rowNumber = i + 1;

    const reference = pickCell(row, columnMap.referenceNumber);
    const date = pickCell(row, columnMap.transactionDate);
    const type = pickCell(row, columnMap.transactionType);

    // Leading label cell (before the first data column) identifies group/total rows.
    const labelCell = cellText(row[0]);
    const isLabelRow = labelCell && firstDataColumn > 0 && !reference && !date && !type;

    if (isLabelRow) {
      if (labelCell.toLowerCase().startsWith("total for")) {
        // End of a product group — keep currentProduct until the next group header.
        continue;
      }
      currentProduct = labelCell;
      products.add(currentProduct);
      continue;
    }

    // Data line — must have a reference number to be matchable to a transaction.
    if (!reference) {
      skippedRows.push({ rowNumber, reason: "No transaction number" });
      continue;
    }

    const amount = parseMoney(pickCell(row, columnMap.amount));
    const rate = columnMap.salesPrice != null ? parseMoney(pickCell(row, columnMap.salesPrice)) : amount;
    const quantity = parseQty(row[columnMap.quantity ?? -1]);

    parsedRows.push({
      rowNumber,
      referenceNumber: reference,
      transactionType: type,
      productService: currentProduct,
      description: pickCell(row, columnMap.description),
      quantity,
      rate,
      amount,
      sortOrder: sortOrder++,
    });
    invoices.add(reference);
  }

  if (parsedRows.length === 0) {
    throw new Error("No line items were found. Make sure this is the Sales by Product/Service Detail export.");
  }

  return {
    rows: parsedRows,
    skippedRows,
    sheetName,
    headerRowNumber: headerRowIndex + 1,
    invoiceCount: invoices.size,
    productCount: products.size,
  };
}
