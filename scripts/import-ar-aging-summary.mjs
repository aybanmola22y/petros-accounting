import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const filePath = process.argv[2] ?? "d:\\Petrosphere Inc._A_R Ageing Summary Report.xlsx";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const SUMMARY_HEADER_ALIASES = {
  current: ["current"],
  days1to30: ["1 - 30", "1-30"],
  days31to60: ["31 - 60", "31-60"],
  days61to90: ["61 - 90", "61-90"],
  days91plus: ["91 and over", "91 or more", "91+"],
};

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/\ufeff/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cellText(value) {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function parseMoney(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cellText(value);
  if (!text || text === "-") return 0;
  const cleaned = text.replace(/[₱$,\s()]/g, "");
  const negative = cleaned.startsWith("-");
  const amountStr = cleaned.replace(/^-+/, "").replace(/^(?:php|usd|eur|gbp|aud|cad)/i, "");
  if (!amountStr) return 0;
  const n = Number.parseFloat(amountStr);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : Math.abs(n);
}

function parseSignedMoney(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cellText(value).trim();
  const negative = text.startsWith("(") && text.endsWith(")");
  const amount = parseMoney(text);
  return negative ? -Math.abs(amount) : amount;
}

function mapHeaders(cells, columnAliases) {
  const normalized = cells.map(normalizeHeader);
  const map = {};
  for (const [key, aliases] of Object.entries(columnAliases)) {
    const index = normalized.findIndex((header) =>
      aliases.some((alias) => normalizeHeader(alias) === header),
    );
    if (index >= 0) map[key] = index;
  }
  return map;
}

function rowLabel(row) {
  return row.map(cellText).filter(Boolean).join(" ").trim();
}

function rowTotal(buckets) {
  return (
    buckets.current +
    buckets.days1to30 +
    buckets.days31to60 +
    buckets.days61to90 +
    buckets.days91plus
  );
}

function readRows(path) {
  const workbook = XLSX.read(readFileSync(path), { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0] ?? "Sheet1";
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("No readable sheet");
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
}

function findSummaryHeaderRowIndex(rows) {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i += 1) {
    const columnMap = mapHeaders(rows[i] ?? [], SUMMARY_HEADER_ALIASES);
    if (
      columnMap.current != null &&
      columnMap.days1to30 != null &&
      columnMap.days31to60 != null &&
      columnMap.days61to90 != null &&
      columnMap.days91plus != null
    ) {
      return i;
    }
  }
  throw new Error("Could not find summary column headers");
}

function parseAsOfDate(rows) {
  const limit = Math.min(rows.length, 12);
  for (let i = 0; i < limit; i += 1) {
    const text = rowLabel(rows[i] ?? []);
    const match =
      text.match(/as of\s+(\d{1,2}\s+[A-Za-z]+\s*,?\s*\d{4})/i) ??
      text.match(/as of\s+(\d{1,2}\/\d{1,2}\/\d{4})/i) ??
      text.match(/as of\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
    if (match?.[1]) {
      const fromQb = new Date(match[1].trim().replace(/,/g, ""));
      if (!Number.isNaN(fromQb.getTime())) return fromQb;
    }
  }
  return new Date();
}

const rows = readRows(filePath);
const asOf = parseAsOfDate(rows);
const headerRowIndex = findSummaryHeaderRowIndex(rows);
const columnMap = mapHeaders(rows[headerRowIndex] ?? [], SUMMARY_HEADER_ALIASES);
const customerRows = [];

for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
  const row = rows[i] ?? [];
  const customer = cellText(row[0]).trim();
  if (!customer) continue;
  if (customer.toLowerCase() === "total") break;

  const buckets = {
    current: parseSignedMoney(row[columnMap.current ?? -1]),
    days1to30: parseSignedMoney(row[columnMap.days1to30 ?? -1]),
    days31to60: parseSignedMoney(row[columnMap.days31to60 ?? -1]),
    days61to90: parseSignedMoney(row[columnMap.days61to90 ?? -1]),
    days91plus: parseSignedMoney(row[columnMap.days91plus ?? -1]),
  };

  if (rowTotal(buckets) === 0) continue;

  customerRows.push({ customer, buckets });
}

customerRows.sort((a, b) => a.customer.localeCompare(b.customer));
const asOfLabel = `${asOf.getMonth() + 1}/${asOf.getDate()}/${asOf.getFullYear()}`;

const appleJoy = customerRows.find((r) => /apple joy/i.test(r.customer));
console.log(`Parsed ${customerRows.length} customers (as of ${asOfLabel})`);
if (appleJoy) {
  console.log(
    `APPLE JOY: 31-60 = ${appleJoy.buckets.days31to60}, total = ${rowTotal(appleJoy.buckets)}`,
  );
}

const supabase = createClient(url, serviceKey);
const { error: deleteError } = await supabase.from("ar_aging_summary_rows").delete().neq("customer_name", "");
if (deleteError) throw new Error(`Delete failed: ${deleteError.message}`);

const dbRows = customerRows.map((row, index) => ({
  customer_name: row.customer.trim(),
  current_amount: row.buckets.current,
  days_1_to_30: row.buckets.days1to30,
  days_31_to_60: row.buckets.days31to60,
  days_61_to_90: row.buckets.days61to90,
  days_91_plus: row.buckets.days91plus,
  as_of: asOfLabel,
  sort_order: index + 1,
}));

const BATCH = 500;
let inserted = 0;
for (let i = 0; i < dbRows.length; i += BATCH) {
  const batch = dbRows.slice(i, i + BATCH);
  const { error } = await supabase.from("ar_aging_summary_rows").insert(batch);
  if (error) throw new Error(`Insert failed: ${error.message}`);
  inserted += batch.length;
}

const { count } = await supabase
  .from("ar_aging_summary_rows")
  .select("*", { count: "exact", head: true });

console.log(`Done. Inserted ${inserted} rows. DB count: ${count}`);
