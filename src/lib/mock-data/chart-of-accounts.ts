import type { MockBankAccount } from "./bank-accounts";

export type MockChartAccount = {
  id: string;
  number: string;
  name: string;
  accountType: string;
  /** QuickBooks detail type (e.g. Bank, Advertising/Promotional). */
  detailType?: string;
  currency: string;
  tax: string;
  ledgerBalance: number;
  bankBalance?: number;
  bankConnected?: boolean;
  isActive: boolean;
  /** Row order from QuickBooks import (lower = earlier in export). */
  sortOrder?: number;
};

/** Account types eligible as expense payment sources (bank/cash/credit). */
export const PAYMENT_ACCOUNT_TYPES = [
  "Cash and cash equivalents",
  "Credit card",
] as const;

export const SEED_CHART_ACCOUNTS: MockChartAccount[] = [
  {
    id: "1",
    number: "3481-0038-99",
    name: "BPI",
    accountType: "Cash and cash equivalents",
    currency: "PHP",
    tax: "",
    ledgerBalance: -326_700,
    bankBalance: 326_700,
    bankConnected: true,
    isActive: true,
  },
  {
    id: "2",
    number: "1000-0010",
    name: "Cash on Bank (BPI)",
    accountType: "Cash and cash equivalents",
    currency: "PHP",
    tax: "",
    ledgerBalance: 1_361_076.74,
    bankBalance: 35_302.57,
    bankConnected: true,
    isActive: true,
  },
  {
    id: "3",
    number: "1000-0020",
    name: "Cash on Bank (BDO)",
    accountType: "Cash and cash equivalents",
    currency: "PHP",
    tax: "",
    ledgerBalance: 892_450.2,
    bankBalance: 890_120,
    bankConnected: true,
    isActive: true,
  },
  {
    id: "4",
    number: "1000-0030",
    name: "Cash on hand",
    accountType: "Cash and cash equivalents",
    currency: "PHP",
    tax: "",
    ledgerBalance: -4_521_207.66,
    isActive: true,
  },
  {
    id: "5",
    number: "1000-0040",
    name: "Cebu Branch — Petty Cash",
    accountType: "Cash and cash equivalents",
    currency: "PHP",
    tax: "",
    ledgerBalance: 12_500,
    isActive: true,
  },
  {
    id: "6",
    number: "1000-0050",
    name: "Manila Branch — Operating",
    accountType: "Cash and cash equivalents",
    currency: "PHP",
    tax: "",
    ledgerBalance: 245_890,
    bankBalance: 244_100,
    bankConnected: true,
    isActive: true,
  },
  {
    id: "7",
    number: "1100-0010",
    name: "Accounts Receivable",
    accountType: "Accounts receivable",
    currency: "PHP",
    tax: "",
    ledgerBalance: 322_700,
    isActive: true,
  },
  {
    id: "8",
    number: "2000-0010",
    name: "Accounts Payable",
    accountType: "Accounts payable",
    currency: "PHP",
    tax: "",
    ledgerBalance: -185_430.5,
    isActive: true,
  },
  {
    id: "9",
    number: "3000-0010",
    name: "Share capital",
    accountType: "Equity",
    currency: "PHP",
    tax: "",
    ledgerBalance: 0,
    isActive: true,
  },
  {
    id: "10",
    number: "4000-0010",
    name: "Service Revenue",
    accountType: "Income",
    currency: "PHP",
    tax: "",
    ledgerBalance: -1_813_245,
    isActive: true,
  },
  {
    id: "11",
    number: "5000-0010",
    name: "Payroll Expense",
    accountType: "Expenses",
    currency: "PHP",
    tax: "",
    ledgerBalance: 1_240_000,
    isActive: true,
  },
  {
    id: "12",
    number: "5000-0020",
    name: "Rent Expense",
    accountType: "Expenses",
    currency: "PHP",
    tax: "",
    ledgerBalance: 360_000,
    isActive: false,
  },
];

export function mergeChartAccountsWithBankBalances(
  accounts: MockChartAccount[],
  bankAccounts: MockBankAccount[],
): MockChartAccount[] {
  const byId = Object.fromEntries(bankAccounts.map((b) => [b.id, b.bankBalance]));
  return accounts.map((a) =>
    a.bankConnected && byId[a.id] !== undefined ? { ...a, bankBalance: byId[a.id] } : a,
  );
}

/** Active accounts from chart of accounts, sorted by account number (matches COA page). */
export function getActiveChartAccountsSorted(accounts: MockChartAccount[]): MockChartAccount[] {
  return [...accounts]
    .filter((a) => a.isActive)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

/** @deprecated Use getActiveChartAccountsSorted for payment account dropdown. */
export function filterPaymentAccounts(accounts: MockChartAccount[]): MockChartAccount[] {
  return getActiveChartAccountsSorted(accounts).filter((a) =>
    (PAYMENT_ACCOUNT_TYPES as readonly string[]).includes(a.accountType),
  );
}

export function chartAccountDisplayBalance(account: MockChartAccount): number {
  if (account.bankConnected && account.bankBalance !== undefined) {
    return account.bankBalance;
  }
  return account.ledgerBalance;
}

/** QBO-style undeposited funds — payments here stay "Not deposited" until bank deposit. */
export function isUndepositedFundsAccount(account: MockChartAccount | undefined): boolean {
  if (!account) return true;
  return /undeposited\s+funds/i.test(account.name.trim());
}

/** Direct-to-bank deposit on receive payment marks the invoice deposited immediately. */
export function isDirectBankDepositAccount(account: MockChartAccount | undefined): boolean {
  if (!account || isUndepositedFundsAccount(account)) return false;
  return (PAYMENT_ACCOUNT_TYPES as readonly string[]).includes(account.accountType);
}
