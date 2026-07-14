import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MockLead } from "@/lib/mock-data/types";
import {
  leadRowToMock,
  parsedLeadToInsert,
  type LeadInsert,
  type LeadRow,
} from "./types";

const TABLE = "leads";
const INSERT_BATCH_SIZE = 500;

export type ParsedLeadImportPayload = {
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
  leadSource: string;
  attachmentCount: number;
};

export async function listLeadsFromDb(): Promise<MockLead[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const allRows: LeadRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("lead_name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as LeadRow[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows.map(leadRowToMock);
}

export type ImportLeadsDbResult = {
  added: MockLead[];
  skipped: Array<{ name: string; reason: string; rowNumber?: number }>;
  replaced: boolean;
};

async function insertInBatches(rows: LeadInsert[]): Promise<LeadRow[]> {
  const supabase = createSupabaseAdminClient();
  const inserted: LeadRow[] = [];

  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const { data, error } = await supabase.from(TABLE).insert(batch).select("*");
    if (error) throw new Error(error.message);
    inserted.push(...((data ?? []) as LeadRow[]));
  }

  return inserted;
}

export async function importLeadsInDb(
  rows: ParsedLeadImportPayload[],
  options?: { replace?: boolean },
): Promise<ImportLeadsDbResult> {
  const supabase = createSupabaseAdminClient();
  const replace = options?.replace ?? false;

  if (replace) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
  }

  const skipped: ImportLeadsDbResult["skipped"] = [];
  const toInsert: LeadInsert[] = [];
  const existingNames = replace
    ? new Set<string>()
    : new Set((await listLeadsFromDb()).map((l) => l.name.toLowerCase()));

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const name = row.name.trim();
    if (!name) {
      skipped.push({
        name: "(blank row)",
        reason: "Missing lead name",
        rowNumber: row.rowNumber,
      });
      continue;
    }
    if (existingNames.has(name.toLowerCase())) {
      skipped.push({
        name,
        reason: "Lead already exists",
        rowNumber: row.rowNumber,
      });
      continue;
    }
    existingNames.add(name.toLowerCase());
    toInsert.push(
      parsedLeadToInsert({
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
    added: inserted.map(leadRowToMock),
    skipped,
    replaced: replace,
  };
}

export async function leadsTableExists(): Promise<boolean> {
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
