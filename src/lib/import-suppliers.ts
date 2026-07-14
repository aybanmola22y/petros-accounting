import { loadXlsx } from "@/lib/load-xlsx";

export type ParsedSupplierImportRow = {
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
  currency: string;
  attachmentCount: number;
  openingBalance: number;
};

export type ParseSuppliersSpreadsheetResult = {
  rows: ParsedSupplierImportRow[];
  skippedRows: Array<{ rowNumber: number; reason: string }>;
  sheetName: string;
  headerRowNumber: number;
};

const COLUMN_ALIASES = {
  name: [
    "vendor",
    "supplier",
    "vendor name",
    "supplier name",
    "display name",
    "supplier display name",
    "name",
    "payee",
  ],
  companyName: ["company", "company name"],
  phone: ["phone", "phone number", "primary phone", "phone numbers", "telephone"],
  mobile: ["mobile", "mobile phone", "mobile number", "cell", "cell phone"],
  email: ["email", "email address", "e mail"],
  currency: ["currency"],
  attachments: ["attachments", "attachment"],
  openBalance: [
    "open balance",
    "balance",
    "opening balance",
    "amount",
    "balance total",
    "unpaid balance",
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
  street2: ["street address 2", "address line 2", "billing street 2"],
  city: ["city", "billing city"],
  province: ["province", "state", "billing state", "billing province"],
  zip: ["zip", "zip code", "postal code", "billing zip", "billing zip code"],
  country: ["country", "billing country"],
  notes: ["notes", "note"],
  businessId: [
    "tax id",
    "business id",
    "business id no social insurance no",
    "ein",
    "business number",
  ],
  paymentTerms: ["terms", "payment terms"],
  accountNo: ["account no", "account number", "account #"],
  website: ["website", "web site"],
  fax: ["fax", "fax number"],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\ufeff/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function parseMoney(value: unknown): number {
  const raw = cellText(value).replace(/[₱$,\s]/g, "");
  if (!raw || raw === "-") return 0;
  const n = Number.parseFloat(raw.replace(/[()]/g, ""));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function scoreHeaderRow(cells: unknown[]): number {
  const normalized = cells.map(normalizeHeader);
  let score = 0;
  for (const aliases of Object.values(COLUMN_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias))) score += 1;
  }
  return score;
}

function mapHeaders(cells: unknown[]): Partial<Record<ColumnKey, number>> {
  const normalized = cells.map(normalizeHeader);
  const map: Partial<Record<ColumnKey, number>> = {};

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as [ColumnKey, readonly string[]][]) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) map[key] = index;
  }

  return map;
}

function pickCell(row: unknown[], index: number | undefined): string {
  if (index == null || index < 0) return "";
  return cellText(row[index]);
}

function parseCsv(text: string): unknown[][] {
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

async function readSpreadsheetRows(file: File): Promise<{ rows: unknown[][]; sheetName: string }> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv") || lowerName.endsWith(".txt")) {
    const text = await file.text();
    return { rows: parseCsv(text), sheetName: file.name };
  }

  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const preferredSheet =
    workbook.SheetNames.find((name) => /vendor|supplier|payee/i.test(name)) ??
    workbook.SheetNames[0];
  if (!preferredSheet) {
    throw new Error("The spreadsheet does not contain any worksheets.");
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[preferredSheet], {
    header: 1,
    defval: "",
    blankrows: false,
  });

  return { rows, sheetName: preferredSheet };
}

function findHeaderRow(rows: unknown[][]): { headerRowIndex: number; columnMap: Partial<Record<ColumnKey, number>> } {
  let bestIndex = 0;
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const score = scoreHeaderRow(rows[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestScore < 1) {
    throw new Error(
      "Could not find a header row. Export a Vendor Contact List or supplier list from QuickBooks with columns like Vendor, Email, and Phone.",
    );
  }

  return {
    headerRowIndex: bestIndex,
    columnMap: mapHeaders(rows[bestIndex] ?? []),
  };
}

function parseAttachmentCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  const n = Number.parseInt(cellText(value), 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function rowToSupplier(
  row: unknown[],
  rowNumber: number,
  columnMap: Partial<Record<ColumnKey, number>>,
): ParsedSupplierImportRow | { error: string } {
  const name =
    pickCell(row, columnMap.name) ||
    pickCell(row, columnMap.companyName);

  if (!name) {
    return { error: "Missing supplier name" };
  }

  const companyName = pickCell(row, columnMap.companyName);
  const phone = pickCell(row, columnMap.phone) || pickCell(row, columnMap.mobile);
  const email = pickCell(row, columnMap.email);
  const currency = pickCell(row, columnMap.currency) || "Philippine Peso";
  const openingBalance = parseMoney(pickCell(row, columnMap.openBalance));
  const attachmentCount = parseAttachmentCount(row[columnMap.attachments ?? -1]);

  return {
    rowNumber,
    name,
    companyName,
    streetAddress: pickCell(row, columnMap.street1),
    city: pickCell(row, columnMap.city),
    state: pickCell(row, columnMap.province),
    country: pickCell(row, columnMap.country),
    zip: pickCell(row, columnMap.zip),
    phone,
    email,
    currency,
    attachmentCount,
    openingBalance,
  };
}

export async function parseSuppliersSpreadsheet(file: File): Promise<ParseSuppliersSpreadsheetResult> {
  const { rows, sheetName } = await readSpreadsheetRows(file);
  if (rows.length === 0) {
    throw new Error("The file is empty.");
  }

  const { headerRowIndex, columnMap } = findHeaderRow(rows);
  if (!columnMap.name && !columnMap.companyName) {
    throw new Error(
      "No supplier name column found. Expected a column like Vendor, Supplier, or Display Name.",
    );
  }

  const parsedRows: ParsedSupplierImportRow[] = [];
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (!row.some((cell) => cellText(cell))) continue;

    const rowNumber = i + 1;
    const parsed = rowToSupplier(row, rowNumber, columnMap);
    if ("error" in parsed) {
      skippedRows.push({ rowNumber, reason: parsed.error });
      continue;
    }

    parsedRows.push(parsed);
  }

  if (parsedRows.length === 0) {
    throw new Error("No supplier rows were found below the header row.");
  }

  return {
    rows: parsedRows,
    skippedRows,
    sheetName,
    headerRowNumber: headerRowIndex + 1,
  };
}

export const SUPPLIER_IMPORT_ACCEPT = ".xls,.xlsx,.csv,.tsv";
