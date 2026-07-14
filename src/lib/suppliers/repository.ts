import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MockSupplier, SupplierProfile } from "@/lib/mock-data/suppliers";
import {
  parsedSupplierToInsert,
  supplierFormToInsert,
  supplierFormToUpdate,
  supplierRowToMock,
  type SupplierInsert,
  type SupplierRow,
} from "./types";

const TABLE = "suppliers";

export type ParsedSupplierImportPayload = {
  rowNumber: number;
  name: string;
  companyName: string;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  phone: string;
  email: string;
  currency: string;
  attachmentCount: number;
  openingBalance: number;
};

export async function listSuppliersFromDb(): Promise<MockSupplier[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const allRows: SupplierRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("supplier_name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as SupplierRow[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows.map(supplierRowToMock);
}

export type ImportSuppliersDbResult = {
  added: MockSupplier[];
  skipped: Array<{ name: string; reason: string; rowNumber?: number }>;
  replaced: boolean;
};

export async function importSuppliersInDb(
  rows: ParsedSupplierImportPayload[],
  options?: { replace?: boolean },
): Promise<ImportSuppliersDbResult> {
  const supabase = createSupabaseAdminClient();
  const replace = options?.replace ?? false;

  if (replace) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
  }

  const skipped: ImportSuppliersDbResult["skipped"] = [];
  const toInsert: SupplierInsert[] = [];

  const existingNames = replace
    ? new Set<string>()
    : new Set((await listSuppliersFromDb()).map((s) => s.name.toLowerCase()));

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const name = row.name.trim();
    if (!name) {
      skipped.push({
        name: "(blank row)",
        reason: "Missing supplier name",
        rowNumber: row.rowNumber,
      });
      continue;
    }
    if (existingNames.has(name.toLowerCase())) {
      skipped.push({
        name,
        reason: "Supplier already exists",
        rowNumber: row.rowNumber,
      });
      continue;
    }
    existingNames.add(name.toLowerCase());
    toInsert.push(
      parsedSupplierToInsert({
        ...row,
        sortOrder: toInsert.length + 1,
      }),
    );
  }

  if (toInsert.length === 0) {
    return { added: [], skipped, replaced: replace };
  }

  const { data, error } = await supabase.from(TABLE).insert(toInsert).select("*");
  if (error) throw new Error(error.message);

  const added = ((data ?? []) as SupplierRow[]).map(supplierRowToMock);
  return { added, skipped, replaced: replace };
}

export async function createSupplierInDb(input: {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  currency?: string;
  openingBalance?: number;
  profile?: SupplierProfile;
}): Promise<MockSupplier> {
  const name = input.name.trim();
  if (!name) throw new Error("Supplier name is required.");

  const existing = await listSuppliersFromDb();
  if (existing.some((supplier) => supplier.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Supplier already exists");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      supplierFormToInsert({
        ...input,
        name,
        sortOrder: existing.length + 1,
      }),
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return supplierRowToMock(data as SupplierRow);
}

export async function updateSupplierInDb(
  id: string,
  input: {
    name: string;
    companyName?: string;
    phone?: string;
    email?: string;
    currency?: string;
    openingBalance?: number;
    profile?: SupplierProfile;
  },
): Promise<MockSupplier | null> {
  const name = input.name.trim();
  if (!name) throw new Error("Supplier name is required.");

  const existing = await listSuppliersFromDb();
  if (
    existing.some(
      (supplier) => supplier.id !== id && supplier.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new Error("Supplier already exists");
  }

  const update = supplierFormToUpdate(input);
  if (Object.keys(update).length === 0) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? supplierRowToMock(data as SupplierRow) : null;
}

export async function suppliersTableExists(): Promise<boolean> {
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
