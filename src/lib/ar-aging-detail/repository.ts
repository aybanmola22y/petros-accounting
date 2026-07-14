import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ImportedArAgingDetailLine } from "@/lib/ar-aging-detail-import";
import type { AgingBucketKey } from "@/lib/ar-aging-from-receivables";

const TABLE = "ar_aging_detail_lines";
const INSERT_BATCH_SIZE = 500;

type ArAgingDetailLineRow = {
  reference_number: string;
  transaction_type: string;
  transaction_date: string | null;
  customer_name: string | null;
  location: string | null;
  due_date: string | null;
  amount: number | string;
  open_balance: number | string;
  bucket: string;
  sort_order: number;
  as_of?: string | null;
};

function rowToImportedLine(row: ArAgingDetailLineRow): ImportedArAgingDetailLine {
  return {
    referenceNumber: row.reference_number,
    transactionType: row.transaction_type,
    date: row.transaction_date?.trim() ?? "",
    customer: row.customer_name?.trim() ?? "",
    location: row.location?.trim() ?? "",
    dueDate: row.due_date?.trim() ?? "",
    amount: Number(row.amount) || 0,
    openBalance: Number(row.open_balance) || 0,
    bucket: row.bucket as AgingBucketKey,
  };
}

export async function listArAgingDetailLinesFromDb(): Promise<{
  asOf: string;
  lines: ImportedArAgingDetailLine[];
}> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const lines: ImportedArAgingDetailLine[] = [];
  let asOf = "";

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

    const batch = (data ?? []) as ArAgingDetailLineRow[];
    for (const row of batch) {
      if (!asOf && row.as_of?.trim()) asOf = row.as_of.trim();
      lines.push(rowToImportedLine(row));
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return { asOf, lines };
}

export async function replaceArAgingDetailLinesInDb(
  snapshot: { asOf?: string; lines: readonly ImportedArAgingDetailLine[] },
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const lines = snapshot.lines;
  const asOf = snapshot.asOf?.trim() || null;

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

  const baseRows = lines.map((line, index) => ({
    reference_number: line.referenceNumber.trim(),
    transaction_type: line.transactionType.trim(),
    transaction_date: line.date.trim() || null,
    customer_name: line.customer.trim() || null,
    location: line.location.trim() || null,
    due_date: line.dueDate.trim() || null,
    amount: line.amount,
    open_balance: line.openBalance,
    bucket: line.bucket,
    sort_order: index + 1,
  }));

  const rowsWithAsOf = baseRows.map((row) => ({ ...row, as_of: asOf }));

  let inserted = 0;
  let useAsOf = true;
  for (let i = 0; i < baseRows.length; i += INSERT_BATCH_SIZE) {
    const batch = (useAsOf ? rowsWithAsOf : baseRows).slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from(TABLE).insert(batch);
    if (error) {
      if (
        useAsOf &&
        i === 0 &&
        (/as_of/i.test(error.message) || error.code === "PGRST204")
      ) {
        useAsOf = false;
        i -= INSERT_BATCH_SIZE;
        continue;
      }
      throw new Error(error.message);
    }
    inserted += batch.length;
  }

  return inserted;
}
