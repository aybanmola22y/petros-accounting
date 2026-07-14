import { loadXlsx } from "@/lib/load-xlsx";
import type { ProductServiceItemType } from "@/lib/mock-data/products-services";

export type ParsedProductServiceImportRow = {
  rowNumber: number;
  name: string;
  itemType?: ProductServiceItemType;
  sku?: string;
  category?: string;
  className?: string;
  salesDescription?: string;
  salesPrice?: number;
  cost?: number;
  qtyOnHand?: number;
  reorderPoint?: number;
};

export type ParseProductServicesSpreadsheetResult = {
  rows: ParsedProductServiceImportRow[];
  skippedRows: Array<{ rowNumber: number; reason: string }>;
  sheetName: string;
  headerRowNumber: number;
};

export const PRODUCT_SERVICE_IMPORT_ACCEPT =
  ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

const COLUMN_ALIASES = {
  name: [
    "name",
    "product service name",
    "product service",
    "product/service",
    "product/service name",
    "product or service",
    "item",
    "item name",
    "product",
    "service",
  ],
  sku: ["sku", "item sku", "product sku"],
  itemType: ["type", "item type", "product type", "service type"],
  category: ["category", "product category", "item category"],
  className: ["class", "class name"],
  salesDescription: [
    "sales description",
    "description",
    "sales desc",
    "item description",
  ],
  salesPrice: [
    "sales price",
    "sales price rate",
    "price",
    "rate",
    "sales rate",
    "unit price",
  ],
  cost: ["cost", "purchase cost", "item cost"],
  qtyOnHand: ["qty on hand", "quantity on hand", "on hand", "qty", "quantity"],
  reorderPoint: ["reorder point", "reorder qty", "reorder quantity"],
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

function parseMoney(value: unknown): number | undefined {
  const raw = cellText(value).replace(/[₱$,\s]/g, "");
  if (!raw || raw === "-") return undefined;
  const n = Number.parseFloat(raw.replace(/[()]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function parseQty(value: unknown): number | undefined {
  const raw = cellText(value).replace(/,/g, "");
  if (!raw || raw === "-") return undefined;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseItemType(value: unknown): ProductServiceItemType | undefined {
  const raw = cellText(value).toLowerCase();
  if (!raw) return undefined;
  if (raw.includes("inventory") && !raw.includes("non")) return "inventory";
  if (raw.includes("non inventory") || raw.includes("non-inventory")) return "non-inventory";
  if (raw.includes("bundle")) return "bundle";
  if (raw.includes("service")) return "service";
  return undefined;
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

function readCell(row: unknown[], index: number | undefined): string {
  if (index === undefined || index < 0) return "";
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
    workbook.SheetNames.find((name) => /product|service|item/i.test(name)) ??
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

function isCategoryHeaderRow(
  row: unknown[],
  columnMap: Partial<Record<ColumnKey, number>>,
  name: string,
): boolean {
  if (!name) return false;
  const type = readCell(row, columnMap.itemType);
  const sku = readCell(row, columnMap.sku);
  const salesPrice = readCell(row, columnMap.salesPrice);
  const salesDescription = readCell(row, columnMap.salesDescription);
  const cost = readCell(row, columnMap.cost);
  const qty = readCell(row, columnMap.qtyOnHand);
  const reorder = readCell(row, columnMap.reorderPoint);
  const category = readCell(row, columnMap.category);

  if (category && category === name) return true;
  if (type || sku || salesPrice || salesDescription || cost || qty || reorder) return false;

  const nonEmptyCells = row.filter((cell) => cellText(cell) !== "").length;
  return nonEmptyCells <= 2;
}

function isLikelyTitleRow(cells: unknown[]): boolean {
  const joined = cells.map(cellText).join(" ").toLowerCase();
  return (
    joined.includes("product") &&
    joined.includes("service") &&
    cells.filter((cell) => cellText(cell) !== "").length <= 3
  );
}

function parseQuickBooksCategoryName(
  rawName: string,
  usedNames: Set<string>,
): { name: string; category?: string } {
  const normalizedRaw = rawName.trim().replace(/\s+/g, " ");
  const colonIndex = normalizedRaw.indexOf(":");
  let category: string | undefined;
  let preferredName: string;

  if (colonIndex > 0) {
    category = normalizedRaw.slice(0, colonIndex).trim() || undefined;
    preferredName = normalizedRaw.slice(colonIndex + 1).trim() || normalizedRaw;
  } else {
    preferredName = normalizedRaw;
  }

  const candidates =
    colonIndex > 0
      ? [preferredName, `${category}: ${preferredName}`, normalizedRaw.replace(":", ": ")]
      : [preferredName, `General: ${preferredName}`];

  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (!usedNames.has(key)) {
      usedNames.add(key);
      return { name: candidate, category };
    }
  }

  usedNames.add(normalizedRaw.toLowerCase());
  return { name: normalizedRaw.replace(":", ": "), category };
}

function isQuickBooksExportNoteRow(row: unknown[], nameIndex: number): boolean {
  const name = readCell(row, nameIndex);
  if (name) return false;
  const joined = row.map(cellText).join(" ").toLowerCase();
  return joined.includes("quantity on hand is calculated at the time you export");
}

export async function parseProductServicesSpreadsheet(
  file: File,
): Promise<ParseProductServicesSpreadsheetResult> {
  const { rows: matrix, sheetName } = await readSpreadsheetRows(file);

  if (matrix.length === 0) {
    throw new Error("The spreadsheet is empty.");
  }

  let headerRowNumber = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(matrix.length, 30); i += 1) {
    const row = matrix[i] ?? [];
    if (isLikelyTitleRow(row)) continue;
    const score = scoreHeaderRow(row);
    if (score > bestScore) {
      bestScore = score;
      headerRowNumber = i + 1;
    }
  }

  if (headerRowNumber < 1 || bestScore < 2) {
    throw new Error(
      "Could not find a header row. Expected columns like Name, SKU, Type, Sales Description, Sales Price, Cost, Qty on Hand, Reorder Point.",
    );
  }

  const headerCells = matrix[headerRowNumber - 1] ?? [];
  const columnMap = mapHeaders(headerCells);
  const nameIndex =
    columnMap.name ??
    headerCells.findIndex((cell) => cellText(cell) !== "");

  if (nameIndex < 0) {
    throw new Error("Could not find a Name / Product/Service column.");
  }

  const rows: ParsedProductServiceImportRow[] = [];
  const skippedRows: ParseProductServicesSpreadsheetResult["skippedRows"] = [];
  const usedNames = new Set<string>();
  let currentCategory: string | undefined;

  for (let i = headerRowNumber; i < matrix.length; i += 1) {
    const row = matrix[i] ?? [];
    const rowNumber = i + 1;
    if (isQuickBooksExportNoteRow(row, nameIndex)) continue;

    const rawName = readCell(row, nameIndex);
    if (!rawName) continue;

    const { name, category: nameCategory } = parseQuickBooksCategoryName(rawName, usedNames);

    const lowered = name.toLowerCase();
    if (
      lowered === "total" ||
      lowered.startsWith("grand total") ||
      lowered === "products and services" ||
      lowered === "product/service list"
    ) {
      continue;
    }

    if (isCategoryHeaderRow(row, columnMap, name)) {
      currentCategory = name;
      continue;
    }

    const explicitCategory = readCell(row, columnMap.category);
    const category = explicitCategory || nameCategory || currentCategory;

    const itemType = parseItemType(readCell(row, columnMap.itemType));
    const sku = readCell(row, columnMap.sku) || undefined;
    const className = readCell(row, columnMap.className) || undefined;
    const salesDescription = readCell(row, columnMap.salesDescription) || undefined;
    const salesPrice = parseMoney(row[columnMap.salesPrice ?? -1]);
    const cost = parseMoney(row[columnMap.cost ?? -1]);
    const qtyOnHand = parseQty(row[columnMap.qtyOnHand ?? -1]);
    const reorderPoint = parseQty(row[columnMap.reorderPoint ?? -1]);

    if (!itemType && salesPrice === undefined && !sku && !salesDescription) {
      skippedRows.push({
        rowNumber,
        reason: `Skipped "${name}" — not a product/service row`,
      });
      continue;
    }

    rows.push({
      rowNumber,
      name,
      itemType: itemType ?? "service",
      sku,
      category,
      className,
      salesDescription,
      salesPrice,
      cost,
      qtyOnHand,
      reorderPoint,
    });
  }

  if (rows.length === 0) {
    throw new Error("No product or service rows were found in the file.");
  }

  return {
    rows,
    skippedRows,
    sheetName,
    headerRowNumber,
  };
}
