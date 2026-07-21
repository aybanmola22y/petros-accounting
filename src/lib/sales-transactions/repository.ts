import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import {
  getSalesTransactionLocationFromDb,
  listSalesTransactionLocationsFromDb,
  upsertSalesTransactionLocationsInDb,
} from "./locations-repository";
import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { toIsoDate } from "@/lib/report-date-utils";
import {
  parsedSalesTransactionToInsert,
  salesTransactionRowToMock,
  type SalesTransactionInsert,
  type SalesTransactionRow,
} from "./types";

function mockSalesStatusToDb(txn: Pick<MockSalesTransaction, "status" | "qbStatus">): string {
  if (txn.qbStatus?.trim()) return txn.qbStatus.trim();
  if (txn.status.kind === "closed") return "closed";
  if (txn.status.kind === "unapplied") return "unapplied";
  if (txn.status.kind === "overdue") return "overdue";
  return "open";
}

function mockSalesTransactionToInsert(
  input: Omit<MockSalesTransaction, "id"> & { id?: string },
  sortOrder: number,
): SalesTransactionInsert & { id?: string } {
  const parsedDate = parseTransactionDate(input.date);
  const isoDate = parsedDate ? toIsoDate(parsedDate) : input.date;

  return {
    ...(input.id ? { id: input.id } : {}),
    transaction_date: isoDate,
    transaction_type: input.type,
    reference_number: input.number.trim() || null,
    customer_name: input.customer.trim() || null,
    memo: input.memo.trim() || null,
    income_account_name: input.incomeAccount?.trim() || null,
    amount: input.amount,
    status: mockSalesStatusToDb(input),
    sort_order: sortOrder,
  };
}

const TABLE = "sales_transactions";
const INSERT_BATCH_SIZE = 500;

/** Columns needed to build MockSalesTransaction — skips timestamps we don't use in lists. */
const SALES_LIST_COLUMNS =
  "id, transaction_date, transaction_type, reference_number, customer_name, memo, income_account_name, amount, status, sort_order, created_at";

export type ParsedSalesTransactionImportPayload = {
  rowNumber: number;
  date: string;
  transactionType: string;
  referenceNumber: string;
  customer: string;
  memo: string;
  location?: string;
  incomeAccount?: string;
  amount: number;
  status: string;
};

export async function listSalesTransactionsFromDb(): Promise<MockSalesTransaction[]> {
  const [rows, locationByNumber] = await Promise.all([
    listSalesTransactionRowsFromDb(),
    listSalesTransactionLocationsFromDb(),
  ]);
  return rows.map((row) => salesTransactionRowToMock(row, locationByNumber));
}

export async function getSalesTransactionByIdFromDb(
  id: string,
): Promise<MockSalesTransaction | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SALES_LIST_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as SalesTransactionRow;
  const number = row.reference_number?.trim() ?? "";
  const location = number ? await getSalesTransactionLocationFromDb(number) : undefined;
  const locationByNumber =
    number && location ? new Map([[number, location]]) : undefined;
  return salesTransactionRowToMock(row, locationByNumber);
}

async function listSalesTransactionRowsFromDb(): Promise<SalesTransactionRow[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const allRows: SalesTransactionRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(SALES_LIST_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("transaction_date", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as SalesTransactionRow[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}

async function nextSalesSortOrder(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number((data as { sort_order?: number } | null)?.sort_order ?? 0) + 1;
}

export type ImportSalesTransactionsDbResult = {
  added: number;
  skipped: Array<{ customer: string; reason: string; rowNumber?: number }>;
  replaced: boolean;
};

async function insertInBatches(rows: SalesTransactionInsert[]): Promise<number> {
  const supabase = createSupabaseAdminClient();
  let inserted = 0;

  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from(TABLE).insert(batch);
    if (error) throw new Error(error.message);
    inserted += batch.length;
  }

  return inserted;
}

export async function importSalesTransactionsInDb(
  rows: ParsedSalesTransactionImportPayload[],
  options?: { replace?: boolean },
): Promise<ImportSalesTransactionsDbResult> {
  const supabase = createSupabaseAdminClient();
  const replace = options?.replace ?? false;

  if (replace) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
  }

  const skipped: ImportSalesTransactionsDbResult["skipped"] = [];
  const toInsert: SalesTransactionInsert[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    if (!row.date.trim()) {
      skipped.push({
        customer: row.customer || "(blank row)",
        reason: "Missing date",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    toInsert.push(
      parsedSalesTransactionToInsert({
        ...row,
        sortOrder: toInsert.length + 1,
      }),
    );
  }

  if (toInsert.length === 0) {
    return { added: 0, skipped, replaced: replace };
  }

  const added = await insertInBatches(toInsert);

  const locationUpserts = new Map<string, string>();
  for (const row of rows) {
    const referenceNumber = row.referenceNumber.trim();
    const location = row.location?.trim();
    if (referenceNumber && location) {
      locationUpserts.set(referenceNumber, location);
    }
  }
  if (locationUpserts.size > 0) {
    await upsertSalesTransactionLocationsInDb(locationUpserts);
  }

  return { added, skipped, replaced: replace };
}

export async function createSalesTransactionInDb(
  input: Omit<MockSalesTransaction, "id"> & { id?: string },
): Promise<MockSalesTransaction> {
  const supabase = createSupabaseAdminClient();
  const sortOrder = await nextSalesSortOrder();

  const { data, error } = await supabase
    .from(TABLE)
    .insert(mockSalesTransactionToInsert(input, sortOrder))
    .select(SALES_LIST_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  const locationByNumber =
    input.location?.trim() && input.number.trim()
      ? new Map([[input.number.trim(), input.location.trim()]])
      : undefined;
  return salesTransactionRowToMock(data as SalesTransactionRow, locationByNumber);
}

export async function updateSalesTransactionInDb(
  id: string,
  patch: Partial<Omit<MockSalesTransaction, "id">>,
): Promise<MockSalesTransaction | null> {
  const supabase = createSupabaseAdminClient();
  const update: Record<string, unknown> = {};

  if (patch.date !== undefined) {
    const parsedDate = parseTransactionDate(patch.date);
    update.transaction_date = parsedDate ? toIsoDate(parsedDate) : patch.date;
  }
  if (patch.type !== undefined) update.transaction_type = patch.type;
  if (patch.number !== undefined) update.reference_number = patch.number.trim() || null;
  if (patch.customer !== undefined) update.customer_name = patch.customer.trim() || null;
  if (patch.memo !== undefined) update.memo = patch.memo.trim() || null;
  if (patch.incomeAccount !== undefined) {
    update.income_account_name = patch.incomeAccount.trim() || null;
  }
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.status !== undefined || patch.qbStatus !== undefined) {
    update.status = mockSalesStatusToDb({
      status: patch.status ?? { kind: "closed" },
      qbStatus: patch.qbStatus,
    });
  }

  if (Object.keys(update).length === 0) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq("id", id)
    .select(SALES_LIST_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const number = (data as SalesTransactionRow).reference_number?.trim() ?? "";
  const location = number ? await getSalesTransactionLocationFromDb(number) : undefined;
  const locationByNumber =
    number && location ? new Map([[number, location]]) : undefined;
  return salesTransactionRowToMock(data as SalesTransactionRow, locationByNumber);
}

export async function deleteSalesTransactionsInDb(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const supabase = createSupabaseAdminClient();
  const { error, count } = await supabase
    .from(TABLE)
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getNextPaymentNumberFromDb(): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  let max = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("reference_number")
      .eq("transaction_type", "Payment")
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Array<{ reference_number: string | null }>;
    for (const row of batch) {
      const n = parseInt((row.reference_number ?? "").replace(/\D/g, ""), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return `PMT-${max + 1}`;
}

export async function salesTransactionsTableExists(): Promise<boolean> {
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
