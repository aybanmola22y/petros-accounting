import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { chartOfAccountsTableExists } from "@/lib/chart-of-accounts/repository";

/** Apply chart_of_accounts migration when SUPABASE_DB_URL is configured. */
export async function POST() {
  if (await chartOfAccountsTableExists()) {
    return NextResponse.json({
      ok: true,
      message: "chart_of_accounts table already exists.",
    });
  }

  const dbUrl =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!dbUrl) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Add SUPABASE_DB_URL to .env (Supabase → Settings → Database → Connection string), then retry. Or run the SQL in supabase/migrations/20260323000000_chart_of_accounts.sql in the SQL Editor.",
      },
      { status: 503 },
    );
  }

  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260323000000_chart_of_accounts.sql"),
    "utf8",
  );

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await client.query(sql);
    return NextResponse.json({
      ok: true,
      message: "chart_of_accounts table created successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Migration failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  } finally {
    await client.end();
  }
}
