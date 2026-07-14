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

const asOf = sod(new Date(2026, 6, 13)); // Mon Jul 13 2026
const LOOKBACK = 365;
const TERMS = 14;

function loadFromXls(path) {
  const buf = fs.readFileSync(path);
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
  const nc = h.findIndex((x) => x.includes("num") || x === "no." || x === "no");
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
      rawAmt: +String(r[ac]).replace(/[^0-9.-]/g, "") || 0,
    });
  }
  return txns;
}

async function loadFromDb() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from("sales_transactions")
      .select("transaction_date, transaction_type, customer, amount, status, reference_number")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
    offset += 1000;
  }
  return all.map((r) => ({
    d: sod(parseDate(r.transaction_date)),
    type: String(r.transaction_type || "").trim().toLowerCase(),
    amt: Math.abs(Number(r.amount) || 0),
    status: String(r.status || "").toLowerCase(),
    cust: String(r.customer || ""),
    num: String(r.reference_number || ""),
  }));
}

function computeOpenBalances(txns) {
  const inv = [];
  const pmt = [];
  for (const t of txns) {
    if (t.type === "invoice") {
      inv.push({
        ...t,
        open: ["paid", "closed", "void"].includes(t.status) ? 0 : t.amt,
      });
    } else if (t.type === "payment") {
      pmt.push(t);
    }
  }
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
  return inv;
}

function inLookback(date, days) {
  const from = addDays(asOf, -days);
  return date >= from && date <= asOf;
}

function pastDue(inv) {
  return addDays(inv.d, TERMS) < asOf;
}

function analyze(label, txns) {
  console.log("\n===", label, "n=", txns.length, "asOf", asOf.toDateString());
  const inv = computeOpenBalances(txns);

  // Current app-like overdue: overdue status OR past-due partial with open>0
  const overdueApp = inv.filter((x) => {
    if (!inLookback(x.d, LOOKBACK) || x.open <= 0) return false;
    if (x.status === "overdue") return true;
    return x.status === "partial" && pastDue(x);
  });
  const overdueAppAmt = overdueApp.reduce(
    (s, x) => s + (x.status === "partial" ? x.amt : x.open),
    0,
  );

  // Status overdue only
  const overdueStatus = inv.filter(
    (x) => inLookback(x.d, LOOKBACK) && x.open > 0 && x.status === "overdue",
  );

  // Open: any unpaid with open>0
  const openAll = inv.filter((x) => inLookback(x.d, LOOKBACK) && x.open > 0);
  const openAllAmtPartialFull = openAll.reduce(
    (s, x) => s + (x.status === "partial" ? x.amt : x.open),
    0,
  );
  const openAllAmtOpen = openAll.reduce((s, x) => s + x.open, 0);

  // Open = overdue status only amount (if QB open==overdue)
  console.log("overdue status-only", overdueStatus.reduce((s, x) => s + x.open, 0), overdueStatus.length);
  console.log("overdue app-like", +overdueAppAmt.toFixed(2), overdueApp.length);
  console.log("open open-balance", +openAllAmtOpen.toFixed(2), openAll.length);
  console.log("open partial-full", +openAllAmtPartialFull.toFixed(2), openAll.length);

  // List open invoices by status
  const bySt = {};
  for (const x of openAll) {
    bySt[x.status] = (bySt[x.status] || 0) + 1;
  }
  console.log("open by status", bySt);

  // Show partials and non-overdue open
  for (const x of openAll.filter((x) => x.status !== "overdue")) {
    console.log(
      "non-overdue open",
      x.d.toLocaleDateString(),
      x.num,
      x.cust.slice(0, 25),
      x.status,
      "amt",
      x.amt,
      "open",
      x.open,
      "pastDue",
      pastDue(x),
    );
  }

  // Recently paid scenarios
  const pmts = txns.filter((t) => t.type === "payment" && t.status !== "void");
  const ok = (st) => ["applied", "closed", "unapplied"].includes(st);
  const end = asOf;
  for (const days of [29, 30, 31]) {
    const startIncl = addDays(end, -days);
    const startExcl = addDays(end, -days);
    const incl = pmts.filter((p) => p.d >= startIncl && p.d <= end && ok(p.status));
    const excl = pmts.filter(
      (p) => p.d.getTime() > startExcl.getTime() && p.d.getTime() <= end.getTime() && ok(p.status),
    );
    const allIncl = pmts.filter((p) => p.d >= startIncl && p.d <= end);
    console.log(
      `${days}d incl ok`,
      +incl.reduce((s, p) => s + p.amt, 0).toFixed(2),
      incl.length,
      "| excl>",
      +excl.reduce((s, p) => s + p.amt, 0).toFixed(2),
      excl.length,
      "| all incl",
      +allIncl.reduce((s, p) => s + p.amt, 0).toFixed(2),
      allIncl.length,
    );
  }

  // Current app: 30d amount + carryover 1000 + count 29d exclusive
  const from30 = addDays(end, -30);
  const start29 = addDays(end, -29);
  const amt30 = pmts
    .filter((p) => ok(p.status) && p.d >= from30 && p.d <= end)
    .reduce((s, p) => s + p.amt, 0);
  const carryDay = addDays(from30, -1);
  const carry = pmts
    .filter((p) => ok(p.status) && p.d.getTime() === carryDay.getTime())
    .reduce((s, p) => s + p.amt, 0);
  const cnt29 = pmts.filter(
    (p) =>
      ok(p.status) &&
      p.d.getTime() > start29.getTime() &&
      p.d.getTime() <= end.getTime(),
  ).length;
  console.log(
    "app paid formula",
    +(amt30 + Math.min(carry, 1000)).toFixed(2),
    "cnt",
    cnt29,
    "base",
    amt30,
    "carry",
    carry,
  );
  console.log("QB target overdue/open 73565/20 paid 113329.52/28");
  console.log("App shows overdue 75359/20 open 84258/24 paid 112329.52/29");
}

const xlsPath = "c:/Users/molat/OneDrive/Desktop/QUICKBOOKS/sales.xls";
analyze("xls", loadFromXls(xlsPath));
try {
  analyze("db", await loadFromDb());
} catch (e) {
  console.log("db error", e.message);
}
