import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ImportedApAgingDetailLine,
  ImportedApAgingDetailSnapshot,
} from "@/lib/ap-aging-detail-import";
import type { ImportedApAgingDetailBucket } from "@/lib/ap-aging-detail-import";

const TABLE = "ap_aging_detail_lines";
const INSERT_BATCH_SIZE = 500;

type ApAgingDetailLineRow = {
  reference_number: string;
  transaction_type: string;
  transaction_date: string | null;
  supplier_name: string | null;
  location: string | null;
  due_date: string | null;
  past_due_days: number | null;
  amount: number | string;
  open_balance: number | string;
  bucket: string;
  sort_order: number;
  as_of?: string | null;
  total_amount?: number | string | null;
  total_open_balance?: number | string | null;
};

function rowToImportedLine(row: ApAgingDetailLineRow): ImportedApAgingDetailLine {
  return {
    referenceNumber: row.reference_number ?? "",
    transactionType: row.transaction_type,
    date: row.transaction_date?.trim() ?? "",
    supplier: row.supplier_name?.trim() ?? "",
    location: row.location?.trim() ?? "",
    dueDate: row.due_date?.trim() ?? "",
    pastDueDays:
      row.past_due_days == null || Number.isNaN(Number(row.past_due_days))
        ? undefined
        : Number(row.past_due_days),
    amount: Number(row.amount) || 0,
    openBalance: Number(row.open_balance) || 0,
    bucket: row.bucket as ImportedApAgingDetailBucket,
  };
}

export async function listApAgingDetailLinesFromDb(): Promise<ImportedApAgingDetailSnapshot> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const lines: ImportedApAgingDetailLine[] = [];
  let asOf = "";
  let totalAmount: number | undefined;
  let totalOpenBalance: number | undefined;

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
        return { asOf: "", lines: [] };
      }
      throw new Error(error.message);
    }

    const batch = (data ?? []) as ApAgingDetailLineRow[];
    for (const row of batch) {
      if (!asOf && row.as_of?.trim()) asOf = row.as_of.trim();
      if (totalAmount == null && row.total_amount != null) {
        totalAmount = Number(row.total_amount);
      }
      if (totalOpenBalance == null && row.total_open_balance != null) {
        totalOpenBalance = Number(row.total_open_balance);
      }
      lines.push(rowToImportedLine(row));
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return { asOf, lines, totalAmount, totalOpenBalance };
}

export async function replaceApAgingDetailLinesInDb(
  snapshot: ImportedApAgingDetailSnapshot,
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const lines = snapshot.lines;
  const asOf = snapshot.asOf?.trim() || null;
  const totalAmount = snapshot.totalAmount ?? null;
  const totalOpenBalance = snapshot.totalOpenBalance ?? null;

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

  if (lines.length === 0) return 0;

  const rows = lines.map((line, index) => ({
    reference_number: line.referenceNumber.trim(),
    transaction_type: line.transactionType.trim(),
    transaction_date: line.date.trim() || null,
    supplier_name: line.supplier.trim() || null,
    location: line.location.trim() || null,
    due_date: line.dueDate.trim() || null,
    past_due_days: line.pastDueDays ?? null,
    amount: line.amount,
    open_balance: line.openBalance,
    bucket: line.bucket,
    sort_order: index + 1,
    as_of: asOf,
    total_amount: totalAmount,
    total_open_balance: totalOpenBalance,
  }));

  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from(TABLE).insert(batch);
    if (error) throw new Error(error.message);
    inserted += batch.length;
  }

  return inserted;
}

export async function apAgingDetailTableExists(): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).select("id").limit(1);
  if (!error) return true;
  if (error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) {
    return false;
  }
  throw new Error(error.message);
}
