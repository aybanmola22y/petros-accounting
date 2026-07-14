import { isBankRegisterAccount } from "@/lib/ledger/is-bank-register-account";
import type { MockChartAccount } from "./chart-of-accounts";

const BALANCE_EPSILON = 0.01;

/** Known bank-feed sync ages when QuickBooks shows a stale connection. */
const BANK_FEED_SYNC_DAYS_BY_NAME: Record<string, number> = {
  "cash on bank (bpi)": 429,
};

/**
 * Bank accounts shown on the dashboard widget (QuickBooks-style: real bank
 * accounts only, not petty cash or "Cash on hand").
 *
 * NOTE: we intentionally do NOT trust the QuickBooks detail type here. The
 * chart-of-accounts import tagged many non-bank accounts (e.g. "Doubtful
 * Accounts", "Meal Allowance") with detail type "Bank", so detail type alone
 * would wrongly include them. A genuine bank account instead has a bank account
 * number or the word "bank" in its name.
 */
function isDashboardBankAccount(account: MockChartAccount): boolean {
  if (!account.isActive || !isBankRegisterAccount(account)) return false;

  const hasAccountNumber = Boolean(account.number?.trim());
  const nameLooksLikeBank = /\bbank\b/i.test(account.name);
  return hasAccountNumber || nameLooksLikeBank;
}

/** Bank-feed balances for cash accounts (matches Chart of Accounts connected accounts). */
export type MockBankAccount = {
  id: string;
  name: string;
  number: string;
  currency: string;
  bankBalance: number;
  bankConnected: boolean;
  isActive: boolean;
  /** Days since last successful bank sync (dashboard alert). */
  lastSyncedDays?: number;
  needsAttention?: boolean;
};

export type DashboardBankAccountRow = {
  id: string;
  label: string;
  currency: string;
  bankBalance?: number;
  bookBalance: number;
  showBankBalance: boolean;
  lastSyncedDays?: number;
  needsAttention?: boolean;
};

export const SEED_BANK_ACCOUNTS: MockBankAccount[] = [
  {
    id: "1",
    name: "BPI",
    number: "3481-0038-99",
    currency: "PHP",
    bankBalance: 326_700,
    bankConnected: true,
    isActive: true,
  },
  {
    id: "2",
    name: "Cash on Bank (BPI)",
    number: "1000-0010",
    currency: "PHP",
    bankBalance: 35_302.57,
    bankConnected: true,
    isActive: true,
    lastSyncedDays: 429,
    needsAttention: true,
  },
  {
    id: "3",
    name: "Cash on Bank (BDO)",
    number: "1000-0020",
    currency: "PHP",
    bankBalance: 890_120,
    bankConnected: true,
    isActive: true,
  },
  {
    id: "6",
    name: "Manila Branch — Operating",
    number: "1000-0050",
    currency: "PHP",
    bankBalance: 244_100,
    bankConnected: true,
    isActive: true,
    lastSyncedDays: 394,
    needsAttention: true,
  },
];

/** Active cash/bank accounts for the dashboard bank widget (QuickBooks-style). */
export function buildDashboardBankAccountRows(
  chartAccounts: MockChartAccount[],
): DashboardBankAccountRow[] {
  const rows = chartAccounts
    .filter((account) => isDashboardBankAccount(account))
    .map((account) => {
      const hasBankFeed =
        Boolean(account.bankConnected) && account.bankBalance !== undefined;
      const bookBalance = account.ledgerBalance;
      const bankBalance = account.bankBalance;
      const needsAttention =
        hasBankFeed &&
        bankBalance !== undefined &&
        Math.abs(bankBalance - bookBalance) > BALANCE_EPSILON;
      const syncDays =
        BANK_FEED_SYNC_DAYS_BY_NAME[account.name.trim().toLowerCase()] ??
        undefined;

      return {
        id: account.id,
        label: account.number ? `${account.number} ${account.name}` : account.name,
        currency: account.currency || "PHP",
        bankBalance,
        bookBalance,
        showBankBalance: hasBankFeed,
        lastSyncedDays: hasBankFeed ? syncDays : undefined,
        needsAttention,
        sortOrder: account.sortOrder ?? Number.MAX_SAFE_INTEGER,
      };
    });

  rows.sort((a, b) => {
    // QuickBooks puts connected accounts that need attention first.
    if (Boolean(a.needsAttention) !== Boolean(b.needsAttention)) {
      return a.needsAttention ? -1 : 1;
    }
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label);
  });

  return rows.map(({ sortOrder: _sortOrder, ...row }) => row);
}

export function computeTotalBankBalance(accounts: MockBankAccount[] = SEED_BANK_ACCOUNTS): number {
  return accounts
    .filter((a) => a.isActive && a.bankConnected)
    .reduce((sum, a) => sum + a.bankBalance, 0);
}

export function countConnectedBankAccounts(accounts: MockBankAccount[] = SEED_BANK_ACCOUNTS): number {
  return accounts.filter((a) => a.isActive && a.bankConnected).length;
}
