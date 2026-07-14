import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MockInvoiceLine } from "@/lib/mock-data/types";

const TABLE = "sales_transaction_lines";
const INSERT_BATCH_SIZE = 500;

export type SalesTransactionLineInsert = {
  reference_number: string;
  sort_order: number;
  product_service: string | null;
  description: string | null;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
};

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

/** Lines grouped by their (raw, trimmed) reference number, ordered by sort_order. */
export async function listSalesTransactionLinesFromDb(): Promise<
  Record<string, MockInvoiceLine[]>
> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const grouped: Record<string, MockInvoiceLine[]> = {};

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("reference_number, sort_order, product_service, description, quantity, rate, amount")
      .order("reference_number", { ascending: true })
      .order("sort_order", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (isMissingTable(error)) return grouped;
      throw new Error(error.message);
    }

    const batch = data ?? [];
    for (const row of batch) {
      const reference = String(row.reference_number ?? "").trim();
      if (!reference) continue;
      const list = (grouped[reference] = grouped[reference] ?? []);
      list.push({
        id: `${reference}-line-${row.sort_order ?? list.length}`,
        serviceDate: "",
        productService: String(row.product_service ?? "").trim(),
        sku: "",
        description: String(row.description ?? "").trim(),
        qty: row.quantity == null ? 1 : Number(row.quantity) || 0,
        rate: row.rate == null ? 0 : Number(row.rate) || 0,
        className: "",
      });
    }

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return grouped;
}

export async function replaceSalesTransactionLinesInDb(
  rows: readonly SalesTransactionLineInsert[],
): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .neq("reference_number", "");

  if (deleteError) {
    if (isMissingTable(deleteError)) return 0;
    throw new Error(deleteError.message);
  }

  const clean = rows.filter((row) => row.reference_number.trim());
  if (clean.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < clean.length; i += INSERT_BATCH_SIZE) {
    const batch = clean.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from(TABLE).insert(batch);
    if (error) {
      if (isMissingTable(error)) return inserted;
      throw new Error(error.message);
    }
    inserted += batch.length;
  }

  return inserted;
}
