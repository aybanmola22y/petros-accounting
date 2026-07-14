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

const all = [];
let offset = 0;
while (true) {
  const { data, error } = await sb
    .from("sales_transactions")
    .select(
      "transaction_date, transaction_type, customer_name, amount, status, reference_number",
    )
    .range(offset, offset + 999);
  if (error) throw new Error(error.message);
  all.push(...(data ?? []));
  if ((data ?? []).length < 1000) break;
  offset += 1000;
}

function parseDate(v) {
  const s = String(v ?? "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  return null;
}
function sod(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const asOf = sod(new Date(2026, 6, 13));
const from = addDays(asOf, -365);

const inv = all
  .filter((t) => String(t.transaction_type).toLowerCase() === "invoice")
  .map((t) => ({
    d: sod(parseDate(t.transaction_date)),
    type: "invoice",
    amt: Math.abs(Number(t.amount) || 0),
    status: String(t.status || "").toLowerCase(),
    cust: String(t.customer_name || ""),
    num: String(t.reference_number || ""),
    open: ["paid", "closed", "void"].includes(String(t.status || "").toLowerCase())
      ? 0
      : Math.abs(Number(t.amount) || 0),
  }));
const pmt = all
  .filter((t) => String(t.transaction_type).toLowerCase() === "payment")
  .map((t) => ({
    d: sod(parseDate(t.transaction_date)),
    amt: Math.abs(Number(t.amount) || 0),
    status: String(t.status || "").toLowerCase(),
    cust: String(t.customer_name || ""),
  }));

inv.sort((a, b) => a.d - b.d);
pmt.sort((a, b) => a.d - b.d);
const by = new Map();
for (const x of inv) {
  const k = x.cust.toLowerCase();
  if (!by.has(k)) by.set(k, []);
  by.get(k).push(x);
}
for (const p of pmt) {
  if (!["applied", "closed"].includes(p.status)) continue;
  const list = by.get(p.cust.toLowerCase()) || [];
  let rem = p.amt;
  for (const x of list) {
    if (rem <= 0) break;
    if (x.open <= 0 || p.d < x.d) continue;
    const a = Math.min(x.open, rem);
    x.open -= a;
    rem -= a;
  }
}

const overdue = inv.filter(
  (x) => x.d >= from && x.d <= asOf && x.open > 0 && x.status === "overdue",
);
console.log("overdue detail:");
for (const x of overdue) {
  console.log(
    x.d.toISOString().slice(0, 10),
    JSON.stringify(x.num),
    x.cust.slice(0, 30),
    "open",
    x.open,
    "amt",
    x.amt,
  );
}
console.log("sum", overdue.reduce((s, x) => s + x.open, 0), "n", overdue.length);

// Customer name mismatch: payments under slightly different names won't apply
// Check Jemuel / Frances name variants
const names = new Set();
for (const t of all) {
  const n = String(t.customer_name || "");
  if (/jemuel|frances|winz|lawrence|ralph|bonbon/i.test(n)) names.add(n);
}
console.log("name variants", [...names]);

// Re-run allocation with normalized names?
function norm(n) {
  return n
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/^mr\s+|^ms\s+|^mrs\s+/i, "")
    .trim();
}

const inv2 = all
  .filter((t) => String(t.transaction_type).toLowerCase() === "invoice")
  .map((t) => ({
    d: sod(parseDate(t.transaction_date)),
    amt: Math.abs(Number(t.amount) || 0),
    status: String(t.status || "").toLowerCase(),
    cust: String(t.customer_name || ""),
    ncust: norm(String(t.customer_name || "")),
    open: ["paid", "closed", "void"].includes(String(t.status || "").toLowerCase())
      ? 0
      : Math.abs(Number(t.amount) || 0),
  }));
const pmt2 = all
  .filter((t) => String(t.transaction_type).toLowerCase() === "payment")
  .map((t) => ({
    d: sod(parseDate(t.transaction_date)),
    amt: Math.abs(Number(t.amount) || 0),
    status: String(t.status || "").toLowerCase(),
    ncust: norm(String(t.customer_name || "")),
  }));
inv2.sort((a, b) => a.d - b.d);
pmt2.sort((a, b) => a.d - b.d);
const by2 = new Map();
for (const x of inv2) {
  if (!by2.has(x.ncust)) by2.set(x.ncust, []);
  by2.get(x.ncust).push(x);
}
for (const p of pmt2) {
  if (!["applied", "closed"].includes(p.status)) continue;
  const list = by2.get(p.ncust) || [];
  let rem = p.amt;
  for (const x of list) {
    if (rem <= 0) break;
    if (x.open <= 0 || p.d < x.d) continue;
    const a = Math.min(x.open, rem);
    x.open -= a;
    rem -= a;
  }
}
const od2 = inv2.filter(
  (x) => x.d >= from && x.d <= asOf && x.open > 0 && x.status === "overdue",
);
console.log(
  "normalized names overdue",
  od2.reduce((s, x) => s + x.open, 0),
  od2.length,
);

// Ignore payments after asOf
const inv3 = all
  .filter((t) => String(t.transaction_type).toLowerCase() === "invoice")
  .map((t) => ({
    d: sod(parseDate(t.transaction_date)),
    amt: Math.abs(Number(t.amount) || 0),
    status: String(t.status || "").toLowerCase(),
    cust: String(t.customer_name || ""),
    open: ["paid", "closed", "void"].includes(String(t.status || "").toLowerCase())
      ? 0
      : Math.abs(Number(t.amount) || 0),
  }));
inv3.sort((a, b) => a.d - b.d);
const by3 = new Map();
for (const x of inv3) {
  const k = x.cust.toLowerCase();
  if (!by3.has(k)) by3.set(k, []);
  by3.get(k).push(x);
}
for (const p of pmt) {
  if (!["applied", "closed"].includes(p.status)) continue;
  if (p.d > asOf) continue;
  const list = by3.get(p.cust.toLowerCase()) || [];
  let rem = p.amt;
  for (const x of list) {
    if (rem <= 0) break;
    if (x.open <= 0 || p.d < x.d) continue;
    const a = Math.min(x.open, rem);
    x.open -= a;
    rem -= a;
  }
}
const od3 = inv3.filter(
  (x) => x.d >= from && x.d <= asOf && x.open > 0 && x.status === "overdue",
);
console.log(
  "no future pmt overdue",
  od3.reduce((s, x) => s + x.open, 0),
  od3.length,
);

// What total is 73565? Try excluding Frances payment application (future) AND something else
// 75565 without future - 2000 = 73565 if we also remove Frances invoice entirely? count 19
// 75565 - 1000 = 74565... 
// 74565 with future applied. QB 73565.

// Maybe QB doesn't count invoices with $0 due from their internal open balance
// and one of our open=1000 is actually 0 in QB? count would drop.

// Try: open amount uses max(0, amt - payments) but payments matched by fuzzy name
console.log(
  "diff to QB",
  od2.reduce((s, x) => s + x.open, 0) - 73565,
  od3.reduce((s, x) => s + x.open, 0) - 73565,
);
