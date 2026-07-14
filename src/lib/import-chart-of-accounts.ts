import {
  cellText,
  findHeaderRowIndex,
  mapHeadersWithFuzzyBalance,
  parseMoney,
  pickCell,
  readSpreadsheetRows,
} from "@/lib/import-spreadsheet-utils";
import {
  isQuickBooksRunReportHeaders,
  resolveAccountTypeFromDetailType,
} from "@/lib/chart-of-accounts/qbo-detail-type-map";

export type ParsedChartAccountRow = {
  rowNumber: number;
  number: string;
  name: string;
  accountType: string;
  detailType: string;
  currency: string;
  ledgerBalance: number;
  bankBalance?: number;
};

export type ParseChartOfAccountsResult = {
  rows: ParsedChartAccountRow[];
  skippedRows: Array<{ rowNumber: number; reason: string }>;
  sheetName: string;
  headerRowNumber: number;
  /** True when the file includes a balance column (QuickBooks Run Report export). */
  hasBalanceColumn: boolean;
  /** True when the file includes a Bank Balance column from the COA list export. */
  hasBankBalanceColumn: boolean;
  /** Count of rows with a non-zero balance (only meaningful when hasBalanceColumn). */
  rowsWithBalance: number;
  /** Count of rows with a bank balance value. */
  rowsWithBankBalance: number;
};

const COLUMN_ALIASES = {
  number: ["account number", "account no", "account #", "number", "acct number"],
  name: [
    "account",
    "account name",
    "name",
    "full name",
    "account full name",
    "distribution account",
  ],
  accountType: ["account type", "type"],
  detailType: ["detail type", "detail account type"],
  currency: ["currency"],
  balance: [
    "balance",
    "quickbooks balance",
    "qb balance",
    "total balance",
    "amount",
    "current balance",
    "balance total",
    "ending balance",
    "net balance",
  ],
  bankBalance: [
    "bank balance",
    "bank bal",
    "bank balance total",
    "online banking balance",
    "online bank balance",
    "banking balance",
    "connected balance",
  ],
} as const;

function rowToAccount(
  row: unknown[],
  rowNumber: number,
  columnMap: Partial<Record<keyof typeof COLUMN_ALIASES, number>>,
  options?: { runReportExport?: boolean },
): ParsedChartAccountRow | { error: string } {
  const name = pickCell(row, columnMap.name);
  if (!name) return { error: "Missing account name" };

  const typeColumnValue = pickCell(row, columnMap.accountType);
  const reportDetailColumnValue =
    columnMap.detailType != null ? pickCell(row, columnMap.detailType) : "";

  let accountType = typeColumnValue;
  let detailType =
    columnMap.detailType != null ? reportDetailColumnValue : typeColumnValue;

  if (options?.runReportExport) {
    // Account List / Run report: Detail type column has QBO detail (Cash on hand, Bank, …).
    // The Type column is often a broader category (e.g. Bank).
    detailType = reportDetailColumnValue || typeColumnValue;
    accountType =
      resolveAccountTypeFromDetailType(detailType) ??
      resolveAccountTypeFromDetailType(typeColumnValue) ??
      (typeColumnValue.toLowerCase() === "bank"
        ? "Cash and cash equivalents"
        : typeColumnValue);
  } else if (columnMap.detailType == null) {
    detailType = accountType;
  }

  const number = pickCell(row, columnMap.number);
  const currency = pickCell(row, columnMap.currency) || "PHP";
  const ledgerBalance = parseMoney(pickCell(row, columnMap.balance));

  // Bank balance only exists for bank-connected accounts; leave it undefined
  // (not 0) when the cell is blank so non-bank accounts stay empty.
  const bankBalanceCell =
    columnMap.bankBalance != null ? pickCell(row, columnMap.bankBalance) : "";
  const bankBalance = bankBalanceCell.trim() ? parseMoney(bankBalanceCell) : undefined;

  if (!accountType) return { error: "Missing account type" };
  if (!detailType) return { error: "Missing detail type" };

  return {
    rowNumber,
    number,
    name,
    accountType,
    detailType,
    currency,
    ledgerBalance,
    bankBalance,
  };
}

/**
 * QuickBooks auto-creates these system accounts (e.g. multicurrency revaluation) and
 * shows them on the Chart of Accounts page, but excludes them from the "Account List"
 * export. Backfill them when absent so totals match QuickBooks exactly.
 */
const QBO_SYSTEM_ACCOUNTS: ReadonlyArray<{
  name: string;
  accountType: string;
  detailType: string;
}> = [
  {
    name: "Unrealized Gain or Loss",
    accountType: "Other expense",
    detailType: "Unrealised gain or loss on securities, net of tax",
  },
];

function appendMissingSystemAccounts(rows: ParsedChartAccountRow[]): void {
  const existing = new Set(rows.map((row) => row.name.trim().toLowerCase()));
  let nextRowNumber = rows.reduce((max, row) => Math.max(max, row.rowNumber), 0);

  for (const account of QBO_SYSTEM_ACCOUNTS) {
    if (existing.has(account.name.toLowerCase())) continue;
    nextRowNumber += 1;
    rows.push({
      rowNumber: nextRowNumber,
      number: "",
      name: account.name,
      accountType: account.accountType,
      detailType: account.detailType,
      currency: "PHP",
      ledgerBalance: 0,
    });
    existing.add(account.name.toLowerCase());
  }
}

export async function parseChartOfAccountsSpreadsheet(
  file: File,
): Promise<ParseChartOfAccountsResult> {
  const { rows, sheetName } = await readSpreadsheetRows(file);
  if (rows.length === 0) throw new Error("The file is empty.");

  const aliasGroups = Object.values(COLUMN_ALIASES);
  const headerRowIndex = findHeaderRowIndex(rows, aliasGroups);
  const headerRow = rows[headerRowIndex] ?? [];
  const columnMap = mapHeadersWithFuzzyBalance(headerRow, COLUMN_ALIASES);
  const runReportExport = isQuickBooksRunReportHeaders(headerRow);

  if (columnMap.name == null) {
    throw new Error('Could not find an "Account name" column.');
  }
  if (columnMap.accountType == null) {
    throw new Error('Could not find an "Account type" column.');
  }

  const parsedRows: ParsedChartAccountRow[] = [];
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (!row.some((cell) => cellText(cell))) continue;

    const rowNumber = i + 1;
    const parsed = rowToAccount(row, rowNumber, columnMap, { runReportExport });
    if ("error" in parsed) {
      skippedRows.push({ rowNumber, reason: parsed.error });
      continue;
    }

    if (/^total\b/i.test(parsed.name)) {
      skippedRows.push({ rowNumber, reason: "Skipped summary row" });
      continue;
    }

    parsedRows.push(parsed);
  }

  if (parsedRows.length === 0) {
    throw new Error("No account rows were found below the header row.");
  }

  appendMissingSystemAccounts(parsedRows);

  const hasBalanceColumn = columnMap.balance != null;
  const hasBankBalanceColumn = columnMap.bankBalance != null;
  const rowsWithBalance = parsedRows.filter((row) => row.ledgerBalance !== 0).length;
  const rowsWithBankBalance = parsedRows.filter((row) => row.bankBalance !== undefined).length;

  return {
    rows: parsedRows,
    skippedRows,
    sheetName,
    headerRowNumber: headerRowIndex + 1,
    hasBalanceColumn,
    hasBankBalanceColumn,
    rowsWithBalance,
    rowsWithBankBalance,
  };
}

/** Parse QuickBooks chart-of-accounts CSV export from disk path (server/scripts). */
export async function parseChartOfAccountsCsvText(text: string): Promise<ParseChartOfAccountsResult> {
  const blob = new Blob([text], { type: "text/csv" });
  const file = new File([blob], "chartofaccounts.csv", { type: "text/csv" });
  return parseChartOfAccountsSpreadsheet(file);
}
