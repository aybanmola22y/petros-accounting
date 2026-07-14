import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TABLE = "recurring_templates";
const MIGRATION_FILE = "20260344000000_recurring_template_details.sql";

function getDatabaseUrl(): string | undefined {
  return (
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL
  );
}

export async function recurringTemplateDetailsColumnExists(): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).select("details").limit(1);
  if (!error) return true;
  if (
    error.code === "PGRST204" ||
    /details.*schema cache|could not find.*details/i.test(error.message)
  ) {
    return false;
  }
  throw new Error(error.message);
}

export async function applyRecurringDetailsMigration(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (await recurringTemplateDetailsColumnExists()) {
    return { ok: true, message: "recurring_templates.details column already exists." };
  }

  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    return {
      ok: false,
      message:
        "Add SUPABASE_DB_URL to .env (Supabase → Settings → Database → Connection string → URI), then retry. Or run the SQL in supabase/migrations/20260344000000_recurring_template_details.sql in the Supabase SQL Editor.",
    };
  }

  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", MIGRATION_FILE),
    "utf8",
  );

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await client.query(sql);
    await client.query("NOTIFY pgrst, 'reload schema';");
    return { ok: true, message: "recurring_templates.details column created." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Migration failed.",
    };
  } finally {
    await client.end();
  }
}

/** Ensure the details column exists before saving line-item snapshots. */
export async function ensureRecurringDetailsColumn(): Promise<void> {
  if (await recurringTemplateDetailsColumnExists()) return;

  const result = await applyRecurringDetailsMigration();
  if (!result.ok) {
    throw new Error(result.message);
  }

  // PostgREST may need a moment to refresh its schema cache after ALTER TABLE.
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await recurringTemplateDetailsColumnExists()) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(
    "The details column was created but Supabase has not refreshed yet. Wait a few seconds and try again.",
  );
}
