import seedRows from "./expense-category-seed.json";
import type { MockChartAccount } from "./chart-of-accounts";
import {
  isCogsAccount,
  isExpenseAccount,
  isOtherExpenseAccount,
} from "@/lib/ledger/account-mapping";

export type MockExpenseCategory = {
  id: string;
  /** Stored value on expense lines (no ↳ prefix). */
  name: string;
  /** Label shown in dropdowns. */
  displayName: string;
  accountType: string;
  isSubAccount: boolean;
  parentName?: string;
  isCustom: boolean;
};

export const CATEGORY_ACCOUNT_TYPES = [
  "PHPExpense",
  "PHPOther Income",
  "PHPOther Expense",
  "PHPOther Current Liability",
  "PHPOther Current Asset",
  "PHPOther Asset",
  "PHPLong Term Liability",
  "PHPIncome",
  "PHPFixed Asset",
  "PHPEquity",
  "PHPCredit Card",
  "PHPCost Of Goods Sold",
  "PHPBank",
  "PHPAccounts Receivable",
] as const;

type SeedRow = {
  name: string;
  accountType: string;
  isSubAccount: boolean;
  parentName?: string;
};

function seedId(name: string) {
  return `cat-seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 96)}`;
}

export function buildSeedExpenseCategories(): MockExpenseCategory[] {
  return (seedRows as SeedRow[]).map((row) => ({
    id: seedId(row.name),
    name: row.name,
    displayName: row.isSubAccount ? `↳ ${row.name}` : row.name,
    accountType: row.accountType,
    isSubAccount: row.isSubAccount,
    parentName: row.parentName,
    isCustom: false,
  }));
}

function isCategoryEligibleAccount(account: MockChartAccount): boolean {
  if (!account.isActive) return false;
  return (
    isExpenseAccount(account) ||
    isCogsAccount(account) ||
    isOtherExpenseAccount(account)
  );
}

/** Build expense category dropdown options from chart of accounts (QuickBooks-style). */
export function chartAccountsToExpenseCategories(
  accounts: readonly MockChartAccount[],
): MockExpenseCategory[] {
  return [...accounts]
    .filter(isCategoryEligibleAccount)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    .map((account) => ({
      id: `coa-cat-${account.id}`,
      name: account.name,
      displayName: account.name,
      accountType: account.accountType,
      isSubAccount: false,
      isCustom: false,
    }));
}

/** Merge chart-derived categories with custom entries and imported expense category names. */
export function mergeExpenseCategories(
  fromChart: readonly MockExpenseCategory[],
  custom: readonly MockExpenseCategory[],
  expenseCategoryNames: readonly string[] = [],
): MockExpenseCategory[] {
  const byName = new Map<string, MockExpenseCategory>();
  for (const category of fromChart) byName.set(category.name, category);
  for (const category of custom) byName.set(category.name, category);

  for (const rawName of expenseCategoryNames) {
    const name = rawName.trim();
    if (!name || name.toLowerCase() === "--split--") continue;
    if (byName.has(name)) continue;
    byName.set(name, {
      id: `cat-orphan-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 96)}`,
      name,
      displayName: name,
      accountType: "Expenses",
      isSubAccount: false,
      isCustom: true,
    });
  }

  return [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function findCategoryByName(
  categories: MockExpenseCategory[],
  name: string,
): MockExpenseCategory | undefined {
  return categories.find((c) => c.name === name);
}

export const DEFAULT_EXPENSE_CATEGORY = "Utilities";
