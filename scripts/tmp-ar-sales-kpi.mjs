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
  return String(ref || "")
    .trim()
    .replace(/^0+/, "")
    .toLowerCase();
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

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

const asOf = sod(new Date(2026, 6, 13));
const from = addDays(asOf, -365);

const sales = [];
let offset = 0;
while (true) {
  const { data, error } = await sb
    .from("sales_transactions")
    .select(
      "transaction_date, transaction_type, customer_name, amount, status, reference_number",
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
  const { data, error } = await sb
    .from("ar_aging_detail_lines")
    .select("*")
    .range(offset, offset + 999);
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

const invs = sales.filter((t) => String(t.transaction_type).toLowerCase() === "invoice");
const open = [];
const overdue = [];
for (const t of invs) {
  const d = parseDate(t.transaction_date);
  if (!d) continue;
  const day = sod(d);
  if (day < from || day > asOf) continue;
  const status = String(t.status || "").toLowerCase();
  if (status === "void") continue;

  const key = normalizeInvoiceRef(t.reference_number);
  const match = key ? arByRef.get(key) : undefined;
  let openAmt;
  let isOverdue;
  if (match) {
    openAmt = match.openBalance;
    isOverdue = match.bucket !== "current" && openAmt > 0;
  } else {
    // fallback without payment allocation for speed: unpaid status uses full amount
    if (["paid", "closed"].includes(status)) openAmt = 0;
    else openAmt = Math.abs(Number(t.amount) || 0);
    isOverdue = status === "overdue" && openAmt > 0;
  }
  if (openAmt > 0) {
    open.push({
      num: t.reference_number,
      cust: t.customer_name,
      openAmt,
      status,
      matched: !!match,
      bucket: match?.bucket,
      d: day,
    });
    if (isOverdue || (match && match.bucket !== "current")) {
      overdue.push(open[open.length - 1]);
    }
  }
}

console.log(
  "with AR overlay open",
  open.reduce((s, x) => s + x.openAmt, 0),
  open.length,
);
console.log(
  "with AR overlay overdue",
  overdue.reduce((s, x) => s + x.openAmt, 0),
  overdue.length,
);
console.log(
  "matched",
  open.filter((x) => x.matched).length,
  "unmatched",
  open.filter((x) => !x.matched).length,
);

console.log("\nOpen rows:");
for (const x of open.sort((a, b) => a.d - b.d)) {
  console.log(
    x.d.toISOString().slice(0, 10),
    x.num,
    String(x.cust).slice(0, 28),
    x.openAmt,
    x.status,
    x.matched ? x.bucket : "no-ar",
  );
}

console.log("\nApp: overdue 75359/20 open 84258/24");
console.log("QB: 73565/20 both");
