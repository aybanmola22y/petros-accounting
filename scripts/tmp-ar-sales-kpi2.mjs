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

function normalizeInvoiceRef(ref) {
  const trimmed = String(ref || "").trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  return digits || trimmed.toLowerCase();
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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const asOf = sod(new Date(2026, 6, 13));
const from = addDays(asOf, -365);

const sales = [];
let offset = 0;
while (true) {
  const { data, error } = await sb
    .from("sales_transactions")
    .select(
      "id, transaction_date, transaction_type, customer_name, amount, status, reference_number, memo",
    )
    .range(offset, offset + 999);
  if (error) throw new Error(error.message);
  sales.push(...(data ?? []));
  if ((data ?? []).length < 1000) break;
  offset += 1000;
}

const ar = [];
offset = 0;
while (true) {
  const { data, error } = await sb.from("ar_aging_detail_lines").select("*").range(offset, offset + 999);
  if (error) throw new Error(error.message);
  ar.push(...(data ?? []));
  if ((data ?? []).length < 1000) break;
  offset += 1000;
}

const arByRef = new Map();
for (const l of ar) {
  if (String(l.transaction_type || "").toLowerCase() !== "invoice") continue;
  const key = normalizeInvoiceRef(l.reference_number);
  if (!key) continue;
  arByRef.set(key, {
    openBalance: Math.max(0, Number(l.open_balance) || 0),
    bucket: l.bucket,
  });
}

// Payment-adjusted opens
const invRows = sales
  .filter((t) => String(t.transaction_type).toLowerCase() === "invoice")
  .map((t) => {
    const status = String(t.status || "").toLowerCase();
    const voided = status === "void" || String(t.memo || "").toLowerCase().includes("void");
    return {
      id: t.id,
      d: sod(parseDate(t.transaction_date)),
      cust: String(t.customer_name || "").trim().toLowerCase(),
      amt: Math.abs(Number(t.amount) || 0),
      status,
      num: String(t.reference_number || ""),
      voided,
      open: voided || ["paid", "closed"].includes(status) ? 0 : Math.abs(Number(t.amount) || 0),
    };
  });
const pmts = sales
  .filter((t) => String(t.transaction_type).toLowerCase() === "payment")
  .map((t) => ({
    d: sod(parseDate(t.transaction_date)),
    cust: String(t.customer_name || "").trim().toLowerCase(),
    amt: Math.abs(Number(t.amount) || 0),
    status: String(t.status || "").toLowerCase(),
  }));

invRows.sort((a, b) => a.d - b.d || a.id.localeCompare(b.id));
pmts.sort((a, b) => a.d - b.d);
const by = new Map();
for (const x of invRows) {
  if (!x.cust || x.open <= 0) continue;
  if (!by.has(x.cust)) by.set(x.cust, []);
  by.get(x.cust).push(x);
}
for (const p of pmts) {
  if (!["applied", "closed"].includes(p.status)) continue;
  const list = by.get(p.cust) || [];
  let rem = p.amt;
  for (const x of list) {
    if (rem <= 0) break;
    if (x.open <= 0 || p.d < x.d) continue;
    const a = Math.min(x.open, rem);
    x.open -= a;
    rem -= a;
  }
}
const openById = new Map(invRows.map((x) => [x.id, x.open]));

function isPastDuePartial(x) {
  if (x.status !== "partial") return false;
  return addDays(x.d, 14) < asOf;
}

const open = [];
const overdue = [];
for (const x of invRows) {
  if (x.voided) continue;
  if (x.d < from || x.d > asOf) continue;
  const key = normalizeInvoiceRef(x.num);
  const match = key ? arByRef.get(key) : undefined;

  let openAmt;
  let isOd;
  if (match) {
    openAmt = match.openBalance;
    isOd = match.bucket !== "current" && openAmt > 0;
  } else {
    openAmt = openById.get(x.id) || 0;
    isOd =
      openAmt > 0 &&
      (x.status === "overdue" || (x.status === "partial" && isPastDuePartial(x)));
  }

  // kpi overdue amount for partial uses full amt when past due (no AR)
  let odAmt = openAmt;
  if (!match && x.status === "partial" && isPastDuePartial(x)) odAmt = x.amt;
  // kpi open amount for partial uses full amt
  let openKpiAmt = openAmt;
  if (!match && x.status === "partial") openKpiAmt = x.amt;
  if (match && x.status === "partial") openKpiAmt = x.amt; // code does this too when AR matches!

  if (openAmt > 0) {
    open.push({ ...x, openAmt, openKpiAmt, match: !!match, bucket: match?.bucket });
  }
  if (isOd) {
    overdue.push({ ...x, openAmt, odAmt, match: !!match, bucket: match?.bucket });
  }
}

console.log("OPEN count", open.length, "amt(openBal)", open.reduce((s, x) => s + x.openAmt, 0), "amt(kpi)", open.reduce((s, x) => s + x.openKpiAmt, 0));
console.log("OVERDUE count", overdue.length, "amt", overdue.reduce((s, x) => s + x.odAmt, 0));

console.log("\nOpen detail:");
for (const x of open.sort((a, b) => a.d - b.d)) {
  console.log(
    x.d.toISOString().slice(0, 10),
    x.num,
    x.cust.slice(0, 28),
    "bal",
    x.openAmt,
    "kpi",
    x.openKpiAmt,
    x.status,
    x.match ? x.bucket : "sales-only",
  );
}

console.log("\nApp targets overdue 75359/20 open 84258/24");
console.log("QB targets 73565/20");

// Without AR — pure sales
const openSales = invRows.filter((x) => !x.voided && x.d >= from && x.d <= asOf && (openById.get(x.id) || 0) > 0);
const odSales = openSales.filter((x) => x.status === "overdue" || (x.status === "partial" && isPastDuePartial(x)));
console.log("\nNO AR open", openSales.length, openSales.reduce((s, x) => s + (openById.get(x.id) || 0), 0));
console.log("NO AR overdue", odSales.length, odSales.reduce((s, x) => s + (openById.get(x.id) || 0), 0));
