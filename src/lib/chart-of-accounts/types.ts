import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";

/** Row shape in Supabase `chart_of_accounts` table. */
export type ChartAccountRow = {
  id: string;
  account_number: string | null;
  account_name: string;
  account_type: string;
  detail_type: string;
  currency: string;
  tax: string;
  ledger_balance: number | string;
  bank_balance: number | string | null;
  bank_connected: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ChartAccountInsert = {
  account_number?: string | null;
  account_name: string;
  account_type: string;
  detail_type: string;
  currency?: string;
  tax?: string;
  ledger_balance?: number;
  bank_balance?: number | null;
  bank_connected?: boolean;
  is_active?: boolean;
  sort_order?: number;
};

export function chartAccountRowToMock(row: ChartAccountRow): MockChartAccount {
  return {
    id: row.id,
    number: row.account_number?.trim() ?? "",
    name: row.account_name,
    accountType: row.account_type,
    detailType: row.detail_type,
    currency: row.currency || "PHP",
    tax: row.tax ?? "",
    ledgerBalance: Number(row.ledger_balance) || 0,
    bankBalance:
      row.bank_balance == null || row.bank_balance === ""
        ? undefined
        : Number(row.bank_balance),
    bankConnected: row.bank_connected,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export function mockChartAccountToInsert(account: {
  number?: string;
  name: string;
  accountType: string;
  detailType?: string;
  currency?: string;
  tax?: string;
  ledgerBalance?: number;
  bankBalance?: number;
  bankConnected?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}): ChartAccountInsert {
  return {
    account_number: account.number?.trim() || null,
    account_name: account.name.trim(),
    account_type: account.accountType.trim(),
    detail_type:
      account.detailType !== undefined
        ? account.detailType.trim()
        : account.accountType.trim(),
    currency: account.currency?.trim() || "PHP",
    tax: account.tax ?? "",
    ledger_balance: account.ledgerBalance ?? 0,
    bank_balance: account.bankBalance ?? null,
    bank_connected: account.bankConnected ?? false,
    is_active: account.isActive ?? true,
    sort_order: account.sortOrder ?? 0,
  };
}
