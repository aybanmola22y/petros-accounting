import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  chartAccountRowToMock,
  mockChartAccountToInsert,
  type ChartAccountInsert,
  type ChartAccountRow,
} from "./types";
import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";

const TABLE = "chart_of_accounts";

export async function listChartAccountsFromDb(): Promise<MockChartAccount[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("account_name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as ChartAccountRow[]).map(chartAccountRowToMock);
}

export async function insertChartAccountInDb(
  input: ChartAccountInsert,
): Promise<MockChartAccount> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return chartAccountRowToMock(data as ChartAccountRow);
}

export async function updateChartAccountInDb(
  id: string,
  patch: Partial<ChartAccountInsert>,
): Promise<MockChartAccount> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return chartAccountRowToMock(data as ChartAccountRow);
}

export type ImportChartAccountsDbResult = {
  added: MockChartAccount[];
  updated: MockChartAccount[];
  skipped: Array<{ name: string; reason: string; rowNumber?: number }>;
  replaced: boolean;
};

export async function importChartAccountsInDb(
  rows: Array<{
    rowNumber?: number;
    number?: string;
    name: string;
    accountType: string;
    detailType?: string;
    currency?: string;
    ledgerBalance?: number;
    bankBalance?: number;
  }>,
  options?: { replace?: boolean; hasBalanceColumn?: boolean; hasBankBalanceColumn?: boolean },
): Promise<ImportChartAccountsDbResult> {
  const supabase = createSupabaseAdminClient();
  const replace = options?.replace ?? false;
  const hasBalanceColumn = options?.hasBalanceColumn ?? true;
  const hasBankBalanceColumn = options?.hasBankBalanceColumn ?? true;
  const added: MockChartAccount[] = [];
  const updated: MockChartAccount[] = [];
  const skipped: ImportChartAccountsDbResult["skipped"] = [];

  if (replace) {
    const { error } = await supabase.from(TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from(TABLE)
    .select("id, account_name, account_number");

  if (existingError) throw new Error(existingError.message);

  const existingByName = new Map(
    (existingRows ?? []).map((row) => [String(row.account_name).toLowerCase(), row]),
  );
  const existingByNumber = new Map(
    (existingRows ?? [])
      .filter((row) => row.account_number?.trim())
      .map((row) => [String(row.account_number).trim(), row]),
  );

  const toInsert: ChartAccountInsert[] = [];
  const toUpdate: Array<{ id: string; patch: Partial<ChartAccountInsert> }> = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const name = row.name.trim();
    if (!name) {
      skipped.push({
        name: "(blank row)",
        reason: "Missing account name",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const number = row.number?.trim() ?? "";
    const nameKey = name.toLowerCase();
    const existing =
      existingByName.get(nameKey) ??
      (number ? existingByNumber.get(number) : undefined);

    if (existing && !replace) {
      const patch: Partial<ChartAccountInsert> = {};
      if (row.accountType) patch.account_type = row.accountType.trim();
      if (row.detailType !== undefined) patch.detail_type = row.detailType.trim();
      if (row.currency) patch.currency = row.currency.trim();
      if (hasBalanceColumn && row.ledgerBalance !== undefined) {
        patch.ledger_balance = row.ledgerBalance;
      }
      if (hasBankBalanceColumn && row.bankBalance !== undefined) {
        patch.bank_balance = row.bankBalance;
        patch.bank_connected = true;
      }
      if (number) patch.account_number = number;

      if (Object.keys(patch).length > 0) {
        toUpdate.push({ id: existing.id, patch });
      } else {
        skipped.push({
          name,
          reason: "Already exists (no new balance data to update)",
          rowNumber: row.rowNumber,
        });
      }
      continue;
    }

    if (existingByName.has(nameKey)) {
      skipped.push({
        name,
        reason: "Already exists in chart of accounts",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    if (number && existingByNumber.has(number)) {
      skipped.push({
        name,
        reason: "Account number already exists",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    toInsert.push({
      ...mockChartAccountToInsert({
        number,
        name,
        accountType: row.accountType,
        detailType: row.detailType,
        currency: row.currency,
        ledgerBalance: hasBalanceColumn ? row.ledgerBalance : undefined,
        bankBalance: hasBankBalanceColumn ? row.bankBalance : undefined,
        bankConnected: hasBankBalanceColumn && row.bankBalance != null,
        sortOrder: row.rowNumber ?? i + 1,
      }),
    });
    existingByName.set(nameKey, { id: "pending", account_name: name, account_number: number });
    if (number) existingByNumber.set(number, { id: "pending", account_name: name, account_number: number });
  }

  const updatePromises: Array<Promise<void>> = [];
  for (const { id, patch } of toUpdate) {
    updatePromises.push(
      updateChartAccountInDb(id, patch).then((account) => {
        updated.push(account);
      }),
    );
  }

  const UPDATE_BATCH = 25;
  for (let i = 0; i < updatePromises.length; i += UPDATE_BATCH) {
    await Promise.all(updatePromises.slice(i, i + UPDATE_BATCH));
  }

  if (toInsert.length > 0) {
    const { data, error } = await supabase.from(TABLE).insert(toInsert).select("*");
    if (error) throw new Error(error.message);
    added.push(...((data ?? []) as ChartAccountRow[]).map(chartAccountRowToMock));
  }

  return { added, updated, skipped, replaced: replace };
}

export async function chartOfAccountsTableExists(): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).select("id").limit(1);
  if (!error) return true;
  if (
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message)
  ) {
    return false;
  }
  throw new Error(error.message);
}
