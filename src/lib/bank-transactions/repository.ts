import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listChartAccountsFromDb } from "@/lib/chart-of-accounts/repository";
import {
  createManualBankTransactionInDb,
  listGeneralLedgerRowsForAccount,
  type GeneralLedgerAccountRow,
} from "@/lib/general-ledger/repository";
import { buildDashboardBankAccountRows } from "@/lib/mock-data/bank-accounts";
import { inferDefaultBankStatus, formatGlDisplayDate } from "./classify";
import type {
  BankAccountSummary,
  BankTransactionRow,
  BankTransactionTab,
  BankTransactionsResponse,
} from "./types";

const META_TABLE = "bank_transaction_meta";

type BankTransactionMetaRow = {
  id: string;
  account_id: string;
  gl_row_id: string | null;
  txn_date: string | null;
  bank_description: string;
  payee_name: string;
  category_label: string;
  amount: number | string;
  direction: "deposit" | "payment";
  status: BankTransactionTab;
  notes: string;
};

async function metaTableExists(): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(META_TABLE).select("id").limit(1);
  if (!error) return true;
  if (error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) {
    return false;
  }
  throw new Error(error.message);
}

async function listMetaForAccount(accountId: string): Promise<BankTransactionMetaRow[]> {
  const exists = await metaTableExists();
  if (!exists) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(META_TABLE)
    .select("*")
    .eq("account_id", accountId);
  if (error) throw new Error(error.message);
  return (data ?? []) as BankTransactionMetaRow[];
}

function metaByGlId(meta: BankTransactionMetaRow[]): Map<string, BankTransactionMetaRow> {
  const map = new Map<string, BankTransactionMetaRow>();
  for (const row of meta) {
    if (row.gl_row_id) map.set(row.gl_row_id, row);
  }
  return map;
}

function glToBankRow(
  gl: GeneralLedgerAccountRow,
  accountId: string,
  meta?: BankTransactionMetaRow,
): BankTransactionRow {
  const amount = gl.amount;
  const status = meta?.status ?? inferDefaultBankStatus(gl);
  const categoryLabel = meta?.category_label?.trim() || gl.splitAccount.trim();
  const payeeName = meta?.payee_name?.trim() || gl.payeeName.trim();
  const bankDescription =
    meta?.bank_description?.trim() || gl.description.trim() || gl.transactionType;

  return {
    id: meta?.id ?? gl.id,
    glRowId: gl.id,
    metaId: meta?.id ?? null,
    accountId,
    date: formatGlDisplayDate(gl.rawDate, gl.isoDate),
    bankDescription,
    payeeName,
    categoryLabel,
    spent: amount < 0 ? Math.abs(amount) : 0,
    received: amount > 0 ? amount : 0,
    status,
    transactionType: gl.transactionType,
    refNumber: gl.refNumber,
    notes: meta?.notes ?? "",
    isFeedOnly: false,
  };
}

function feedMetaToBankRow(meta: BankTransactionMetaRow): BankTransactionRow {
  const amount = Number(meta.amount) || 0;
  const isPayment = meta.direction === "payment";
  return {
    id: meta.id,
    glRowId: null,
    metaId: meta.id,
    accountId: meta.account_id,
    date: meta.txn_date
      ? formatGlDisplayDate("", meta.txn_date)
      : "—",
    bankDescription: meta.bank_description,
    payeeName: meta.payee_name,
    categoryLabel: meta.category_label,
    spent: isPayment ? amount : 0,
    received: !isPayment ? amount : 0,
    status: meta.status,
    transactionType: "Bank feed",
    refNumber: "",
    notes: meta.notes,
    isFeedOnly: true,
  };
}

function filterTransactions(
  rows: BankTransactionRow[],
  options: {
    tab?: BankTransactionTab;
    search?: string;
    from?: string;
    to?: string;
  },
): BankTransactionRow[] {
  let filtered = rows;

  if (options.tab) {
    filtered = filtered.filter((row) => row.status === options.tab);
  }

  if (options.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    filtered = filtered.filter(
      (row) =>
        row.bankDescription.toLowerCase().includes(q) ||
        row.payeeName.toLowerCase().includes(q) ||
        row.categoryLabel.toLowerCase().includes(q) ||
        row.refNumber.toLowerCase().includes(q),
    );
  }

  if (options.from) {
    const fromTime = new Date(options.from).getTime();
    filtered = filtered.filter((row) => {
      const parsed = Date.parse(row.date);
      return Number.isNaN(parsed) || parsed >= fromTime;
    });
  }

  if (options.to) {
    const toTime = new Date(options.to).getTime();
    filtered = filtered.filter((row) => {
      const parsed = Date.parse(row.date);
      return Number.isNaN(parsed) || parsed <= toTime;
    });
  }

  return filtered.sort((a, b) => {
    const aTime = Date.parse(a.date);
    const bTime = Date.parse(b.date);
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }
    return b.bankDescription.localeCompare(a.bankDescription);
  });
}

function countByTab(rows: BankTransactionRow[]): Record<BankTransactionTab, number> {
  return {
    pending: rows.filter((r) => r.status === "pending").length,
    posted: rows.filter((r) => r.status === "posted").length,
    excluded: rows.filter((r) => r.status === "excluded").length,
  };
}

export async function listBankTransactionsFromDb(options: {
  accountId: string;
  tab?: BankTransactionTab;
  search?: string;
  from?: string;
  to?: string;
}): Promise<BankTransactionsResponse> {
  const chartAccounts = await listChartAccountsFromDb();
  const bankRows = buildDashboardBankAccountRows(chartAccounts);
  const metaList = await listMetaForAccount(options.accountId);
  const metaMap = metaByGlId(metaList);

  const { rows: glRows } = await listGeneralLedgerRowsForAccount(options.accountId);

  const merged: BankTransactionRow[] = glRows.map((gl) =>
    glToBankRow(gl, options.accountId, metaMap.get(gl.id)),
  );

  for (const meta of metaList) {
    if (!meta.gl_row_id && meta.status !== "posted") {
      merged.push(feedMetaToBankRow(meta));
    }
  }

  const counts = countByTab(merged);
  const accounts: BankAccountSummary[] = bankRows.map((row) => ({
    ...row,
    pendingCount: row.id === options.accountId ? counts.pending : 0,
  }));

  const selected = accounts.find((a) => a.id === options.accountId) ?? null;
  const transactions = filterTransactions(merged, options);

  return { account: selected, accounts, transactions, counts };
}

export async function upsertBankTransactionMetaInDb(input: {
  id?: string;
  accountId: string;
  glRowId?: string | null;
  txnDate?: string | null;
  bankDescription?: string;
  payeeName?: string;
  categoryLabel?: string;
  amount?: number;
  direction?: "deposit" | "payment";
  status?: BankTransactionTab;
  notes?: string;
}): Promise<BankTransactionMetaRow> {
  const exists = await metaTableExists();
  if (!exists) {
    throw new Error(
      "Bank transaction workflow is not set up yet. Run the latest Supabase migration (bank_transaction_meta).",
    );
  }

  const supabase = createSupabaseAdminClient();
  const patch = {
    account_id: input.accountId,
    gl_row_id: input.glRowId ?? null,
    txn_date: input.txnDate ?? null,
    bank_description: input.bankDescription ?? "",
    payee_name: input.payeeName ?? "",
    category_label: input.categoryLabel ?? "",
    amount: input.amount ?? 0,
    direction: input.direction ?? "deposit",
    status: input.status ?? "pending",
    notes: input.notes ?? "",
  };

  if (input.id) {
    const { data, error } = await supabase
      .from(META_TABLE)
      .update(patch)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as BankTransactionMetaRow;
  }

  if (input.glRowId) {
    const { data: existing } = await supabase
      .from(META_TABLE)
      .select("*")
      .eq("gl_row_id", input.glRowId)
      .maybeSingle();
    if (existing) {
      const { data, error } = await supabase
        .from(META_TABLE)
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as BankTransactionMetaRow;
    }
  }

  const { data, error } = await supabase.from(META_TABLE).insert(patch).select("*").single();
  if (error) throw new Error(error.message);
  return data as BankTransactionMetaRow;
}

export async function postBankTransactionInDb(input: {
  accountId: string;
  metaId?: string;
  glRowId?: string;
  categoryLabel?: string;
  payeeName?: string;
}): Promise<void> {
  const metaList = await listMetaForAccount(input.accountId);
  const meta =
    (input.metaId ? metaList.find((row) => row.id === input.metaId) : undefined) ??
    (input.glRowId ? metaList.find((row) => row.gl_row_id === input.glRowId) : undefined);

  if (meta?.gl_row_id) {
    await upsertBankTransactionMetaInDb({
      id: meta.id,
      accountId: input.accountId,
      glRowId: meta.gl_row_id,
      status: "posted",
      categoryLabel: input.categoryLabel ?? meta.category_label,
      payeeName: input.payeeName ?? meta.payee_name,
    });
    return;
  }

  if (meta && !meta.gl_row_id) {
    const amount = Number(meta.amount) || 0;
    if (amount <= 0) throw new Error("Amount must be greater than zero.");

    await createManualBankTransactionInDb({
      accountId: input.accountId,
      txnDate: meta.txn_date ?? new Date().toISOString().slice(0, 10),
      transactionType: "Bank feed",
      refNumber: "",
      payeeName: input.payeeName ?? meta.payee_name,
      description: meta.bank_description,
      splitAccount: input.categoryLabel ?? meta.category_label,
      direction: meta.direction,
      amount,
    });

    const supabase = createSupabaseAdminClient();
    await supabase.from(META_TABLE).update({ status: "posted" }).eq("id", meta.id);
    return;
  }

  if (input.glRowId) {
    await upsertBankTransactionMetaInDb({
      accountId: input.accountId,
      glRowId: input.glRowId,
      status: "posted",
      categoryLabel: input.categoryLabel,
      payeeName: input.payeeName,
    });
    return;
  }

  throw new Error("Transaction not found.");
}

export async function createBankFeedLineInDb(input: {
  accountId: string;
  txnDate: string;
  bankDescription: string;
  payeeName?: string;
  categoryLabel?: string;
  direction: "deposit" | "payment";
  amount: number;
  notes?: string;
}): Promise<BankTransactionMetaRow> {
  return upsertBankTransactionMetaInDb({
    accountId: input.accountId,
    txnDate: input.txnDate,
    bankDescription: input.bankDescription,
    payeeName: input.payeeName ?? "",
    categoryLabel: input.categoryLabel ?? "",
    direction: input.direction,
    amount: input.amount,
    status: "pending",
    notes: input.notes ?? "",
  });
}
