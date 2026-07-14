import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  listChartAccountsFromDb,
  updateChartAccountInDb,
} from "@/lib/chart-of-accounts/repository";
import { listSalesTransactionLocationsFromDb } from "@/lib/sales-transactions/locations-repository";
import type { ImportedGeneralLedgerRow } from "@/lib/general-ledger-import";
import { buildGeneralLedgerAccountMatcher } from "./account-matching";

const TABLE = "general_ledger_rows";
const INSERT_BATCH_SIZE = 500;
const PAGE_SIZE = 1000;

export type GeneralLedgerRow = {
  id: string;
  account_id: string | null;
  account_label: string;
  account_name: string;
  account_number: string;
  txn_date: string | null;
  raw_date: string | null;
  transaction_type: string;
  ref_number: string;
  payee_name: string;
  description: string;
  class_location?: string | null;
  foreign_currency_exchange_rate?: string | null;
  tax?: string | null;
  split_account: string;
  amount: number | string;
  balance: number | string;
  sort_order: number;
  period_label: string | null;
};

export type GeneralLedgerAccountRow = {
  id: string;
  accountId: string | null;
  accountLabel: string;
  rawDate: string;
  isoDate: string | null;
  transactionType: string;
  refNumber: string;
  payeeName: string;
  description: string;
  classLocation: string;
  foreignCurrencyExchangeRate: string;
  tax: string;
  splitAccount: string;
  amount: number;
  balance: number;
  sortOrder: number;
};

function rowToAccountRow(row: GeneralLedgerRow): GeneralLedgerAccountRow {
  return {
    id: row.id,
    accountId: row.account_id,
    accountLabel: row.account_label,
    rawDate: row.raw_date ?? "",
    isoDate: row.txn_date,
    transactionType: row.transaction_type,
    refNumber: row.ref_number,
    payeeName: row.payee_name,
    description: row.description,
    classLocation: row.class_location ?? "",
    foreignCurrencyExchangeRate: row.foreign_currency_exchange_rate ?? "",
    tax: row.tax ?? "",
    splitAccount: row.split_account,
    amount: Number(row.amount) || 0,
    balance: Number(row.balance) || 0,
    sortOrder: row.sort_order,
  };
}

export async function generalLedgerTableExists(): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).select("id").limit(1);
  if (!error) return true;
  if (error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) {
    return false;
  }
  throw new Error(error.message);
}

export type GeneralLedgerSummary = {
  imported: boolean;
  periodLabel: string;
  totalRows: number;
  accountsWithHistory: number;
};

export async function getGeneralLedgerSummary(): Promise<GeneralLedgerSummary> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true });

  if (error) {
    if (error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) {
      return { imported: false, periodLabel: "", totalRows: 0, accountsWithHistory: 0 };
    }
    throw new Error(error.message);
  }

  const totalRows = count ?? 0;
  if (totalRows === 0) {
    return { imported: false, periodLabel: "", totalRows: 0, accountsWithHistory: 0 };
  }

  const { data: sampleRow } = await supabase
    .from(TABLE)
    .select("period_label")
    .limit(1)
    .maybeSingle();

  return {
    imported: true,
    periodLabel: (sampleRow?.period_label as string | undefined) ?? "All Dates",
    totalRows,
    accountsWithHistory: 0,
  };
}

export async function listGeneralLedgerRowsForAccount(
  accountId: string,
): Promise<{ importExists: boolean; periodLabel: string; rows: GeneralLedgerAccountRow[] }> {
  const supabase = createSupabaseAdminClient();
  const rows: GeneralLedgerAccountRow[] = [];
  let offset = 0;
  let periodLabel = "All Dates";

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("account_id", accountId)
      .order("sort_order", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      if (error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) {
        return { importExists: false, periodLabel, rows: [] };
      }
      throw new Error(error.message);
    }

    const batch = (data ?? []) as GeneralLedgerRow[];
    for (const row of batch) {
      if (row.period_label) periodLabel = row.period_label;
      rows.push(rowToAccountRow(row));
    }
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // The General Ledger export omits the Class/Location column, but A/R Aging
  // Detail provides it keyed by reference number. Backfill it when missing.
  const needsLocation = rows.some((row) => !row.classLocation && row.refNumber);
  if (needsLocation) {
    const locationByRef = await listSalesTransactionLocationsFromDb();
    if (locationByRef.size > 0) {
      for (const row of rows) {
        if (!row.classLocation && row.refNumber) {
          const location = locationByRef.get(row.refNumber.trim());
          if (location) row.classLocation = location;
        }
      }
    }
  }

  const summary = await getGeneralLedgerSummary();
  return { importExists: summary.imported, periodLabel, rows };
}

export type BankAccountActivityRow = {
  id: string;
  rawDate: string;
  isoDate: string | null;
  transactionType: string;
  refNumber: string;
  payeeName: string;
  description: string;
  amount: number;
  balance: number;
};

export type BankAccountActivity = {
  accountId: string;
  transactionCount: number;
  latest: BankAccountActivityRow[];
};

/**
 * For each given account, return how many General Ledger rows it has and the most
 * recent few (by register order). Used by the dashboard to show only bank accounts
 * that actually have transactions, with a preview of their latest activity.
 */
export async function listBankAccountActivity(
  accountIds: string[],
  latestLimit = 3,
): Promise<Record<string, BankAccountActivity>> {
  const result: Record<string, BankAccountActivity> = {};
  if (accountIds.length === 0) return result;

  const exists = await generalLedgerTableExists();
  if (!exists) {
    for (const id of accountIds) {
      result[id] = { accountId: id, transactionCount: 0, latest: [] };
    }
    return result;
  }

  const supabase = createSupabaseAdminClient();

  await Promise.all(
    accountIds.map(async (accountId) => {
      const [{ count, error: countError }, { data, error: rowsError }] = await Promise.all([
        supabase
          .from(TABLE)
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId),
        supabase
          .from(TABLE)
          .select("*")
          .eq("account_id", accountId)
          .order("sort_order", { ascending: false })
          .limit(latestLimit),
      ]);

      if (countError) throw new Error(countError.message);
      if (rowsError) throw new Error(rowsError.message);

      const latest = ((data ?? []) as GeneralLedgerRow[]).map((row) => {
        const accountRow = rowToAccountRow(row);
        return {
          id: accountRow.id,
          rawDate: accountRow.rawDate,
          isoDate: accountRow.isoDate,
          transactionType: accountRow.transactionType,
          refNumber: accountRow.refNumber,
          payeeName: accountRow.payeeName,
          description: accountRow.description,
          amount: accountRow.amount,
          balance: accountRow.balance,
        } satisfies BankAccountActivityRow;
      });

      result[accountId] = {
        accountId,
        transactionCount: count ?? 0,
        latest,
      };
    }),
  );

  return result;
}

export type ImportGeneralLedgerResult = {
  inserted: number;
  matchedAccounts: number;
  unmatchedLabels: string[];
};

export type CreateManualBankTransactionInput = {
  accountId: string;
  txnDate: string;
  transactionType: string;
  refNumber?: string;
  payeeName?: string;
  description?: string;
  splitAccount?: string;
  direction: "payment" | "deposit";
  amount: number;
};

function formatRawDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${Number(month)}/${Number(day)}/${year}`;
}

function accountLabelFor(account: { number: string; name: string }): string {
  return account.number ? `${account.number} ${account.name}` : account.name;
}

export async function createManualBankTransactionInDb(
  input: CreateManualBankTransactionInput,
): Promise<GeneralLedgerAccountRow> {
  if (!input.accountId.trim()) throw new Error("Account is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.txnDate)) {
    throw new Error("Transaction date must be a valid date.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const supabase = createSupabaseAdminClient();
  const chartAccounts = await listChartAccountsFromDb();
  const account = chartAccounts.find((row) => row.id === input.accountId);
  if (!account) throw new Error("Account not found.");

  const { data: lastRow, error: lastError } = await supabase
    .from(TABLE)
    .select("balance, sort_order")
    .eq("account_id", input.accountId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw new Error(lastError.message);

  const signedAmount = input.direction === "payment" ? -input.amount : input.amount;
  const beginningBalance =
    lastRow && lastRow.balance !== null && lastRow.balance !== undefined
      ? Number(lastRow.balance) || 0
      : account.ledgerBalance;
  const balance = beginningBalance + signedAmount;
  const sortOrder =
    lastRow && lastRow.sort_order !== null && lastRow.sort_order !== undefined
      ? Number(lastRow.sort_order) + 1
      : 1;

  const insert = {
    account_id: account.id,
    account_label: accountLabelFor(account),
    account_name: account.name,
    account_number: account.number,
    txn_date: input.txnDate,
    raw_date: formatRawDate(input.txnDate),
    transaction_type: input.transactionType.trim() || "Manual Entry",
    ref_number: input.refNumber?.trim() ?? "",
    payee_name: input.payeeName?.trim() ?? "",
    description: input.description?.trim() ?? "",
    class_location: "",
    foreign_currency_exchange_rate: "",
    tax: "",
    split_account: input.splitAccount?.trim() || "Manual Entry",
    amount: signedAmount,
    balance,
    sort_order: sortOrder,
    period_label: "All Dates",
  };

  const { data, error } = await supabase.from(TABLE).insert(insert).select("*").single();
  if (error) throw new Error(error.message);

  await updateChartAccountInDb(account.id, { ledger_balance: balance });

  return rowToAccountRow(data as GeneralLedgerRow);
}

/**
 * Re-resolve every General Ledger row's `account_id` against the current chart of
 * accounts. Rows are linked at import time, but if the General Ledger was imported
 * before its accounts existed (or an account was later renamed/renumbered), those
 * rows keep a stale/NULL `account_id` and the account history falls back to the
 * computed ledger. Running this after any chart-of-accounts change keeps the link
 * correct. Safe to call repeatedly: it only writes rows whose link actually changes.
 */
export async function relinkGeneralLedgerAccountsInDb(): Promise<{ relinked: number }> {
  const supabase = createSupabaseAdminClient();

  const exists = await generalLedgerTableExists();
  if (!exists) return { relinked: 0 };

  const { count: rowCount, error: countError } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);
  if (!rowCount) return { relinked: 0 };

  const chartAccounts = await listChartAccountsFromDb();
  const matcher = buildGeneralLedgerAccountMatcher(chartAccounts);

  // Resolve a target account id for each distinct label, paging through all rows.
  const targetByLabel = new Map<string, string | null>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("account_label")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Array<{ account_label: string }>;
    for (const row of batch) {
      if (!targetByLabel.has(row.account_label)) {
        targetByLabel.set(row.account_label, matcher(row.account_label));
      }
    }
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  let relinked = 0;
  for (const [label, target] of targetByLabel) {
    if (!target) continue;
    // Only touch rows that are not already on the resolved account. NULL must be
    // matched explicitly because `account_id <> target` is never true for NULL.
    const { error, count } = await supabase
      .from(TABLE)
      .update({ account_id: target }, { count: "exact" })
      .eq("account_label", label)
      .or(`account_id.is.null,account_id.neq.${target}`);
    if (error) throw new Error(error.message);
    relinked += count ?? 0;
  }

  return { relinked };
}

/**
 * Copy the latest General Ledger running balance onto each linked chart account.
 * Use when the COA import had no balance column but GL was imported separately.
 */
export async function syncChartAccountBalancesFromGeneralLedgerInDb(): Promise<{
  updated: number;
}> {
  const exists = await generalLedgerTableExists();
  if (!exists) return { updated: 0 };

  const supabase = createSupabaseAdminClient();
  const accounts = await listChartAccountsFromDb();
  if (accounts.length === 0) return { updated: 0 };

  const latestByAccount = new Map<string, { balance: number; sortOrder: number }>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("account_id, balance, sort_order")
      .not("account_id", "is", null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Array<{
      account_id: string;
      balance: number | string;
      sort_order: number;
    }>;

    for (const row of batch) {
      const sortOrder = Number(row.sort_order) || 0;
      const existing = latestByAccount.get(row.account_id);
      if (!existing || sortOrder > existing.sortOrder) {
        latestByAccount.set(row.account_id, {
          balance: Number(row.balance) || 0,
          sortOrder,
        });
      }
    }

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (latestByAccount.size === 0) return { updated: 0 };

  let updated = 0;
  for (const account of accounts) {
    const latest = latestByAccount.get(account.id);
    if (!latest) continue;
    if (Math.abs(latest.balance - account.ledgerBalance) < 0.005) continue;
    await updateChartAccountInDb(account.id, { ledger_balance: latest.balance });
    updated += 1;
  }

  return { updated };
}

export async function clearGeneralLedgerInDb(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(error.message);
}

async function generalLedgerClassLocationColumnExists(): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).select("class_location").limit(1);
  if (!error) return true;
  if (/column .*class_location|does not exist|schema cache/i.test(error.message)) {
    return false;
  }
  throw new Error(error.message);
}

async function generalLedgerOptionalColumnExists(column: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).select(column).limit(1);
  if (!error) return true;
  if (/column .*does not exist|does not exist|schema cache/i.test(error.message)) {
    return false;
  }
  throw new Error(error.message);
}

/**
 * Insert a batch of General Ledger rows, resolving each account label to a chart
 * account id. The full file is uploaded in chunks, so this runs once per chunk.
 */
export async function insertGeneralLedgerBatchInDb(
  rows: ImportedGeneralLedgerRow[],
  periodLabel: string,
): Promise<ImportGeneralLedgerResult> {
  const supabase = createSupabaseAdminClient();
  const chartAccounts = await listChartAccountsFromDb();
  const matcher = buildGeneralLedgerAccountMatcher(chartAccounts);
  const hasClassLocation = await generalLedgerClassLocationColumnExists();
  const [hasForeignCurrencyExchangeRate, hasTax] = await Promise.all([
    generalLedgerOptionalColumnExists("foreign_currency_exchange_rate"),
    generalLedgerOptionalColumnExists("tax"),
  ]);

  const matchedAccountIds = new Set<string>();
  const unmatched = new Set<string>();

  const inserts = rows.map((row) => {
    const accountId = matcher(row.accountLabel);
    if (accountId) matchedAccountIds.add(accountId);
    else unmatched.add(row.accountLabel);

    return {
      account_id: accountId,
      account_label: row.accountLabel,
      account_name: row.accountName,
      account_number: row.accountNumber,
      txn_date: row.isoDate,
      raw_date: row.rawDate,
      transaction_type: row.transactionType,
      ref_number: row.refNumber,
      payee_name: row.payeeName,
      description: row.description,
      ...(hasClassLocation ? { class_location: row.classLocation } : {}),
      ...(hasForeignCurrencyExchangeRate
        ? { foreign_currency_exchange_rate: row.foreignCurrencyExchangeRate }
        : {}),
      ...(hasTax ? { tax: row.tax } : {}),
      split_account: row.splitAccount,
      amount: row.amount,
      balance: row.balance,
      sort_order: row.sortOrder,
      period_label: periodLabel || null,
    };
  });

  let inserted = 0;
  for (let i = 0; i < inserts.length; i += INSERT_BATCH_SIZE) {
    const batch = inserts.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from(TABLE).insert(batch);
    if (error) throw new Error(error.message);
    inserted += batch.length;
  }

  return {
    inserted,
    matchedAccounts: matchedAccountIds.size,
    unmatchedLabels: [...unmatched],
  };
}
