import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MockInvoice } from "@/lib/mock-data/types";
import {
  invoiceRowToMock,
  mockInvoicePatchToUpdate,
  mockInvoiceToInsert,
  type InvoiceRow,
} from "./types";

const TABLE = "invoices";

export async function listInvoicesFromDb(): Promise<MockInvoice[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const allRows: InvoiceRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("invoice_date", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as InvoiceRow[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows.map(invoiceRowToMock);
}

export async function createInvoiceInDb(
  input: Omit<MockInvoice, "id"> & { sortOrder?: number },
): Promise<MockInvoice> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mockInvoiceToInsert(input))
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return invoiceRowToMock(data as InvoiceRow);
}

export async function updateInvoiceInDb(
  id: string,
  patch: Partial<MockInvoice>,
): Promise<MockInvoice | null> {
  const update = mockInvoicePatchToUpdate(patch);
  if (Object.keys(update).length === 0) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? invoiceRowToMock(data as InvoiceRow) : null;
}

export async function deleteInvoiceInDb(id: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error, count } = await supabase.from(TABLE).delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function getNextInvoiceNumberFromDb(): Promise<string> {
  const invoices = await listInvoicesFromDb();
  let max = 0;
  for (const inv of invoices) {
    const n = parseInt(inv.number.replace(/\D/g, ""), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

export async function invoicesTableExists(): Promise<boolean> {
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
