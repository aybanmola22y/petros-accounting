import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import {
  isCogsAccount,
  isExpenseAccount,
  isIncomeAccount,
  isOtherExpenseAccount,
  isOtherIncomeAccount,
} from "@/lib/ledger/account-mapping";

export const CHART_ACCOUNT_VIEW_FILTERS = [
  "All",
  "Created by you",
  "Balance sheet accounts",
  "Profit and loss accounts",
  "Locked accounts only",
  "Unlocked accounts only",
  "Parent accounts only",
  "Subaccounts only",
] as const;

export type ChartAccountViewFilter = (typeof CHART_ACCOUNT_VIEW_FILTERS)[number];

export function isProfitAndLossChartAccount(account: MockChartAccount): boolean {
  return (
    isIncomeAccount(account) ||
    isExpenseAccount(account) ||
    isCogsAccount(account) ||
    isOtherExpenseAccount(account) ||
    isOtherIncomeAccount(account)
  );
}

export function isBalanceSheetChartAccount(account: MockChartAccount): boolean {
  return !isProfitAndLossChartAccount(account);
}

/** Manually added in the app (not from QuickBooks COA import). */
export function isUserCreatedChartAccount(account: MockChartAccount): boolean {
  const number = account.number.trim();
  if (/^AUTO-/i.test(number)) return true;
  return (account.sortOrder ?? 0) === 0;
}

export function isLockedChartAccount(account: MockChartAccount): boolean {
  return !account.isActive;
}

export function isUnlockedChartAccount(account: MockChartAccount): boolean {
  return account.isActive;
}

function normalizedAccountName(name: string): string {
  return name.trim().replace(/^↳\s*/, "");
}

/** QuickBooks-style subaccount: app prefix or "Parent:Child" naming. */
export function isSubaccountChartAccount(account: MockChartAccount): boolean {
  const name = account.name.trim();
  if (name.startsWith("↳")) return true;
  return normalizedAccountName(name).includes(":");
}

export function parentNameForChartAccount(account: MockChartAccount): string | null {
  const name = normalizedAccountName(account.name);
  const colonIndex = name.indexOf(":");
  if (colonIndex <= 0) return null;
  return name.slice(0, colonIndex).trim();
}

export function isParentChartAccount(
  account: MockChartAccount,
  accounts: readonly MockChartAccount[],
): boolean {
  const parentName = normalizedAccountName(account.name).toLowerCase();
  return accounts.some((candidate) => {
    if (candidate.id === account.id) return false;
    const candidateParent = parentNameForChartAccount(candidate);
    return candidateParent?.toLowerCase() === parentName;
  });
}

export function matchesChartAccountViewFilter(
  account: MockChartAccount,
  filter: ChartAccountViewFilter,
  allAccounts: readonly MockChartAccount[],
): boolean {
  switch (filter) {
    case "All":
      return true;
    case "Created by you":
      return isUserCreatedChartAccount(account);
    case "Balance sheet accounts":
      return isBalanceSheetChartAccount(account);
    case "Profit and loss accounts":
      return isProfitAndLossChartAccount(account);
    case "Locked accounts only":
      return isLockedChartAccount(account);
    case "Unlocked accounts only":
      return isUnlockedChartAccount(account);
    case "Parent accounts only":
      return isParentChartAccount(account, allAccounts);
    case "Subaccounts only":
      return isSubaccountChartAccount(account);
    default:
      return true;
  }
}
