import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listCustomersFromDb } from "@/lib/customers/repository";
import {
  invoicesFromSalesTransactions,
  normalizeInvoiceRef,
} from "@/lib/ledger/invoices-from-sales-transactions";
import {
  deleteSalesTransactionsInDb,
  getSalesTransactionByIdFromDb,
} from "@/lib/sales-transactions/repository";
import type { MockInvoice } from "@/lib/mock-data/types";
import {
  invoiceRowToMock,
  mergeAttachmentsIntoTimeline,
  mockInvoicePatchToUpdate,
  mockInvoiceToInsert,
  toDbCustomerId,
  type InvoiceRow,
} from "./types";

const TABLE = "invoices";
const SALES_TABLE = "sales_transactions";

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

async function getInvoiceByIdFromDb(id: string): Promise<MockInvoice | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? invoiceRowToMock(data as InvoiceRow) : null;
}

/**
 * Imported QuickBooks invoices live as sales_transactions rows and are only
 * projected into MockInvoice in memory. Timeline updates need a real invoices
 * row — materialize one from the sales transaction when missing.
 */
async function materializeInvoiceFromSalesTransaction(
  id: string,
  patch: Partial<MockInvoice>,
): Promise<MockInvoice | null> {
  const salesTxn = await getSalesTransactionByIdFromDb(id);
  if (!salesTxn || salesTxn.type !== "Invoice") return null;

  const customers = await listCustomersFromDb();
  const [derived] = invoicesFromSalesTransactions([salesTxn], customers);
  if (!derived) return null;

  const merged: MockInvoice = { ...derived, ...patch, id };
  const insertPayload = mockInvoiceToInsert(merged);
  const insert = {
    id,
    ...insertPayload,
    // Belt-and-suspenders: never write synthetic import: ids into uuid FK.
    customer_id: toDbCustomerId(merged.customerId),
  };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert(insert)
    .select("*")
    .single();

  if (error) {
    // Concurrent create — fall through to a normal update.
    if (error.code === "23505") {
      return updateInvoiceInDb(id, patch);
    }
    throw new Error(error.message);
  }

  return invoiceRowToMock(data as InvoiceRow);
}

export async function updateInvoiceInDb(
  id: string,
  patch: Partial<MockInvoice>,
): Promise<MockInvoice | null> {
  const update = mockInvoicePatchToUpdate(patch);

  // Keep persisted attachments / customer name when timeline (or other fields) are patched alone.
  if (
    patch.attachments !== undefined ||
    patch.customerName !== undefined ||
    patch.customerId !== undefined ||
    update.status_timeline !== undefined
  ) {
    const existing = await getInvoiceByIdFromDb(id);
    const customerName =
      patch.customerName !== undefined
        ? patch.customerName
        : patch.customerId?.startsWith("import:")
          ? patch.customerId.slice("import:".length)
          : existing?.customerName;
    update.status_timeline = mergeAttachmentsIntoTimeline(
      patch.statusTimeline ??
        (update.status_timeline as MockInvoice["statusTimeline"]) ??
        existing?.statusTimeline,
      patch.attachments !== undefined ? patch.attachments : existing?.attachments,
      customerName,
    );
  }

  if (Object.keys(update).length === 0) {
    return getInvoiceByIdFromDb(id);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return invoiceRowToMock(data as InvoiceRow);

  return materializeInvoiceFromSalesTransaction(id, patch);
}

export async function deleteInvoiceInDb(id: string): Promise<{
  deleted: boolean;
  deletedSalesIds: string[];
}> {
  const supabase = createSupabaseAdminClient();
  const invoiceIds = new Set<string>([id]);
  const salesIds = new Set<string>();
  const numberKeys = new Set<string>();

  const existingInvoice = await getInvoiceByIdFromDb(id);
  if (existingInvoice) {
    const key = normalizeInvoiceRef(existingInvoice.number);
    if (key) numberKeys.add(key);
  }

  const salesById = await getSalesTransactionByIdFromDb(id);
  if (salesById?.type === "Invoice") {
    salesIds.add(id);
    const key = normalizeInvoiceRef(salesById.number);
    if (key) numberKeys.add(key);
  }

  // Linked UI invoice + sales ledger row often use different UUIDs but the same number.
  if (numberKeys.size > 0) {
    const { data: salesRows, error: salesError } = await supabase
      .from(SALES_TABLE)
      .select("id, reference_number, transaction_type")
      .eq("transaction_type", "Invoice");
    if (salesError) throw new Error(salesError.message);
    for (const row of salesRows ?? []) {
      const key = normalizeInvoiceRef(row.reference_number);
      if (key && numberKeys.has(key)) salesIds.add(row.id as string);
    }

    const { data: invoiceRows, error: invoiceError } = await supabase
      .from(TABLE)
      .select("id, invoice_number");
    if (invoiceError) throw new Error(invoiceError.message);
    for (const row of invoiceRows ?? []) {
      const key = normalizeInvoiceRef(row.invoice_number);
      if (key && numberKeys.has(key)) invoiceIds.add(row.id as string);
    }
  }

  let deletedInvoiceCount = 0;
  const invoiceIdList = [...invoiceIds];
  if (invoiceIdList.length > 0) {
    const { error, count } = await supabase
      .from(TABLE)
      .delete({ count: "exact" })
      .in("id", invoiceIdList);
    if (error) throw new Error(error.message);
    deletedInvoiceCount = count ?? 0;
  }

  const deletedSalesIds = [...salesIds];
  let deletedSalesCount = 0;
  if (deletedSalesIds.length > 0) {
    deletedSalesCount = await deleteSalesTransactionsInDb(deletedSalesIds);
  }

  return {
    deleted: deletedInvoiceCount > 0 || deletedSalesCount > 0,
    deletedSalesIds,
  };
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
