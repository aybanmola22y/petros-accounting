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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const arAll = [];
let offset = 0;
while (true) {
  const { data, error } = await sb
    .from("ar_aging_detail_lines")
    .select("*")
    .range(offset, offset + 999);
  if (error) throw new Error(error.message);
  arAll.push(...(data ?? []));
  if ((data ?? []).length < 1000) break;
  offset += 1000;
}

const asOf = sod(new Date(2026, 6, 13));
const from = addDays(asOf, -365);

// AR lines in last 365 days with open > 0, non-current
const arRecent = arAll.filter((l) => {
  const d = parseDate(l.transaction_date || l.due_date);
  if (!d) return false;
  const day = sod(d);
  if (day < from || day > asOf) return false;
  return Number(l.open_balance) > 0;
});
console.log("ar recent open lines", arRecent.length);
const arInv = arRecent.filter((l) =>
  String(l.transaction_type || "").toLowerCase().includes("invoice"),
);
const arOverdue = arInv.filter((l) => String(l.bucket) !== "current");
console.log(
  "ar inv open 365d",
  arInv.length,
  arInv.reduce((s, l) => s + Number(l.open_balance), 0),
);
console.log(
  "ar inv overdue buckets 365d",
  arOverdue.length,
  arOverdue.reduce((s, l) => s + Number(l.open_balance), 0),
);

// Show ar overdue in lookback
for (const l of arOverdue.sort(
  (a, b) => parseDate(a.transaction_date) - parseDate(b.transaction_date),
)) {
  console.log(
    l.transaction_date,
    l.reference_number,
    String(l.customer_name).slice(0, 28),
    l.open_balance,
    l.bucket,
  );
}

// Also: AR open for last 365 regardless of bucket (matches open KPI?)
console.log(
  "\nall ar open 365",
  arInv.reduce((s, l) => s + Number(l.open_balance), 0),
  arInv.length,
);

// Check if 73565 appears with due-date lookback instead of txn date
const arByDue = arAll.filter((l) => {
  if (!String(l.transaction_type || "").toLowerCase().includes("invoice")) return false;
  if (Number(l.open_balance) <= 0) return false;
  const d = parseDate(l.due_date || l.transaction_date);
  if (!d) return false;
  const day = sod(d);
  return day >= from && day <= asOf;
});
console.log(
  "ar by due date 365",
  arByDue.length,
  arByDue.reduce((s, l) => s + Number(l.open_balance), 0),
);

// Simulate app with AR aging overlay on sales invoices in lookback
const buf = fs.readFileSync("c:/Users/molat/OneDrive/Desktop/QUICKBOOKS/sales.xls");
const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
  header: 1,
  defval: "",
  blankrows: false,
});
let hi = 0;
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

const salesInv = [];
for (let i = hi + 1; i < rows.length; i++) {
  const r = rows[i] || [];
  const d = parseDate(r[dc]);
  if (String(r[tc] || "").toLowerCase() !== "invoice" || !d) continue;
  const status = String(r[sc] || "").toLowerCase();
  if (["paid", "closed", "void"].includes(status)) continue;
  const day = sod(d);
  if (day < from || day > asOf) continue;
  salesInv.push({
    d: day,
    num: String(r[nc] || "").replace(/^0+/, ""),
    cust: String(r[cc] || ""),
    amt: Math.abs(+String(r[ac]).replace(/[^0-9.-]/g, "") || 0),
    status,
  });
}

const arByRef = new Map();
for (const l of arAll) {
  if (!String(l.transaction_type || "").toLowerCase().includes("invoice")) continue;
  const key = String(l.reference_number || "").replace(/^0+/, "");
  if (!key) continue;
  arByRef.set(key, l);
}

let openSum = 0,
  openCnt = 0,
  odSum = 0,
  odCnt = 0;
for (const inv of salesInv) {
  const ar = arByRef.get(inv.num);
  const open = ar ? Number(ar.open_balance) : inv.amt;
  const bucket = ar?.bucket || (inv.status === "overdue" ? "days1to30" : "current");
  if (open <= 0) continue;
  openSum += open;
  openCnt++;
  if (bucket !== "current") {
    odSum += open;
    odCnt++;
  }
}
console.log("\nsales+AR overlay open", openSum, openCnt, "overdue", odSum, odCnt);

// App numbers 75359 / 84258 - search combination
console.log("app overdue target 75359 open 84258");
