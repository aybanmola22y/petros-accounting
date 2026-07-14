import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import { LEDGER_BASE_ACCOUNT_IDS } from "./account-mapping";
import { buildBookkeepingEntries } from "./build-bookkeeping-entries";
import type { LedgerEntry } from "./types";

function netBalance(entries: LedgerEntry[], accountId: string): number {
  return entries
    .filter((entry) => entry.accountId === accountId)
    .reduce((sum, entry) => sum + entry.debit - entry.credit, 0);
}

/** Apply transaction-derived balances; accounts without activity keep seeded balances. */
export function applyComputedLedgerBalances(
  accounts: MockChartAccount[],
  salesTransactions: MockSalesTransaction[],
  expenses: MockExpenseTransaction[],
): MockChartAccount[] {
  const entries = buildBookkeepingEntries({
    salesTransactions,
    expenses,
    chartAccounts: accounts,
  });

  if (entries.length === 0) return accounts;

  const touched = new Set(entries.map((entry) => entry.accountId));
  return accounts.map((account) => {
    if (!touched.has(account.id)) return account;
    const activity = netBalance(entries, account.id);
    if (LEDGER_BASE_ACCOUNT_IDS.has(account.id)) {
      return { ...account, ledgerBalance: activity };
    }
    return { ...account, ledgerBalance: account.ledgerBalance + activity };
  });
}
