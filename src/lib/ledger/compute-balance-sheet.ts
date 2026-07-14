import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import type { ImportedBalanceSheetAccountRow } from "@/lib/balance-sheet-summary-import";
import { buildBalanceSheetLinesFromImport } from "@/lib/balance-sheet-summary/build-report-lines";
import {
  balanceSheetAsOfRange,
  balanceSheetPeriodLabelToAsOf,
  mergeBalanceSheetWithLedgerDelta,
} from "@/lib/balance-sheet-summary/merge-snapshots";
import type { BalanceSheetImportPackage } from "@/lib/balance-sheet-summary/repository";
import type { ReportLine } from "@/views/financial-report-shared";
import { startOfDay } from "@/lib/report-date-utils";
import { applyComputedLedgerBalances } from "./compute-account-balances";
import {
  isCogsAccount,
  isExpenseAccount,
  isIncomeAccount,
  isOtherExpenseAccount,
} from "./account-mapping";
import { computeProfitLossSummary } from "./compute-profit-loss";
import { isDateInRange, parseTransactionDate } from "./date-utils";
import type { ProfitLossInput } from "./types";

export type BalanceSheetInput = ProfitLossInput;

const ASSET_TYPE_ORDER = [
  "Cash and cash equivalents",
  "Accounts receivable",
  "Accounts receivable (A/R)",
  "Other current assets",
  "Current assets",
  "Fixed assets",
  "Non-current assets",
] as const;

const LIABILITY_TYPE_ORDER = [
  "Accounts payable",
  "Accounts payable (A/P)",
  "Credit card",
  "Other current liabilities",
  "Current liabilities",
  "Non-current liabilities",
] as const;

const EQUITY_TYPE_ORDER = ["Equity", "Owner's equity"] as const;

function normalizeType(value: string): string {
  return value.trim().toLowerCase();
}

function isProfitAndLossAccount(account: MockChartAccount): boolean {
  return (
    isIncomeAccount(account) ||
    isExpenseAccount(account) ||
    isCogsAccount(account) ||
    isOtherExpenseAccount(account) ||
    /other income/i.test(account.accountType)
  );
}

function isAssetAccount(account: MockChartAccount): boolean {
  if (isProfitAndLossAccount(account)) return false;
  const type = normalizeType(account.accountType);
  const detail = normalizeType(account.detailType ?? "");
  return (
    type.includes("cash") ||
    type.includes("receivable") ||
    type.includes("asset") ||
    type.includes("inventory") ||
    detail.includes("bank") ||
    detail.includes("inventory")
  );
}

function isLiabilityAccount(account: MockChartAccount): boolean {
  if (isProfitAndLossAccount(account)) return false;
  const type = normalizeType(account.accountType);
  return (
    type.includes("payable") ||
    type.includes("credit card") ||
    type.includes("liabilit") ||
    type.includes("loan payable")
  );
}

function isEquityAccount(account: MockChartAccount): boolean {
  if (isProfitAndLossAccount(account)) return false;
  const type = normalizeType(account.accountType);
  return type.includes("equity") || type.includes("retained");
}

function presentationAmount(
  account: MockChartAccount,
  section: "asset" | "liability" | "equity",
): number {
  const raw = account.ledgerBalance;
  if (section === "asset") return raw;
  return -raw;
}

function sortAccounts(accounts: MockChartAccount[]): MockChartAccount[] {
  return [...accounts].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });
}

function typeOrderIndex(type: string, order: readonly string[]): number {
  const normalized = normalizeType(type);
  const index = order.findIndex((entry) => normalizeType(entry) === normalized);
  return index === -1 ? order.length + normalized.charCodeAt(0) : index;
}

function accountLine(
  account: MockChartAccount,
  section: "asset" | "liability" | "equity",
): ReportLine {
  return {
    id: `acct-${account.id}`,
    label: account.name,
    amount: presentationAmount(account, section),
  };
}

function buildGroupedSection(
  accounts: MockChartAccount[],
  section: "asset" | "liability" | "equity",
  typeOrder: readonly string[],
  idPrefix: string,
): ReportLine[] {
  const byType = new Map<string, MockChartAccount[]>();
  for (const account of accounts) {
    if (!account.isActive) continue;
    const amount = presentationAmount(account, section);
    if (amount === 0) continue;
    const group = byType.get(account.accountType) ?? [];
    group.push(account);
    byType.set(account.accountType, group);
  }

  const types = [...byType.keys()].sort(
    (a, b) => typeOrderIndex(a, typeOrder) - typeOrderIndex(b, typeOrder),
  );

  return types.map((type) => {
    const groupAccounts = sortAccounts(byType.get(type) ?? []);
    const children = groupAccounts.map((account) => accountLine(account, section));
    const total = children.reduce((sum, line) => sum + (line.amount ?? 0), 0);
    return {
      id: `${idPrefix}-${type}`,
      label: type,
      amount: total,
      defaultOpen: children.length > 0,
      children:
        children.length > 0
          ? [
              ...children,
              {
                id: `${idPrefix}-total-${type}`,
                label: `Total for ${type}`,
                amount: total,
                isSectionTotal: true,
              },
            ]
          : [],
    };
  });
}

function fiscalYearToDateRange(asOf: Date) {
  const end = startOfDay(asOf);
  return { from: new Date(end.getFullYear(), 0, 1), to: end };
}

function filterTransactionsAsOf(input: BalanceSheetInput): BalanceSheetInput {
  const range = input.range;
  return {
    ...input,
    salesTransactions: input.salesTransactions.filter((transaction) => {
      const date = parseTransactionDate(transaction.date);
      return date !== null && isDateInRange(date, range);
    }),
    expenses: input.expenses.filter((expense) => {
      const date = parseTransactionDate(expense.date);
      return date !== null && isDateInRange(date, range);
    }),
  };
}

function accountsAsOf(input: BalanceSheetInput): MockChartAccount[] {
  const filtered = filterTransactionsAsOf(input);
  return applyComputedLedgerBalances(
    filtered.chartAccounts,
    filtered.salesTransactions,
    filtered.expenses,
  );
}

/** Per-account ledger balances for Balance Sheet merge (import baseline + live deltas). */
export function computeBalanceSheetAccountRows(input: BalanceSheetInput): ImportedBalanceSheetAccountRow[] {
  const accounts = accountsAsOf(input);
  const rows: ImportedBalanceSheetAccountRow[] = [];
  let sortOrder = 1;

  for (const account of accounts) {
    if (!account.isActive) continue;
    let section: ImportedBalanceSheetAccountRow["section"] | null = null;
    let presentation: "asset" | "liability" | "equity" | null = null;

    if (isAssetAccount(account)) {
      section = "assets";
      presentation = "asset";
    } else if (isLiabilityAccount(account)) {
      section = "liabilities";
      presentation = "liability";
    } else if (isEquityAccount(account)) {
      section = "equity";
      presentation = "equity";
    }

    if (!section || !presentation) continue;
    const amount = presentationAmount(account, presentation);
    if (amount === 0) continue;

    rows.push({
      accountName: account.name,
      section,
      groupPath: account.accountType,
      amount,
      sortOrder: sortOrder++,
    });
  }

  const netIncome = computeProfitLossSummary({
    ...filterTransactionsAsOf(input),
    range: fiscalYearToDateRange(input.range.to),
  }).netEarnings;

  if (netIncome !== 0) {
    rows.push({
      accountName: "Net Income",
      section: "net_income",
      groupPath: "Shareholders' equity",
      amount: netIncome,
      sortOrder: sortOrder++,
    });
  }

  return rows;
}

export function computeBalanceSheetLinesFromLedger(input: BalanceSheetInput): ReportLine[] {
  const accounts = accountsAsOf(input);
  const assetAccounts = accounts.filter(isAssetAccount);
  const liabilityAccounts = accounts.filter(isLiabilityAccount);
  const equityAccounts = accounts.filter(isEquityAccount);

  const assetGroups = buildGroupedSection(assetAccounts, "asset", ASSET_TYPE_ORDER, "asset");
  const totalAssets = assetGroups.reduce((sum, group) => sum + (group.amount ?? 0), 0);

  const liabilityGroups = buildGroupedSection(
    liabilityAccounts,
    "liability",
    LIABILITY_TYPE_ORDER,
    "liability",
  );
  const totalLiabilities = liabilityGroups.reduce((sum, group) => sum + (group.amount ?? 0), 0);

  const equityGroups = buildGroupedSection(equityAccounts, "equity", EQUITY_TYPE_ORDER, "equity");
  const netIncome = computeProfitLossSummary({
    ...filterTransactionsAsOf(input),
    range: fiscalYearToDateRange(input.range.to),
  }).netEarnings;

  const equityChildren: ReportLine[] = [...equityGroups];
  if (netIncome !== 0) {
    equityChildren.push({
      id: "net-income",
      label: "Net Income",
      amount: netIncome,
    });
  }

  const equityAccountTotal = equityGroups.reduce((sum, group) => sum + (group.amount ?? 0), 0);
  const totalEquity = equityAccountTotal + netIncome;

  if (equityChildren.length > 0) {
    equityChildren.push({
      id: "total-equity",
      label: "Total for Shareholders' equity",
      amount: totalEquity,
      isSectionTotal: true,
    });
  }

  const liabilitiesAndEquityChildren: ReportLine[] = [
    ...liabilityGroups,
    ...(equityChildren.length > 0
      ? [
          {
            id: "shareholders-equity",
            label: "Shareholders' equity",
            amount: totalEquity,
            defaultOpen: true,
            children: equityChildren,
          },
        ]
      : []),
    {
      id: "total-liabilities-equity",
      label: "Total for Liabilities and Shareholder's Equity",
      amount: totalLiabilities + totalEquity,
      isGrandTotal: true,
    },
  ];

  return [
    {
      id: "assets",
      label: "Assets",
      amount: totalAssets,
      defaultOpen: true,
      children: [
        ...assetGroups,
        {
          id: "total-assets",
          label: "Total for Assets",
          amount: totalAssets,
          isSectionTotal: true,
        },
      ],
    },
    {
      id: "liabilities-equity",
      label: "Liabilities and Shareholder's Equity",
      amount: totalLiabilities + totalEquity,
      defaultOpen: true,
      children: liabilitiesAndEquityChildren,
    },
  ];
}

export function computeBalanceSheetLines(
  input: BalanceSheetInput,
  importPackage?: BalanceSheetImportPackage | null,
): ReportLine[] {
  if (importPackage?.imported.rows.length) {
    const liveAsOf = startOfDay(input.range?.to ?? new Date());
    const importAsOf = balanceSheetPeriodLabelToAsOf(importPackage.imported.periodLabel);

    // Same as-of day as the QuickBooks export → show the import unchanged.
    // (Stored ledger baselines are incomplete and used to wipe A/P, distort loans, etc.)
    if (startOfDay(importAsOf).getTime() === liveAsOf.getTime()) {
      return buildBalanceSheetLinesFromImport(importPackage.imported);
    }

    // Later days: only apply local activity after the import as-of date.
    // Using ledger(today) − ledger(importAsOf) cancels historical gaps in the app ledger.
    const currentRows = computeBalanceSheetAccountRows({
      ...input,
      range: balanceSheetAsOfRange(liveAsOf),
      basis: "Accrual",
    });
    const ledgerAtImportAsOf = computeBalanceSheetAccountRows({
      ...input,
      range: balanceSheetAsOfRange(importAsOf),
      basis: "Accrual",
    });
    const merged = mergeBalanceSheetWithLedgerDelta(
      importPackage.imported,
      { periodLabel: importPackage.imported.periodLabel, rows: ledgerAtImportAsOf },
      currentRows,
    );
    return buildBalanceSheetLinesFromImport(merged);
  }
  return computeBalanceSheetLinesFromLedger(input);
}
