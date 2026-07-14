import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import fs from "fs";
import XLSX from "xlsx";

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

// Pull recent overdue-looking invoices from DB
const { data } = await sb
  .from("sales_transactions")
  .select("transaction_date, transaction_type, customer_name, amount, status, reference_number")
  .eq("transaction_type", "Invoice")
  .eq("status", "Overdue")
  .gte("transaction_date", "2025-07-01")
  .order("transaction_date", { ascending: true });

console.log("DB overdue invoices since 2025-07:");
let sumAmt = 0;
for (const r of data || []) {
  sumAmt += Math.abs(Number(r.amount) || 0);
  console.log(
    r.transaction_date,
    r.reference_number,
    String(r.customer_name).slice(0, 28),
    r.amount,
    r.status,
  );
}
console.log("count", data?.length, "sum full amounts", sumAmt);

// Also statuses distribution for invoices with date in lookback
const { data: invs } = await sb
  .from("sales_transactions")
  .select("status, amount, transaction_date, customer_name")
  .eq("transaction_type", "Invoice")
  .gte("transaction_date", "2025-07-13")
  .lte("transaction_date", "2026-07-13");

const st = {};
for (const r of invs || []) {
  const s = r.status || "(null)";
  st[s] = (st[s] || 0) + 1;
}
console.log("invoice statuses in lookback", st);

// Check how status is stored - Overdue vs overdue
const { data: samplePay } = await sb
  .from("sales_transactions")
  .select("status, transaction_type, amount, transaction_date, customer_name")
  .eq("transaction_type", "Payment")
  .gte("transaction_date", "2026-06-01")
  .order("transaction_date", { ascending: false })
  .limit(15);
console.log("sample payments", samplePay);

// Reproduce app numbers: maybe they use FULL invoice amount for overdue status without payment allocation?
const overdueFull = (data || []).reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
console.log("overdue full amt sum", overdueFull);

// Partial invoices in lookback
const { data: partials } = await sb
  .from("sales_transactions")
  .select("*")
  .eq("transaction_type", "Invoice")
  .ilike("status", "%partial%")
  .gte("transaction_date", "2025-07-13");
console.log(
  "partials",
  partials?.map((p) => ({
    d: p.transaction_date,
    c: p.customer_name,
    a: p.amount,
    s: p.status,
  })),
);
