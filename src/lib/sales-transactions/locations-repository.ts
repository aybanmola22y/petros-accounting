import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TABLE = "sales_transaction_locations";
const INSERT_BATCH_SIZE = 500;

export async function listSalesTransactionLocationsFromDb(): Promise<Map<string, string>> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const map = new Map<string, string>();

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("reference_number, location")
      .order("reference_number", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (
        error.code === "PGRST205" ||
        /does not exist|schema cache/i.test(error.message)
      ) {
        return map;
      }
      throw new Error(error.message);
    }

    const batch = data ?? [];
    for (const row of batch) {
      const referenceNumber = String(row.reference_number ?? "").trim();
      const location = String(row.location ?? "").trim();
      if (referenceNumber && location) {
        map.set(referenceNumber, location);
      }
    }

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return map;
}

export async function replaceSalesTransactionLocationsInDb(
  locations: ReadonlyMap<string, string>,
): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .neq("reference_number", "");

  if (deleteError) {
    if (
      deleteError.code === "PGRST205" ||
      /does not exist|schema cache/i.test(deleteError.message)
    ) {
      return 0;
    }
    throw new Error(deleteError.message);
  }

  const rows = [...locations.entries()]
    .filter(([referenceNumber, location]) => referenceNumber.trim() && location.trim())
    .map(([reference_number, location]) => ({
      reference_number: reference_number.trim(),
      location: location.trim(),
    }));

  if (rows.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from(TABLE).insert(batch);
    if (error) throw new Error(error.message);
    inserted += batch.length;
  }

  return inserted;
}

export async function upsertSalesTransactionLocationsInDb(
  locations: ReadonlyMap<string, string>,
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const rows = [...locations.entries()]
    .filter(([referenceNumber, location]) => referenceNumber.trim() && location.trim())
    .map(([reference_number, location]) => ({
      reference_number: reference_number.trim(),
      location: location.trim(),
    }));

  if (rows.length === 0) return 0;

  let upserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from(TABLE).upsert(batch, {
      onConflict: "reference_number",
    });
    if (error) {
      if (
        error.code === "PGRST205" ||
        /does not exist|schema cache/i.test(error.message)
      ) {
        return 0;
      }
      throw new Error(error.message);
    }
    upserted += batch.length;
  }

  return upserted;
}
