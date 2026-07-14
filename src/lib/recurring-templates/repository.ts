import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MockRecurringTemplate } from "@/lib/mock-data/recurring-transactions";
import { ensureRecurringDetailsColumn } from "./migrate";
import {
  mockRecurringTemplateToInsert,
  recurringTemplateRowToMock,
  type RecurringTemplateRow,
} from "./types";

const TABLE = "recurring_templates";

export async function listRecurringTemplatesFromDb(): Promise<MockRecurringTemplate[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const allRows: RecurringTemplateRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("template_name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as RecurringTemplateRow[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows.map(recurringTemplateRowToMock);
}

export async function createRecurringTemplateInDb(
  input: Omit<MockRecurringTemplate, "id">,
): Promise<MockRecurringTemplate> {
  if (input.details != null) {
    await ensureRecurringDetailsColumn();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert(mockRecurringTemplateToInsert(input))
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return recurringTemplateRowToMock(data as RecurringTemplateRow);
}

export async function deleteRecurringTemplateInDb(id: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error, count } = await supabase.from(TABLE).delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function updateRecurringTemplateInDb(
  id: string,
  patch: Partial<MockRecurringTemplate>,
): Promise<MockRecurringTemplate | null> {
  const supabase = createSupabaseAdminClient();
  const update: Record<string, unknown> = {};

  if (patch.templateName !== undefined) update.template_name = patch.templateName.trim();
  if (patch.scheduleType !== undefined) update.schedule_type = patch.scheduleType;
  if (patch.txnType !== undefined) update.txn_type = patch.txnType;
  if (patch.interval !== undefined) update.interval_label = patch.interval;
  if (patch.previousDate !== undefined) update.previous_date = patch.previousDate;
  if (patch.nextDate !== undefined) update.next_date = patch.nextDate;
  if (patch.customerSupplier !== undefined) update.customer_supplier = patch.customerSupplier.trim();
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.location !== undefined) update.location = patch.location ?? null;
  if (patch.details !== undefined) update.details = patch.details ?? null;

  if (patch.details !== undefined) {
    await ensureRecurringDetailsColumn();
  }

  if (Object.keys(update).length === 0) {
    const existing = await listRecurringTemplatesFromDb();
    return existing.find((row) => row.id === id) ?? null;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return recurringTemplateRowToMock(data as RecurringTemplateRow);
}

export async function recurringTemplatesTableExists(): Promise<boolean> {
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
