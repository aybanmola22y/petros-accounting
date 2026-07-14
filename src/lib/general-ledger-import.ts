import { cellText, parseMoney, readSpreadsheetRows } from "@/lib/import-spreadsheet-utils";

export type ImportedGeneralLedgerRow = {
  /** Raw account group header from QuickBooks, e.g. "3483 0576 19 Cash on Bank (BPI)". */
  accountLabel: string;
  /** Parsed account name (label with any leading account-number stripped). */
  accountName: string;
  /** Parsed leading account number, when present. */
  accountNumber: string;
  /** Original date text (mm/dd/yyyy) as exported. */
  rawDate: string;
  /** ISO date (yyyy-mm-dd) when parseable. */
  isoDate: string | null;
  transactionType: string;
  refNumber: string;
  payeeName: string;
  description: string;
  classLocation: string;
  foreignCurrencyExchangeRate: string;
  tax: string;
  /** Counter (split) account from QuickBooks. */
  splitAccount: string;
  amount: number;
  balance: number;
  sortOrder: number;
};

export type ImportedGeneralLedgerSnapshot = {
  periodLabel: string;
  rows: ImportedGeneralLedgerRow[];
};

const HEADER_KEYS = [
  "distribution account",
  "transaction date",
  "transaction type",
  "amount",
  "balance",
] as const;

function rowCells(row: unknown[]): string[] {
  return row.map((cell) => cellText(cell));
}

function isHeaderRow(cells: string[]): boolean {
  const normalized = cells.map((c) => c.toLowerCase());
  const hits = HEADER_KEYS.filter((key) => normalized.some((c) => c === key)).length;
  return hits >= 3;
}

/** Account group header: first column has text, date/type columns are empty. */
function isAccountGroupRow(cells: string[]): boolean {
  return Boolean(cells[0]?.trim()) && !cells[1]?.trim() && !cells[2]?.trim();
}

/** Total row: first column starts with "Total". */
function isTotalRow(cells: string[]): boolean {
  return /^total\b/i.test(cells[0]?.trim() ?? "");
}

function splitAccountLabel(label: string): { number: string; name: string } {
  const trimmed = label.trim();
  // Leading account-number token: digits possibly separated by spaces/dashes.
  const match = /^([\d][\d\s-]*\d|\d)\s+(.+)$/.exec(trimmed);
  if (match && /\d/.test(match[1])) {
    return { number: match[1].trim(), name: match[2].trim() };
  }
  return { number: "", name: trimmed };
}

function parseIsoDate(text: string): string | null {
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (mdy) {
    const month = mdy[1].padStart(2, "0");
    const day = mdy[2].padStart(2, "0");
    return `${mdy[3]}-${month}-${day}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text.trim());
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function formatDateCell(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = value.getMonth() + 1;
    const day = value.getDate();
    return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${value.getFullYear()}`;
  }
  return cellText(value).trim();
}

function parsePeriodLabel(rows: unknown[][], headerIndex: number): string {
  for (let i = 0; i < headerIndex; i += 1) {
    const text = rows[i]?.map(cellText).filter(Boolean).join(" ").trim() ?? "";
    if (/^all dates$/i.test(text)) return "All Dates";
    if (/as of/i.test(text) || /\b20\d{2}\b/.test(text)) {
      if (!/general ledger/i.test(text) && !/^petrosphere/i.test(text)) return text;
    }
  }
  return "All Dates";
}

/** Parse a QuickBooks General Ledger Excel/CSV export into per-account transaction rows. */
export async function parseGeneralLedgerSpreadsheet(
  file: File,
): Promise<ImportedGeneralLedgerSnapshot> {
  const { rows } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");

  let headerIndex = -1;
  let columnOffset = 0;
  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const cells = rowCells(rows[i] ?? []);
    if (isHeaderRow(cells)) {
      headerIndex = i;
      // QuickBooks puts a blank first column; date sits in column 2.
      const normalized = cells.map((c) => c.toLowerCase());
      const dateCol = normalized.findIndex((c) => c === "transaction date");
      columnOffset = dateCol >= 2 ? 1 : 0;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error(
      'Could not find the General Ledger header row. Export "General Ledger" (or "Transaction Detail by Account") from QuickBooks with columns.',
    );
  }

  const periodLabel = parsePeriodLabel(rows, headerIndex);

  // Resolve every column by its header text so that optional columns
  // (Class/Location, Foreign currency, Tax) inserted by QuickBooks don't shift
  // Split / Amount / Balance out of alignment. Falls back to the legacy fixed
  // layout (leading blank column, offset = 1) when a header isn't recognised.
  //  [0] blank · [1] Distribution account · [2] date · [3] type · [4] number
  //  [5] name · [6] description · [7] split · [8] amount · [9] balance
  const normalizedHeader = rowCells(rows[headerIndex] ?? []).map((cell) =>
    cell.toLowerCase().replace(/\s+/g, " ").trim(),
  );
  const findCol = (candidates: string[], fallback: number): number => {
    const idx = normalizedHeader.findIndex((cell) => candidates.includes(cell));
    return idx >= 0 ? idx : fallback;
  };

  const col = {
    distribution: findCol(["distribution account", "account"], columnOffset),
    date: findCol(["transaction date", "date"], columnOffset + 1),
    type: findCol(["transaction type", "type"], columnOffset + 2),
    number: findCol(
      ["number", "num", "no.", "ref no", "ref no.", "ref no. / type", "ref"],
      columnOffset + 3,
    ),
    name: findCol(["name", "payee", "payee / account", "payee/account"], columnOffset + 4),
    description: findCol(
      ["description", "memo", "memo/description", "memo / description"],
      columnOffset + 5,
    ),
    split: findCol(["split", "split account"], columnOffset + 6),
    amount: findCol(["amount"], columnOffset + 7),
    balance: findCol(["balance"], columnOffset + 8),
  };
  const classLocationCol = normalizedHeader.findIndex(
    (cell) =>
      cell === "class" ||
      cell === "location" ||
      cell === "class location" ||
      cell === "class/location" ||
      cell === "class / location",
  );
  const foreignCurrencyExchangeRateCol = normalizedHeader.findIndex(
    (cell) =>
      cell === "foreign currency" ||
      cell === "foreign currency exchange rate" ||
      cell === "exchange rate" ||
      cell === "foreign currency / exchange rate" ||
      cell === "foreign currency exchange rate",
  );
  const taxCol = normalizedHeader.findIndex((cell) => cell === "tax");

  const out: ImportedGeneralLedgerRow[] = [];
  let currentLabel = "";
  let currentName = "";
  let currentNumber = "";
  let sortOrder = 0;

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const cells = rowCells(rows[i] ?? []);
    if (!cells.some((c) => c)) continue;

    if (isTotalRow(cells)) continue;

    if (isAccountGroupRow(cells)) {
      currentLabel = cells[0]!.trim();
      const parsed = splitAccountLabel(currentLabel);
      currentNumber = parsed.number;
      currentName = parsed.name;
      continue;
    }

    if (!currentLabel) continue;

    const rawDate = formatDateCell(rows[i]?.[col.date]);
    const transactionType = cells[col.type]?.trim() ?? "";
    // Skip non-transaction lines (e.g. "Beginning Balance" without a date and type).
    if (!rawDate && !transactionType) continue;

    out.push({
      accountLabel: currentLabel,
      accountName: currentName,
      accountNumber: currentNumber,
      rawDate,
      isoDate: parseIsoDate(rawDate),
      transactionType,
      refNumber: cells[col.number]?.trim() ?? "",
      payeeName: cells[col.name]?.trim() ?? "",
      description: cells[col.description]?.trim() ?? "",
      classLocation: classLocationCol >= 0 ? cells[classLocationCol]?.trim() ?? "" : "",
      foreignCurrencyExchangeRate:
        foreignCurrencyExchangeRateCol >= 0
          ? cells[foreignCurrencyExchangeRateCol]?.trim() ?? ""
          : "",
      tax: taxCol >= 0 ? cells[taxCol]?.trim() ?? "" : "",
      splitAccount: cells[col.split]?.trim() ?? "",
      amount: parseMoney(rows[i]?.[col.amount]),
      balance: parseMoney(rows[i]?.[col.balance]),
      sortOrder: sortOrder++,
    });
  }

  if (out.length === 0) {
    throw new Error("No transaction rows were found in the General Ledger export.");
  }

  return { periodLabel, rows: out };
}
