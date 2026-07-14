import fs from "fs";
import XLSX from "xlsx";
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

function parseDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
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
let hi = -1;
for (let i = 0; i < 15; i++) {
  const c = (rows[i] || []).map((x) => String(x).toLowerCase());
  if (c.includes("date") && c.some((x) => x.includes("type"))) {
    hi = i;
    break;
  }
}
const h = (rows[hi] || []).map((c) => String(c).toLowerCase().trim());
const dc = h.findIndex((x) => x.includes("date"));
const tc = h.findIndex((x) => x === "type" || x.includes("transaction"));
const ac = h.findIndex((x) => x === "amount" || x === "total");
const sc = h.findIndex((x) => x === "status");
const cc = h.findIndex((x) => x.includes("customer") || x === "name");
const nc = h.findIndex((x) => x.includes("num") || x === "no");

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

// payments last 35 days
const pmts = txns
  .filter((t) => t.type === "payment" && t.status !== "void")
  .filter((t) => t.d >= addDays(asOf, -35) && t.d <= asOf)
  .sort((a, b) => a.d - b.d);

console.log("Payments in last 35d:");
for (const p of pmts) {
  console.log(p.d.toLocaleDateString(), p.status, p.cust.slice(0, 30), p.amt);
}

const end = asOf;
const start29 = addDays(end, -29);
const from30 = addDays(end, -30);
const ok = (st) => ["applied", "closed", "unapplied"].includes(st);

const inCount = pmts.filter(
  (p) => ok(p.status) && p.d.getTime() > start29.getTime() && p.d.getTime() <= end.getTime(),
);
const inAmt = pmts.filter((p) => ok(p.status) && p.d >= from30 && p.d <= end);
const appliedOnly = pmts.filter(
  (p) =>
    (p.status === "applied" || p.status === "closed") &&
    p.d.getTime() > start29.getTime() &&
    p.d.getTime() <= end.getTime(),
);
const unapplied = pmts.filter((p) => p.status === "unapplied" && p.d >= from30 && p.d <= end);

console.log("\ncount window (29d excl) all ok", inCount.length, inCount.reduce((s,p)=>s+p.amt,0));
console.log("count applied/closed only", appliedOnly.length, appliedOnly.reduce((s,p)=>s+p.amt,0));
console.log("amount 30d ok", inAmt.length, inAmt.reduce((s,p)=>s+p.amt,0));
console.log("unapplied in 30d", unapplied);

// What if amount = all payments 30d (incl void? no) + one extra 1000?
console.log("target amount 113329.52, current", inAmt.reduce((s,p)=>s+p.amt,0), "need", 113329.52 - inAmt.reduce((s,p)=>s+p.amt,0));

// overdue invoices list with amounts
const inv = txns.filter((t) => t.type === "invoice");
const pmt = txns.filter((t) => t.type === "payment");
const openInv = inv.map((t) => ({
  ...t,
  open: ["paid", "closed", "void"].includes(t.status) ? 0 : t.amt,
}));
openInv.sort((a, b) => a.d - b.d);
pmt.sort((a, b) => a.d - b.d);
const by = new Map();
for (const x of openInv) {
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

const from365 = addDays(asOf, -365);
const overdue = openInv.filter(
  (x) => x.d >= from365 && x.d <= asOf && x.open > 0 && x.status === "overdue",
);
console.log("\nOverdue invoices (open balance):");
let sum = 0;
for (const x of overdue.sort((a,b)=>a.d-b.d)) {
  sum += x.open;
  console.log(x.d.toLocaleDateString(), x.num, x.cust.slice(0, 28), "open", x.open, "amt", x.amt, x.status);
}
console.log("sum open", sum);
console.log("sum full amt", overdue.reduce((s,x)=>s+x.amt,0));

// If we remove invoices with open 1000?
const without1k = overdue.filter((x) => x.open !== 1000);
console.log("without open=1000", without1k.reduce((s,x)=>s+x.open,0), without1k.length);

// try asOf Jul 12, Jul 11, Jul 10
for (const day of [10, 11, 12, 13]) {
  const a = sod(new Date(2026, 6, day));
  const from = addDays(a, -365);
  const od = openInv.filter(
    (x) => x.d >= from && x.d <= a && x.open > 0 && x.status === "overdue",
  );
  // recompute open for asOf? open balances don't depend on asOf for payment application
  console.log(
    "asOf",
    a.toDateString(),
    "overdue",
    od.reduce((s, x) => s + x.open, 0),
    od.length,
  );
}

// DB columns
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from("sales_transactions").select("*").limit(1);
console.log("\ndb sample keys", data?.[0] ? Object.keys(data[0]) : error?.message);
const { count } = await sb.from("sales_transactions").select("*", { count: "exact", head: true });
console.log("db count", count);
