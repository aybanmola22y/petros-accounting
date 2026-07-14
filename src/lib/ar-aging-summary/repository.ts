import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CustomerAgingRow } from "@/lib/ar-aging-from-receivables";
import type { ImportedArAgingSummarySnapshot } from "@/lib/ar-aging-summary-import";

const TABLE = "ar_aging_summary_rows";
const INSERT_BATCH_SIZE = 500;

type SummaryRow = {
  customer_name: string;
  current_amount: number | string;
  days_1_to_30: number | string;
  days_31_to_60: number | string;
  days_61_to_90: number | string;
  days_91_plus: number | string;
  as_of: string | null;
  sort_order: number;
};

function rowToCustomerAging(row: SummaryRow): CustomerAgingRow {
  const toAmount = (value: number | string) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    id: row.customer_name.trim().toLowerCase(),
    customer: row.customer_name.trim(),
    buckets: {
      current: toAmount(row.current_amount),
      days1to30: toAmount(row.days_1_to_30),
      days31to60: toAmount(row.days_31_to_60),
      days61to90: toAmount(row.days_61_to_90),
      days91plus: toAmount(row.days_91_plus),
    },
  };
}

export async function listArAgingSummaryRowsFromDb(): Promise<ImportedArAgingSummarySnapshot | null> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const rows: CustomerAgingRow[] = [];
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
        return null;
      }
      throw new Error(error.message);
    }

    const batch = (data ?? []) as SummaryRow[];
    for (const row of batch) {
      if (!asOf && row.as_of) asOf = row.as_of;
      rows.push(rowToCustomerAging(row));
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  if (rows.length === 0) return null;
  return { asOf, rows };
}

export async function replaceArAgingSummaryRowsInDb(
  snapshot: ImportedArAgingSummarySnapshot,
): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .neq("customer_name", "");

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
    customer_name: row.customer.trim(),
    current_amount: row.buckets.current,
    days_1_to_30: row.buckets.days1to30,
    days_31_to_60: row.buckets.days31to60,
    days_61_to_90: row.buckets.days61to90,
    days_91_plus: row.buckets.days91plus,
    as_of: snapshot.asOf || null,
    sort_order: index + 1,
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
