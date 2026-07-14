import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ImportedBalanceSheetAccountRow,
  ImportedBalanceSheetSnapshot,
  BalanceSheetSection,
} from "@/lib/balance-sheet-summary-import";

const IMPORT_TABLE = "balance_sheet_summary_rows";
const BASELINE_TABLE = "balance_sheet_ledger_baseline_rows";
const INSERT_BATCH_SIZE = 500;

type SummaryRow = {
  account_name: string;
  section: string;
  group_path: string | null;
  amount: number | string;
  period_label: string | null;
  sort_order: number;
};

export type BalanceSheetImportPackage = {
  imported: ImportedBalanceSheetSnapshot;
  baseline: ImportedBalanceSheetSnapshot;
};

async function readRowsFromTable(table: string): Promise<ImportedBalanceSheetSnapshot | null> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const rows: ImportedBalanceSheetAccountRow[] = [];
  let periodLabel = "";

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("sort_order", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (
        error.code === "PGRST205" ||
        /does not exist|schema cache/i.test(error.message)
      ) {
        return null;
      }
      throw new Error(error.message);
    }

    const batch = (data ?? []) as SummaryRow[];
    for (const row of batch) {
      if (!periodLabel && row.period_label) periodLabel = row.period_label;
      rows.push({
        accountName: row.account_name.trim(),
        section: row.section as BalanceSheetSection,
        groupPath: row.group_path?.trim() ?? "",
        amount: Number(row.amount) || 0,
        sortOrder: row.sort_order,
      });
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  if (rows.length === 0) return null;
  return { periodLabel, rows };
}

async function replaceRowsInTable(
  table: string,
  snapshot: ImportedBalanceSheetSnapshot,
): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { error: deleteError } = await supabase.from(table).delete().neq("account_name", "");
  if (deleteError) {
    if (
      deleteError.code === "PGRST205" ||
      /does not exist|schema cache/i.test(deleteError.message)
    ) {
      return 0;
    }
    throw new Error(deleteError.message);
  }

  if (snapshot.rows.length === 0) return 0;

  const rows = snapshot.rows.map((row, index) => ({
    account_name: row.accountName.trim(),
    section: row.section,
    group_path: row.groupPath || "",
    amount: row.amount,
    period_label: snapshot.periodLabel || null,
    sort_order: row.sortOrder || index + 1,
  }));

  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(error.message);
    inserted += batch.length;
  }

  return inserted;
}

export async function listBalanceSheetImportPackageFromDb(): Promise<BalanceSheetImportPackage | null> {
  const [imported, baseline] = await Promise.all([
    readRowsFromTable(IMPORT_TABLE),
    readRowsFromTable(BASELINE_TABLE),
  ]);
  if (!imported) return null;
  return {
    imported,
    baseline: baseline ?? { periodLabel: imported.periodLabel, rows: [] },
  };
}

export async function replaceBalanceSheetImportPackageInDb(
  imported: ImportedBalanceSheetSnapshot,
  baseline: ImportedBalanceSheetSnapshot,
): Promise<{ imported: number; baseline: number }> {
  const [importedCount, baselineCount] = await Promise.all([
    replaceRowsInTable(IMPORT_TABLE, imported),
    replaceRowsInTable(BASELINE_TABLE, baseline),
  ]);
  return { imported: importedCount, baseline: baselineCount };
}

export async function backfillBalanceSheetLedgerBaselineIfMissing(
  imported: ImportedBalanceSheetSnapshot,
  baseline: ImportedBalanceSheetSnapshot,
): Promise<ImportedBalanceSheetSnapshot> {
  if (baseline.rows.length > 0) return baseline;
  const saved = await replaceRowsInTable(BASELINE_TABLE, baseline);
  if (saved === 0) return baseline;
  return baseline;
}
