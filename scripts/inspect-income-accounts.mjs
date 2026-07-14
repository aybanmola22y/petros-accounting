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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: accounts } = await sb
  .from("chart_of_accounts")
  .select("account_name,account_type,detail_type,ledger_balance,sort_order")
  .ilike("account_type", "%Income%")
  .order("sort_order");

console.log("INCOME ACCOUNTS:");
for (const a of accounts ?? []) {
  console.log(`  ${a.account_name} | ${a.detail_type} | balance=${a.ledger_balance}`);
}

const { data: sales } = await sb.from("sales_transactions").select("transaction_type,amount,status");

const byType = new Map();
for (const row of sales ?? []) {
  const key = row.transaction_type;
  byType.set(key, (byType.get(key) ?? 0) + Number(row.amount));
}
console.log("\nSALES BY TYPE:");
for (const [type, total] of [...byType.entries()].sort()) {
  console.log(`  ${type}: ${total.toFixed(2)}`);
}
