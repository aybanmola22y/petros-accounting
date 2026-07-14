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

const { count, error } = await sb
  .from("ar_aging_detail_lines")
  .select("*", { count: "exact", head: true });
console.log("ar aging count", count, error?.message);

const { data: sample } = await sb.from("ar_aging_detail_lines").select("*").limit(3);
console.log("sample", sample);

const { data: overdueLines } = await sb
  .from("ar_aging_detail_lines")
  .select("*")
  .neq("bucket", "current")
  .gt("open_balance", 0);

if (overdueLines) {
  const inv = overdueLines.filter((l) =>
    String(l.transaction_type || "").toLowerCase().includes("invoice"),
  );
  console.log(
    "ar overdue invoices",
    inv.length,
    inv.reduce((s, l) => s + Math.abs(Number(l.open_balance) || 0), 0),
  );
}

// Compare each overdue invoice open: sales allocation vs if we use amount - ignore same-day payments?
function parseDate(v) {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const s = String(v ?? "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let y = +m[3];
  if (y < 100) y += 2000;
  return new Date(y, +m[1] - 1, +m[2]);
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
const buf = fs.readFileSync("c:/Users/molat/OneDrive/Desktop/QUICKBOOKS/sales.xls");
const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
  header: 1,
  defval: "",
  blankrows: false,
});
let hi = 1;
const h = (rows[hi] || []).map((c) => String(c).toLowerCase().trim());
// find header
for (let i = 0; i < 15; i++) {
  const c = (rows[i] || []).map((x) => String(x).toLowerCase());
  if (c.includes("date") && c.some((x) => x.includes("type"))) {
    hi = i;
    break;
  }
}
const hdr = (rows[hi] || []).map((c) => String(c).toLowerCase().trim());
const dc = hdr.findIndex((x) => x.includes("date"));
const tc = hdr.findIndex((x) => x === "type" || x.includes("transaction"));
const ac = hdr.findIndex((x) => x === "amount" || x === "total");
const sc = hdr.findIndex((x) => x === "status");
const cc = hdr.findIndex((x) => x.includes("customer") || x === "name");
const nc = hdr.findIndex((x) => x.includes("num") || x === "no");

const txns = [];
for (let i = hi + 1; i < rows.length; i++) {
  const r = rows[i] || [];
  const d = parseDate(r[dc]);
  const type = String(r[tc] || "").trim();
  if (!d || !type) continue;
  txns.push({
    d: sod(d),
    type: type.toLowerCase(),
    amt: Math.abs(+String(r[ac]).replace(/[^0-9.-]/g, "") || 0),
    status: String(r[sc] || "").toLowerCase(),
    cust: String(r[cc] || ""),
    num: String(r[nc] || ""),
  });
}

// Try: open balance = invoice amount for overdue status (ignore payments) — too high
// Try: exclude invoices where open after allocation is from same-day partial only differently

// Use STATUS amount field somehow - maybe QB uses a Balance column we don't have

// Hypothesis: Winz Jamili - payment and invoice same day. FIFO applies payment. 
// What if QB sales KPI uses the Amount shown for overdue which for partially paid shows remaining due from status text?

// List overdue with open, find which single -1000 gets 73565
const inv = txns
  .filter((t) => t.type === "invoice")
  .map((t) => ({
    ...t,
    open: ["paid", "closed", "void"].includes(t.status) ? 0 : t.amt,
  }));
const pmt = txns.filter((t) => t.type === "payment");
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
const from = addDays(asOf, -365);
const overdue = inv.filter(
  (x) => x.d >= from && x.d <= asOf && x.open > 0 && x.status === "overdue",
);
const base = overdue.reduce((s, x) => s + x.open, 0);
console.log("base", base);
for (const x of overdue) {
  const adj = base - x.open;
  // if we zero this invoice
  if (Math.abs(adj - 73565) < 0.01) console.log("ZERO to match", x.cust, x.open);
  // if we reduce by 1000
  if (x.open >= 1000 && Math.abs(base - 1000 - 73565) < 0.01) {
    console.log("candidate -1000 from", x.num, x.cust.slice(0, 30), "open", x.open);
  }
}
console.log("base-1000", base - 1000);

// Maybe exclude Churchill or someone?
// Or: don't apply unapplied? already don't

// Same-day payments: don't apply payment if payment date === invoice date?
const inv3 = txns
  .filter((t) => t.type === "invoice")
  .map((t) => ({
    ...t,
    open: ["paid", "closed", "void"].includes(t.status) ? 0 : t.amt,
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
  const list = by3.get(p.cust.toLowerCase()) || [];
  let rem = p.amt;
  for (const x of list) {
    if (rem <= 0) break;
    if (x.open <= 0 || p.d < x.d) continue;
    if (p.d.getTime() === x.d.getTime()) continue; // skip same-day
    const a = Math.min(x.open, rem);
    x.open -= a;
    rem -= a;
  }
}
const od3 = inv3.filter(
  (x) => x.d >= from && x.d <= asOf && x.open > 0 && x.status === "overdue",
);
console.log(
  "no same-day pmt apply",
  od3.reduce((s, x) => s + x.open, 0),
  od3.length,
);

// Apply same-day but only to reduce, and for KPI use min(open, something)?
// Check invoice open balances from AR if any match 73565
