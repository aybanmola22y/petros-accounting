import fs from "fs";
import XLSX from "xlsx";

function parseDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  const s = String(v ?? "").trim();
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
  });
}

const target = 113329.52;
const end = asOf;

// search windows/filters that hit target amount and ~28 count
const variants = [];
for (let days = 28; days <= 40; days++) {
  for (const mode of ["incl", "excl"]) {
    for (const statuses of [
      ["applied", "closed", "unapplied"],
      ["applied", "closed"],
      ["all"],
    ]) {
      const start = addDays(end, -days);
      const rowsP = txns.filter((t) => {
        if (t.type !== "payment" || t.status === "void") return false;
        if (statuses[0] !== "all" && !statuses.includes(t.status)) return false;
        if (mode === "incl") return t.d >= start && t.d <= end;
        return t.d.getTime() > start.getTime() && t.d.getTime() <= end.getTime();
      });
      const amt = +rowsP.reduce((s, p) => s + p.amt, 0).toFixed(2);
      if (Math.abs(amt - target) < 0.01 || rowsP.length === 28) {
        variants.push({
          days,
          mode,
          statuses: statuses.join("/"),
          amt,
          count: rowsP.length,
          matchAmt: Math.abs(amt - target) < 0.01,
        });
      }
    }
  }
}
console.log("matches/near:", variants.filter((v) => v.matchAmt || v.count === 28));

// amount = 30d all ok + carryover from ANY payment on days that aged out in last N days, capped 1000 total
const from30 = addDays(end, -30);
const base = txns
  .filter(
    (t) =>
      t.type === "payment" &&
      t.status !== "void" &&
      ["applied", "closed", "unapplied"].includes(t.status) &&
      t.d >= from30 &&
      t.d <= end,
  )
  .reduce((s, p) => s + p.amt, 0);

for (const lookback of [1, 2, 3, 4, 5, 6, 7, 10, 15]) {
  const agedStart = addDays(from30, -lookback);
  const aged = txns.filter(
    (t) =>
      t.type === "payment" &&
      ["applied", "closed", "unapplied"].includes(t.status) &&
      t.d >= agedStart &&
      t.d < from30,
  );
  const carry = Math.min(
    aged.reduce((s, p) => s + p.amt, 0),
    1000,
  );
  const total = base + carry;
  if (Math.abs(total - target) < 0.01 || lookback <= 5) {
    console.log(
      "aged",
      lookback,
      "agedSum",
      aged.reduce((s, p) => s + p.amt, 0),
      "carry",
      carry,
      "total",
      total,
      aged.map((p) => `${p.d.toLocaleDateString()}:${p.amt}`),
    );
  }
}

// Check AR aging in store / local files
import { existsSync as ex, readdirSync } from "fs";
console.log("\nAR files?");
