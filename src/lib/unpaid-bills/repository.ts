import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { listSuppliersFromDb } from "@/lib/suppliers/repository";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";
import {
  parsedUnpaidBillToInsert,
  unpaidBillRowToMock,
  type UnpaidBillInsert,
  type UnpaidBillRow,
} from "./types";

const TABLE = "unpaid_bills";

export type ParsedUnpaidBillImportPayload = {
  rowNumber: number;
  supplierName: string;
  dueDate: string;
  billAmount: number;
  openBalance: number;
  status: string;
  billNo?: string;
};

export async function listUnpaidBillsFromDb(): Promise<UnpaidBill[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const allRows: UnpaidBillRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("due_date", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as UnpaidBillRow[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows.map(unpaidBillRowToMock);
}

export type ImportUnpaidBillsDbResult = {
  added: UnpaidBill[];
  skipped: Array<{ supplier: string; reason: string; rowNumber?: number }>;
  replaced: boolean;
};

async function buildSupplierIdByName(): Promise<Map<string, string>> {
  const suppliers = await listSuppliersFromDb();
  const map = new Map<string, string>();
  for (const supplier of suppliers) {
    map.set(supplier.name.toLowerCase(), supplier.id);
  }
  return map;
}

export async function importUnpaidBillsInDb(
  rows: ParsedUnpaidBillImportPayload[],
  options?: { replace?: boolean },
): Promise<ImportUnpaidBillsDbResult> {
  const supabase = createSupabaseAdminClient();
  const replace = options?.replace ?? false;

  if (replace) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
  }

  const supplierIdByName = await buildSupplierIdByName();
  const skipped: ImportUnpaidBillsDbResult["skipped"] = [];
  const toInsert: UnpaidBillInsert[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const supplierName = row.supplierName.trim();
    if (!supplierName) {
      skipped.push({
        supplier: "(blank row)",
        reason: "Missing supplier name",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    toInsert.push(
      parsedUnpaidBillToInsert({
        ...row,
        supplierId: supplierIdByName.get(supplierName.toLowerCase()) ?? null,
        sortOrder: toInsert.length + 1,
      }),
    );
  }

  if (toInsert.length === 0) {
    return { added: [], skipped, replaced: replace };
  }

  const { data, error } = await supabase.from(TABLE).insert(toInsert).select("*");
  if (error) throw new Error(error.message);

  const added = ((data ?? []) as UnpaidBillRow[]).map(unpaidBillRowToMock);
  return { added, skipped, replaced: replace };
}

export async function createUnpaidBillInDb(input: {
  supplierName: string;
  dueDate: string;
  billAmount: number;
  openBalance?: number;
  status?: string;
  supplierId?: string | null;
}): Promise<UnpaidBill> {
  const supabase = createSupabaseAdminClient();
  const supplierName = input.supplierName.trim();
  if (!supplierName) throw new Error("Supplier name is required.");

  let supplierId = input.supplierId ?? null;
  if (!supplierId) {
    const supplierIdByName = await buildSupplierIdByName();
    supplierId = supplierIdByName.get(supplierName.toLowerCase()) ?? null;
  }

  const existing = await listUnpaidBillsFromDb();
  const sortOrder = existing.length + 1;
  const parsedDate = parseTransactionDate(input.dueDate);
  const isoDate = parsedDate ? parsedDate.toISOString().slice(0, 10) : input.dueDate;
  const billAmount = input.billAmount;
  const openBalance = input.openBalance ?? billAmount;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      supplier_id: supplierId,
      supplier_name: supplierName,
      due_date: isoDate,
      bill_amount: billAmount,
      open_balance: openBalance,
      status: input.status?.trim() || "Due on receipt",
      sort_order: sortOrder,
      source_row_number: null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return unpaidBillRowToMock(data as UnpaidBillRow);
}

export async function unpaidBillsTableExists(): Promise<boolean> {
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
