import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listChartAccountsFromDb } from "@/lib/chart-of-accounts/repository";
import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { toIsoDate } from "@/lib/report-date-utils";
import {
  expenseTransactionRowToMock,
  parsedExpenseToInsert,
  type ExpenseTransactionInsert,
  type ExpenseTransactionRow,
} from "./types";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";

const TABLE = "expense_transactions";
const INSERT_BATCH_SIZE = 500;

const EXPENSE_LIST_COLUMNS =
  "id, transaction_date, transaction_type, reference_number, payee, category, category_account_id, total_before_tax, sales_tax, total, is_split, payment_account_id, status, sort_order";

export async function listExpenseTransactionsFromDb(): Promise<MockExpenseTransaction[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const allRows: ExpenseTransactionRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(EXPENSE_LIST_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("transaction_date", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as ExpenseTransactionRow[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows.map(expenseTransactionRowToMock);
}

async function nextExpenseSortOrder(): Promise<number> {
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

export type ImportExpenseTransactionsDbResult = {
  added: MockExpenseTransaction[];
  skipped: Array<{ payee: string; reason: string; rowNumber?: number }>;
  replaced: boolean;
  unmatchedCategories: number;
};

function buildCategoryAccountMap(
  accounts: Awaited<ReturnType<typeof listChartAccountsFromDb>>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const account of accounts) {
    map.set(account.name.toLowerCase(), account.id);
  }
  return map;
}

export async function importExpenseTransactionsInDb(
  rows: Array<{
    rowNumber: number;
    date: string;
    transactionType: string;
    referenceNumber: string;
    payee: string;
    category: string;
    totalBeforeTax: number;
    salesTax: number;
    total: number;
    isSplit: boolean;
    status?: string | null;
  }>,
  options?: { replace?: boolean },
): Promise<ImportExpenseTransactionsDbResult> {
  const supabase = createSupabaseAdminClient();
  const replace = options?.replace ?? false;
  const chartAccounts = await listChartAccountsFromDb();
  const categoryAccountMap = buildCategoryAccountMap(chartAccounts);

  if (replace) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
  }

  const skipped: ImportExpenseTransactionsDbResult["skipped"] = [];
  const toInsert: ExpenseTransactionInsert[] = [];
  let unmatchedCategories = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const categoryKey = row.category.trim().toLowerCase();
    let categoryAccountId: string | null = null;

    if (categoryKey && categoryKey !== "--split--") {
      categoryAccountId = categoryAccountMap.get(categoryKey) ?? null;
      if (!categoryAccountId) unmatchedCategories += 1;
    }

    toInsert.push(
      parsedExpenseToInsert({
        ...row,
        categoryAccountId,
        sortOrder: i + 1,
      }),
    );
  }

  if (toInsert.length === 0) {
    return { added: [], skipped, replaced: replace, unmatchedCategories };
  }

  // New imports already use local calendar dates (toIsoDate), so mark repaired when supported.
  const hasRepairColumn = await expenseOptionalColumnExists("import_date_repaired");
  if (hasRepairColumn) {
    for (const row of toInsert) {
      row.import_date_repaired = true;
    }
  }

  const added: MockExpenseTransaction[] = [];
  for (let i = 0; i < toInsert.length; i += INSERT_BATCH_SIZE) {
    const batch = toInsert.slice(i, i + INSERT_BATCH_SIZE);
    const { data, error } = await supabase
      .from(TABLE)
      .insert(batch)
      .select(EXPENSE_LIST_COLUMNS);
    if (error) throw new Error(error.message);
    added.push(...((data ?? []) as ExpenseTransactionRow[]).map(expenseTransactionRowToMock));
  }

  return { added, skipped, replaced: replace, unmatchedCategories };
}

export async function createExpenseTransactionInDb(
  input: Omit<MockExpenseTransaction, "id">,
): Promise<MockExpenseTransaction> {
  const supabase = createSupabaseAdminClient();
  const sortOrder = await nextExpenseSortOrder();

  const insert = parsedExpenseToInsert({
        rowNumber: sortOrder,
        date: input.date,
        transactionType: input.type,
        referenceNumber: input.number,
        payee: input.payee,
        category: input.category,
        totalBeforeTax: input.totalBeforeTax,
        salesTax: input.salesTax,
        total: input.total,
        isSplit: input.isSplit ?? false,
        status: input.status ?? null,
        categoryAccountId: input.categoryAccountId ?? null,
        sortOrder,
      });
  if (input.paymentAccountId) {
    insert.payment_account_id = input.paymentAccountId;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(insert)
    .select(EXPENSE_LIST_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return expenseTransactionRowToMock(data as ExpenseTransactionRow);
}

export async function updateExpenseTransactionInDb(
  id: string,
  patch: Partial<MockExpenseTransaction>,
): Promise<MockExpenseTransaction | null> {
  const supabase = createSupabaseAdminClient();
  const update: Record<string, unknown> = {};

  if (patch.date !== undefined) {
    const parsedDate = parseTransactionDate(patch.date);
    update.transaction_date = parsedDate ? toIsoDate(parsedDate) : patch.date;
  }
  if (patch.type !== undefined) update.transaction_type = patch.type;
  if (patch.number !== undefined) update.reference_number = patch.number.trim() || null;
  if (patch.payee !== undefined) update.payee = patch.payee.trim() || null;
  if (patch.category !== undefined) update.category = patch.category.trim() || null;
  if (patch.categoryAccountId !== undefined) {
    update.category_account_id = patch.categoryAccountId ?? null;
  }
  if (patch.totalBeforeTax !== undefined) update.total_before_tax = patch.totalBeforeTax;
  if (patch.salesTax !== undefined) update.sales_tax = patch.salesTax;
  if (patch.total !== undefined) update.total = patch.total;
  if (patch.isSplit !== undefined) update.is_split = patch.isSplit;
  if (patch.status !== undefined) update.status = patch.status ?? null;
  if (patch.paymentAccountId !== undefined) {
    update.payment_account_id = patch.paymentAccountId ?? null;
  }

  if (Object.keys(update).length === 0) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq("id", id)
    .select(EXPENSE_LIST_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? expenseTransactionRowToMock(data as ExpenseTransactionRow) : null;
}

export async function deleteExpenseTransactionsInDb(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const supabase = createSupabaseAdminClient();
  const { error, count } = await supabase
    .from(TABLE)
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getNextExpenseNumberFromDb(): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  let max = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("reference_number")
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

  return String(max + 1);
}

async function expenseOptionalColumnExists(column: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).select(column).limit(1);
  if (!error) return true;
  if (/column .*does not exist|does not exist|schema cache/i.test(error.message)) {
    return false;
  }
  throw new Error(error.message);
}

/**
 * QuickBooks imports before Mar 2026 stored dates one day early in UTC+8 because
 * toISOString() was used. Shift imported rows forward one day once.
 */
let expenseDateRepairSettled = false;

export async function repairImportedExpenseDateTimezoneIfNeeded(): Promise<number> {
  if (expenseDateRepairSettled) return 0;

  const hasRepairColumn = await expenseOptionalColumnExists("import_date_repaired");
  if (!hasRepairColumn) {
    expenseDateRepairSettled = true;
    return 0;
  }

  const supabase = createSupabaseAdminClient();
  const pageSize = 500;
  let repaired = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, transaction_date")
      .not("source_row_number", "is", null)
      .eq("import_date_repaired", false)
      .limit(pageSize);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Array<{ id: string; transaction_date: string }>;
    if (batch.length === 0) {
      expenseDateRepairSettled = true;
      break;
    }

    const updatePromises: Array<Promise<unknown>> = [];
    for (const row of batch) {
      const parsed = parseTransactionDate(row.transaction_date);
      if (!parsed) continue;
      const shifted = new Date(parsed);
      shifted.setDate(shifted.getDate() + 1);

      updatePromises.push(
        Promise.resolve(
          supabase
            .from(TABLE)
            .update({
              transaction_date: toIsoDate(shifted),
              import_date_repaired: true,
            })
            .eq("id", row.id)
            .then(({ error: updateError }) => {
              if (updateError) throw new Error(updateError.message);
            }),
        ),
      );
    }

    await Promise.all(updatePromises);
    repaired += updatePromises.length;
  }

  return repaired;
}

export async function expenseTransactionsTableExists(): Promise<boolean> {
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
