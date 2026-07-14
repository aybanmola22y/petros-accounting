import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";

export const DEFAULT_INCOME_ACCOUNT_ID = "10";
export const DEFAULT_AR_ACCOUNT_ID = "7";
export const DEFAULT_AP_ACCOUNT_ID = "8";
export const DEFAULT_CASH_ACCOUNT_ID = "4";

function normalizeAccountLookupKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function findChartAccountByName(
  chartAccounts: MockChartAccount[],
  name: string | undefined,
  predicate?: (account: MockChartAccount) => boolean,
): MockChartAccount | undefined {
  const normalized = normalizeAccountLookupKey(name ?? "");
  if (!normalized) return undefined;

  const active = chartAccounts.filter(
    (account) => account.isActive && (!predicate || predicate(account)),
  );

  const exact = active.find(
    (account) => normalizeAccountLookupKey(account.name) === normalized,
  );
  if (exact) return exact;

  return active.find((account) => {
    const accountName = normalizeAccountLookupKey(account.name);
    return accountName.includes(normalized) || normalized.includes(accountName);
  });
}

function findChartAccountByPatterns(
  chartAccounts: MockChartAccount[],
  patterns: RegExp[],
  predicate?: (account: MockChartAccount) => boolean,
): MockChartAccount | undefined {
  return chartAccounts.find(
    (account) =>
      account.isActive &&
      (!predicate || predicate(account)) &&
      patterns.some((pattern) => pattern.test(account.name.trim())),
  );
}

/** Primary operating bank account used when no payment account is specified. */
export function defaultPaymentAccountId(chartAccounts: MockChartAccount[]): string {
  const bankCashAccounts = chartAccounts.filter(
    (account) =>
      account.accountType === "Cash and cash equivalents" &&
      account.isActive,
  );
  if (bankCashAccounts.length === 0) return DEFAULT_CASH_ACCOUNT_ID;
  const operating = bankCashAccounts.find((account) =>
    account.name.includes("Cash on Bank"),
  );
  return operating?.id ?? bankCashAccounts[0]!.id;
}

export function resolveAccountsReceivableAccountId(chartAccounts: MockChartAccount[]): string {
  const byName = findChartAccountByPatterns(chartAccounts, [
    /^accounts receivable\b/i,
    /\baccounts receivable \(a\/r\)/i,
    /\ba\/r\b/i,
  ]);
  if (byName) return byName.id;

  const byType = chartAccounts.find(
    (account) =>
      account.isActive && account.accountType.toLowerCase().includes("accounts receivable"),
  );
  if (byType) return byType.id;

  if (chartAccounts.some((account) => account.id === DEFAULT_AR_ACCOUNT_ID)) {
    return DEFAULT_AR_ACCOUNT_ID;
  }

  return defaultPaymentAccountId(chartAccounts);
}

export function resolveAccountsPayableAccountId(chartAccounts: MockChartAccount[]): string {
  const byName = findChartAccountByPatterns(chartAccounts, [
    /^accounts payable\b/i,
    /\baccounts payable \(a\/p\)/i,
    /\ba\/p\b/i,
  ]);
  if (byName) return byName.id;

  const byType = chartAccounts.find(
    (account) =>
      account.isActive && account.accountType.toLowerCase().includes("accounts payable"),
  );
  if (byType) return byType.id;

  if (chartAccounts.some((account) => account.id === DEFAULT_AP_ACCOUNT_ID)) {
    return DEFAULT_AP_ACCOUNT_ID;
  }

  const liability = chartAccounts.find(
    (account) =>
      account.isActive && account.accountType.toLowerCase().includes("accounts payable"),
  );
  return liability?.id ?? DEFAULT_AP_ACCOUNT_ID;
}

/** Balances derived entirely from transactional ledger entries (not seed + activity). */
export const LEDGER_BASE_ACCOUNT_IDS = new Set([
  DEFAULT_AR_ACCOUNT_ID,
  DEFAULT_AP_ACCOUNT_ID,
  DEFAULT_INCOME_ACCOUNT_ID,
  DEFAULT_CASH_ACCOUNT_ID,
  "11",
  "12",
]);

const EXPENSE_CATEGORY_ACCOUNT: Record<string, string> = {
  "Employee Salary": "11",
  Rent: "12",
  Utilities: "11",
  "Professional Fees": "11",
  "Meals & Entertainment": "11",
  "Office Supplies": "11",
  "Transportation Expenses": "11",
  "--Split--": "11",
};

export function isIncomeAccount(account: MockChartAccount): boolean {
  return account.accountType.toLowerCase().includes("income");
}

export function isExpenseAccount(account: MockChartAccount): boolean {
  const type = account.accountType.toLowerCase();
  return type.includes("expense") && !type.includes("other");
}

export function isCogsAccount(account: MockChartAccount): boolean {
  const type = account.accountType.toLowerCase();
  return type.includes("cost of sales") || type.includes("cost of goods");
}

export function isOtherExpenseAccount(account: MockChartAccount): boolean {
  return account.accountType.toLowerCase().includes("other expense");
}

export function isOtherIncomeAccount(account: MockChartAccount): boolean {
  return account.accountType.toLowerCase().includes("other income");
}

export function isOperatingIncomeAccount(account: MockChartAccount): boolean {
  return isIncomeAccount(account) && !isOtherIncomeAccount(account);
}

export function expenseAccountIdForCategory(
  category: string,
  chartAccounts: MockChartAccount[],
): string {
  const normalized = normalizeAccountLookupKey(category);
  if (normalized && normalized !== "--split--") {
    const byName = findChartAccountByName(chartAccounts, category);
    if (byName) return byName.id;
  }

  const mapped = EXPENSE_CATEGORY_ACCOUNT[category];
  if (mapped && chartAccounts.some((a) => a.id === mapped)) return mapped;
  const fallback = chartAccounts.find(isExpenseAccount);
  return fallback?.id ?? DEFAULT_INCOME_ACCOUNT_ID;
}

export function expenseAccountIdForExpense(
  expense: MockExpenseTransaction,
  chartAccounts: MockChartAccount[],
): string {
  if (
    expense.categoryAccountId &&
    chartAccounts.some((account) => account.id === expense.categoryAccountId && account.isActive)
  ) {
    return expense.categoryAccountId;
  }
  return expenseAccountIdForCategory(expense.category, chartAccounts);
}

export function resolvePrimaryIncomeAccountId(chartAccounts: MockChartAccount[]): string {
  const incomeAccounts = chartAccounts.filter((account) => account.isActive && isIncomeAccount(account));
  const sales = incomeAccounts.find((account) => /^sales$/i.test(account.name.trim()));
  if (sales) return sales.id;
  const byId = incomeAccounts.find((account) => account.id === DEFAULT_INCOME_ACCOUNT_ID);
  if (byId) return byId.id;
  return incomeAccounts[0]?.id ?? DEFAULT_INCOME_ACCOUNT_ID;
}

export function incomeAccountIdForName(
  accountName: string | undefined,
  chartAccounts: MockChartAccount[],
): string {
  const normalized = accountName?.trim().toLowerCase();
  if (normalized) {
    const byName = findChartAccountByName(chartAccounts, accountName, isIncomeAccount);
    if (byName) return byName.id;
  }
  return resolvePrimaryIncomeAccountId(chartAccounts);
}

export function incomeAccount(chartAccounts: MockChartAccount[]): MockChartAccount | undefined {
  const id = resolvePrimaryIncomeAccountId(chartAccounts);
  return chartAccounts.find((account) => account.id === id && isIncomeAccount(account));
}

export function resolveSaleIncomeAccountId(
  sale: MockSalesTransaction,
  chartAccounts: MockChartAccount[],
): string {
  if (sale.incomeAccount?.trim()) {
    return incomeAccountIdForName(sale.incomeAccount, chartAccounts);
  }
  if (sale.type === "Sales receipt") {
    const productIncome = chartAccounts.find(
      (account) =>
        account.isActive &&
        isIncomeAccount(account) &&
        /sales of product income/i.test(account.name.trim()),
    );
    if (productIncome) return productIncome.id;
  }
  return resolvePrimaryIncomeAccountId(chartAccounts);
}

export function paymentDepositAccountId(
  depositToAccountId: string | undefined,
  chartAccounts: MockChartAccount[],
): string {
  if (
    depositToAccountId &&
    chartAccounts.some((a) => a.id === depositToAccountId && a.isActive)
  ) {
    return depositToAccountId;
  }
  return defaultPaymentAccountId(chartAccounts);
}
