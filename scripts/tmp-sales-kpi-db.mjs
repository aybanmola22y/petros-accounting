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
      "transaction_date, transaction_type, customer_name, amount, status, reference_number, memo",
    )
    .range(offset, offset + 999);
  if (error) throw new Error(error.message);
  all.push(...(data ?? []));
  if ((data ?? []).length < 1000) break;
  offset += 1000;
}

const txns = all.map((r) => ({
  d: sod(parseDate(r.transaction_date)),
  type: String(r.transaction_type || "").trim().toLowerCase(),
  amt: Math.abs(Number(r.amount) || 0),
  status: String(r.status || "").toLowerCase(),
  cust: String(r.customer_name || ""),
  num: String(r.reference_number || ""),
  memo: String(r.memo || "").toLowerCase(),
  voided:
    String(r.status || "").toLowerCase() === "void" ||
    String(r.memo || "").toLowerCase().includes("void"),
}));

const asOf = sod(new Date(2026, 6, 13));
const active = txns.filter((t) => !t.voided);
console.log("db txns", txns.length, "active", active.length);

const inv = active
  .filter((t) => t.type === "invoice")
  .map((t) => ({
    ...t,
    open: ["paid", "closed", "void"].includes(t.status) ? 0 : t.amt,
  }));
const pmt = active.filter((t) => t.type === "payment");
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

const from365 = addDays(asOf, -365);
function pastDue(x) {
  return addDays(x.d, 14) < asOf;
}

const openAll = inv.filter((x) => x.d >= from365 && x.d <= asOf && x.open > 0);
const overdue = openAll.filter(
  (x) => x.status === "overdue" || (x.status === "partial" && pastDue(x)),
);

const overdueAmt = overdue.reduce(
  (s, x) => s + (x.status === "partial" && pastDue(x) ? x.amt : x.open),
  0,
);
const openAmtPartialFull = openAll.reduce(
  (s, x) => s + (x.status === "partial" ? x.amt : x.open),
  0,
);
const openAmt = openAll.reduce((s, x) => s + x.open, 0);

console.log("openAll", openAll.length, "openAmt", openAmt, "partialFull", openAmtPartialFull);
console.log("overdue", overdue.length, "overdueAmt", overdueAmt);

const bySt = {};
for (const x of openAll) bySt[x.status] = (bySt[x.status] || 0) + 1;
console.log("open by status", bySt);

for (const x of openAll.filter((x) => x.status !== "overdue")) {
  console.log(
    "extra",
    x.d.toLocaleDateString(),
    x.num,
    x.cust.slice(0, 30),
    x.status,
    "open",
    x.open,
    "amt",
    x.amt,
  );
}

console.log("\nApp shows overdue 75359/20 open 84258/24");
console.log("QB shows 73565/20 both");

// credits
const credits = active.filter(
  (t) =>
    t.type.includes("credit") &&
    t.d >= from365 &&
    t.d <= asOf &&
    !["paid", "closed", "void"].includes(t.status),
);
console.log(
  "open credits",
  credits.length,
  credits.reduce((s, t) => s + t.amt, 0),
  credits.slice(0, 5),
);

// paid
const from30 = addDays(asOf, -30);
const start29 = addDays(asOf, -29);
const ok = (st) => ["applied", "closed", "unapplied"].includes(st);
const paidAmt = pmt.filter((p) => ok(p.status) && p.d >= from30 && p.d <= asOf);
const paidCnt = pmt.filter(
  (p) =>
    ok(p.status) &&
    p.d.getTime() > start29.getTime() &&
    p.d.getTime() <= asOf.getTime(),
);
const carryDay = addDays(from30, -1);
const carry = pmt
  .filter((p) => ok(p.status) && p.d.getTime() === carryDay.getTime())
  .reduce((s, p) => s + p.amt, 0);
console.log(
  "paid amt30",
  paidAmt.reduce((s, p) => s + p.amt, 0),
  paidAmt.length,
  "cnt29",
  paidCnt.length,
  "carry",
  carry,
  "withCarry",
  paidAmt.reduce((s, p) => s + p.amt, 0) + Math.min(carry, 1000),
);

// Compare: if overdue uses open only (no partial full amt)
const overdueOpenOnly = openAll.filter((x) => x.status === "overdue");
console.log(
  "overdue open-only",
  overdueOpenOnly.reduce((s, x) => s + x.open, 0),
  overdueOpenOnly.length,
);

// Exclude future payments from allocation (payments after asOf)
const inv2 = active
  .filter((t) => t.type === "invoice")
  .map((t) => ({
    ...t,
    open: ["paid", "closed", "void"].includes(t.status) ? 0 : t.amt,
  }));
inv2.sort((a, b) => a.d - b.d);
const by2 = new Map();
for (const x of inv2) {
  const k = x.cust.toLowerCase();
  if (!by2.has(k)) by2.set(k, []);
  by2.get(k).push(x);
}
for (const p of pmt) {
  if (!["applied", "closed"].includes(p.status)) continue;
  if (p.d > asOf) continue; // ignore future payments
  const list = by2.get(p.cust.toLowerCase()) || [];
  let rem = p.amt;
  for (const x of list) {
    if (rem <= 0) break;
    if (x.open <= 0 || p.d < x.d) continue;
    const a = Math.min(x.open, rem);
    x.open -= a;
    rem -= a;
  }
}
const open2 = inv2.filter((x) => x.d >= from365 && x.d <= asOf && x.open > 0);
const od2 = open2.filter((x) => x.status === "overdue");
console.log(
  "no-future-pmt overdue",
  od2.reduce((s, x) => s + x.open, 0),
  od2.length,
  "open",
  open2.reduce((s, x) => s + x.open, 0),
  open2.length,
);
for (const x of open2) {
  if (x.cust.includes("Frances") || x.open !== od2.find((o) => o.num === x.num)?.open) {
    // skip
  }
}
const frances = open2.filter((x) => x.cust.includes("Frances"));
console.log("Frances without future pmt", frances);
