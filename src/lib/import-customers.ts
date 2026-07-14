import {
  cellText,
  findHeaderRowIndex,
  mapHeaders,
  parseMoney,
  pickCell,
  readSpreadsheetRows,
  SPREADSHEET_IMPORT_ACCEPT,
} from "@/lib/import-spreadsheet-utils";

export type ParsedCustomerImportRow = {
  rowNumber: number;
  name: string;
  companyName: string;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  phone: string;
  email: string;
  attachmentCount: number;
  openBalance: number;
};

export type ParseCustomersSpreadsheetResult = {
  rows: ParsedCustomerImportRow[];
  skippedRows: Array<{ rowNumber: number; reason: string }>;
  sheetName: string;
  headerRowNumber: number;
};

const COLUMN_ALIASES = {
  name: [
    "customer",
    "customer name",
    "display name",
    "name",
    "full name",
    "contact",
  ],
  companyName: ["company", "company name"],
  phone: ["phone", "phone number", "primary phone", "telephone", "mobile"],
  email: ["email", "email address", "e mail"],
  attachments: ["attachments", "attachment"],
  openBalance: [
    "open balance",
    "balance",
    "opening balance",
    "amount",
    "balance total",
    "ar balance",
  ],
  street1: [
    "billing address",
    "address",
    "street",
    "street address",
    "street address 1",
    "address line 1",
    "billing street",
  ],
  city: ["city", "billing city"],
  province: ["province", "state", "billing state", "billing province"],
  zip: ["zip", "zip code", "postal code", "billing zip", "billing zip code"],
  country: ["country", "billing country"],
} as const;

export const CUSTOMERS_IMPORT_ACCEPT = SPREADSHEET_IMPORT_ACCEPT;

function parseAttachmentCount(value: string): number {
  const parsed = parseMoney(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function rowToCustomer(
  row: unknown[],
  rowNumber: number,
  columnMap: Partial<Record<keyof typeof COLUMN_ALIASES, number>>,
): ParsedCustomerImportRow | { error: string } {
  const name = pickCell(row, columnMap.name);
  if (!name) return { error: "Missing customer name" };

  return {
    rowNumber,
    name,
    companyName: pickCell(row, columnMap.companyName) || name,
    streetAddress: pickCell(row, columnMap.street1),
    city: pickCell(row, columnMap.city),
    state: pickCell(row, columnMap.province),
    country: pickCell(row, columnMap.country),
    zip: pickCell(row, columnMap.zip),
    phone: pickCell(row, columnMap.phone),
    email: pickCell(row, columnMap.email),
    attachmentCount: parseAttachmentCount(pickCell(row, columnMap.attachments)),
    openBalance: parseMoney(pickCell(row, columnMap.openBalance)),
  };
}

export async function parseCustomersSpreadsheet(
  file: File,
): Promise<ParseCustomersSpreadsheetResult> {
  const { rows, sheetName } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");

  const aliasGroups = Object.values(COLUMN_ALIASES);
  const headerRowIndex = findHeaderRowIndex(rows, aliasGroups);
  const columnMap = mapHeaders(rows[headerRowIndex] ?? [], COLUMN_ALIASES);

  if (columnMap.name == null) {
    throw new Error('Could not find a "Name" column in the spreadsheet.');
  }

  const parsedRows: ParsedCustomerImportRow[] = [];
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (!row.some((cell) => cellText(cell))) continue;

    const rowNumber = i + 1;
    const parsed = rowToCustomer(row, rowNumber, columnMap);
    if ("error" in parsed) {
      skippedRows.push({ rowNumber, reason: parsed.error });
      continue;
    }

    parsedRows.push(parsed);
  }

  if (parsedRows.length === 0) {
    throw new Error("No customer rows were found below the header row.");
  }

  return {
    rows: parsedRows,
    skippedRows,
    sheetName,
    headerRowNumber: headerRowIndex + 1,
  };
}

/** Leads export parser — ready when you export the Leads tab from QuickBooks. */
export type ParsedLeadImportRow = {
  rowNumber: number;
  name: string;
  companyName: string;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  phone: string;
  email: string;
  leadSource: string;
  attachmentCount: number;
};

const LEAD_COLUMN_ALIASES = {
  ...COLUMN_ALIASES,
  leadSource: ["lead source", "source", "lead status"],
} as const;

export async function parseLeadsSpreadsheet(
  file: File,
): Promise<Omit<ParseCustomersSpreadsheetResult, "rows"> & { rows: ParsedLeadImportRow[] }> {
  const { rows, sheetName } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");

  const aliasGroups = Object.values(LEAD_COLUMN_ALIASES);
  const headerRowIndex = findHeaderRowIndex(rows, aliasGroups);
  const columnMap = mapHeaders(rows[headerRowIndex] ?? [], LEAD_COLUMN_ALIASES);

  if (columnMap.name == null) {
    throw new Error('Could not find a "Name" column in the spreadsheet.');
  }

  const parsedRows: ParsedLeadImportRow[] = [];
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (!row.some((cell) => cellText(cell))) continue;

    const rowNumber = i + 1;
    const name = pickCell(row, columnMap.name);
    if (!name) {
      skippedRows.push({ rowNumber, reason: "Missing lead name" });
      continue;
    }

    parsedRows.push({
      rowNumber,
      name,
      companyName: pickCell(row, columnMap.companyName) || name,
      streetAddress: pickCell(row, columnMap.street1),
      city: pickCell(row, columnMap.city),
      state: pickCell(row, columnMap.province),
      country: pickCell(row, columnMap.country),
      zip: pickCell(row, columnMap.zip),
      phone: pickCell(row, columnMap.phone),
      email: pickCell(row, columnMap.email),
      leadSource: pickCell(row, columnMap.leadSource),
      attachmentCount: parseAttachmentCount(pickCell(row, columnMap.attachments)),
    });
  }

  if (parsedRows.length === 0) {
    throw new Error("No lead rows were found below the header row.");
  }

  return {
    rows: parsedRows,
    skippedRows,
    sheetName,
    headerRowNumber: headerRowIndex + 1,
  };
}
