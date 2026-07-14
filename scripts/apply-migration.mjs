import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  try {
    const envPath = join(__dirname, "..", ".env");
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env optional for CI
  }
}

loadEnvFile();

const dbUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!dbUrl) {
  console.error(
    "Missing database URL. Add SUPABASE_DB_URL to .env (Supabase → Settings → Database → Connection string → URI).",
  );
  process.exit(1);
}

const migrationArg = process.argv[2] || "20260323000000_chart_of_accounts.sql";
const migrationFile = migrationArg.endsWith(".sql") ? migrationArg : `${migrationArg}.sql`;
const migrationPath = join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  migrationFile,
);
const sql = readFileSync(migrationPath, "utf8");

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log(`Migration applied: ${migrationFile}`);
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end();
}
