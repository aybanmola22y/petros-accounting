import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ImportedExpensesBySupplierRow,
  ImportedExpensesBySupplierSnapshot,
} from "@/lib/expenses-by-supplier-summary-import";

const TABLE = "expenses_by_supplier_summary_rows";
const INSERT_BATCH_SIZE = 500;

type ExpensesBySupplierRowDb = {
  supplier_name: string;
  amount: number | string;
  period_label?: string | null;
  total_amount?: number | string | null;
  sort_order: number;
};

export async function listExpensesBySupplierSummaryFromDb(): Promise<ImportedExpensesBySupplierSnapshot> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const rows: ImportedExpensesBySupplierRow[] = [];
  let periodLabel = "";
  let totalAmount: number | undefined;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (
        error.code === "PGRST205" ||
        /does not exist|schema cache/i.test(error.message)
      ) {
        return { periodLabel: "", rows: [] };
      }
      throw new Error(error.message);
    }

    const batch = (data ?? []) as ExpensesBySupplierRowDb[];
    for (const row of batch) {
      if (!periodLabel && row.period_label?.trim()) periodLabel = row.period_label.trim();
      if (totalAmount == null && row.total_amount != null) {
        totalAmount = Number(row.total_amount);
      }
      rows.push({
        supplier: row.supplier_name.trim(),
        amount: Number(row.amount) || 0,
      });
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return { periodLabel, rows, totalAmount };
}

export async function replaceExpensesBySupplierSummaryInDb(
  snapshot: ImportedExpensesBySupplierSnapshot,
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const rows = snapshot.rows;
  const periodLabel = snapshot.periodLabel?.trim() || null;
  const totalAmount = snapshot.totalAmount ?? null;

  const { error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    if (
      deleteError.code === "PGRST205" ||
      /does not exist|schema cache/i.test(deleteError.message)
    ) {
      return 0;
    }
    throw new Error(deleteError.message);
  }

  if (rows.length === 0) return 0;

  const dbRows = rows.map((row, index) => ({
    supplier_name: row.supplier.trim(),
    amount: row.amount,
    period_label: periodLabel,
    total_amount: totalAmount,
    sort_order: index + 1,
  }));

  let inserted = 0;
  for (let i = 0; i < dbRows.length; i += INSERT_BATCH_SIZE) {
    const batch = dbRows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from(TABLE).insert(batch);
    if (error) throw new Error(error.message);
    inserted += batch.length;
  }

  return inserted;
}

export async function expensesBySupplierSummaryTableExists(): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).select("id").limit(1);
  if (!error) return true;
  if (error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) {
    return false;
  }
  throw new Error(error.message);
}
