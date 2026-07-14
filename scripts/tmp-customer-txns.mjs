import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split(/\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function parseDate(v) {
  const s = String(v ?? "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  return null;
}
function sod(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const customers = [
  "Winz Joshua Jamili",
  "Lawrence Angelo Guintu",
  "Ralph Desamero",
  "Ms. Jinky Paja",
  "Mr Frances Lean M. Estrella",
  "Justine Jake Gomez",
];

for (const name of customers) {
  const { data } = await sb
    .from("sales_transactions")
    .select("transaction_date, transaction_type, amount, status, reference_number, customer_name")
    .ilike("customer_name", `%${name.split(" ").slice(-1)[0]}%`)
    .order("transaction_date", { ascending: true });
  const rows = (data || []).filter((r) =>
    String(r.customer_name).toLowerCase().includes(name.toLowerCase().slice(0, 10)),
  );
  console.log("\n===", name);
  for (const r of rows) {
    console.log(
      r.transaction_date,
      r.transaction_type,
      r.reference_number,
      r.amount,
      r.status,
      r.customer_name,
    );
  }
}
