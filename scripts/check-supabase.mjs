import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env", "utf8").split("\n")) {
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
  process.env[key] = value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("MISSING: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

const { error: authError } = await supabase.auth.getSession();
console.log("configured:", true);
console.log("project_url:", url);
console.log("auth_check:", authError ? `FAIL (${authError.message})` : "OK");

const { error: tableError } = await supabase.from("chart_of_accounts").select("id").limit(1);

if (!tableError) {
  console.log("connected:", true);
  console.log("tables_ready:", true);
  console.log("message: Connected. chart_of_accounts table exists.");
} else if (
  tableError.code === "PGRST205" ||
  /does not exist|schema cache/i.test(tableError.message)
) {
  console.log("connected:", true);
  console.log("tables_ready:", false);
  console.log("message: Connected. chart_of_accounts table not created yet.");
} else {
  console.log("connected:", false);
  console.log("error:", tableError.message);
  console.log("code:", tableError.code ?? "none");
  process.exit(1);
}
