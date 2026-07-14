import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MockCustomer } from "@/lib/mock-data/types";
import {
  customerRowToMock,
  normalizeCustomerCurrency,
  parsedCustomerToInsert,
  type CustomerInsert,
  type CustomerRow,
} from "./types";

const TABLE = "customers";
const INSERT_BATCH_SIZE = 500;

export type ParsedCustomerImportPayload = {
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
  attachmentCount: number;
  openBalance: number;
};

export async function listCustomersFromDb(): Promise<MockCustomer[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const allRows: CustomerRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("customer_name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as CustomerRow[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows.map(customerRowToMock);
}

export type ImportCustomersDbResult = {
  added: MockCustomer[];
  skipped: Array<{ name: string; reason: string; rowNumber?: number }>;
  replaced: boolean;
};

async function insertInBatches(rows: CustomerInsert[]): Promise<CustomerRow[]> {
  const supabase = createSupabaseAdminClient();
  const inserted: CustomerRow[] = [];

  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const { data, error } = await supabase.from(TABLE).insert(batch).select("*");
    if (error) throw new Error(error.message);
    inserted.push(...((data ?? []) as CustomerRow[]));
  }

  return inserted;
}

export async function importCustomersInDb(
  rows: ParsedCustomerImportPayload[],
  options?: { replace?: boolean },
): Promise<ImportCustomersDbResult> {
  const supabase = createSupabaseAdminClient();
  const replace = options?.replace ?? false;

  if (replace) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
  }

  const skipped: ImportCustomersDbResult["skipped"] = [];
  const toInsert: CustomerInsert[] = [];
  const existingNames = replace
    ? new Set<string>()
    : new Set((await listCustomersFromDb()).map((c) => c.name.toLowerCase()));

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const name = row.name.trim();
    if (!name) {
      skipped.push({
        name: "(blank row)",
        reason: "Missing customer name",
        rowNumber: row.rowNumber,
      });
      continue;
    }
    if (existingNames.has(name.toLowerCase())) {
      skipped.push({
        name,
        reason: "Customer already exists",
        rowNumber: row.rowNumber,
      });
      continue;
    }
    existingNames.add(name.toLowerCase());
    toInsert.push(
      parsedCustomerToInsert({
        ...row,
        sortOrder: toInsert.length + 1,
      }),
    );
  }

  if (toInsert.length === 0) {
    return { added: [], skipped, replaced: replace };
  }

  const inserted = await insertInBatches(toInsert);
  return {
    added: inserted.map(customerRowToMock),
    skipped,
    replaced: replace,
  };
}

export async function createCustomerInDb(input: {
  name: string;
  companyName: string;
  phone: string;
  currency: string;
  email?: string;
}): Promise<MockCustomer> {
  const supabase = createSupabaseAdminClient();
  const name = input.name.trim();
  if (!name) throw new Error("Customer name is required.");

  const company = input.companyName.trim();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      customer_name: name,
      company_name: company && company.toLowerCase() !== "none" ? company : null,
      phone: input.phone.trim() || null,
      email: input.email?.trim() || null,
      currency: normalizeCustomerCurrency(input.currency),
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return customerRowToMock(data as CustomerRow);
}

export async function customersTableExists(): Promise<boolean> {
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
