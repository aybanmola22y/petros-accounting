import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const buffer = readFileSync("d:/Expenses.xls");
const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Expenses, {
  header: 1,
  defval: "",
  blankrows: false,
});

const headers = rows[0];
const data = rows.slice(1);

const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

const typeCounts = {};
const categoryCounts = new Map();
let negativeTotal = 0;
let emptyCategory = 0;
let salesReturnRows = [];

for (const row of data) {
  const type = String(row[idx.Type] ?? "");
  typeCounts[type] = (typeCounts[type] ?? 0) + 1;

  const category = String(row[idx.Category] ?? "").trim();
  if (!category) emptyCategory += 1;
  else categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);

  const total = Number(row[idx.Total]);
  if (total < 0) negativeTotal += 1;

  if (/sales return/i.test(category) || /sales return/i.test(String(row[idx.Payee]))) {
    salesReturnRows.push(row);
  }
}

console.log("Row count:", data.length);
console.log("Type counts:", typeCounts);
console.log("Rows with empty category:", emptyCategory);
console.log("Rows with negative total:", negativeTotal);
console.log("Unique categories:", categoryCounts.size);
console.log("Top 15 categories:", [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15));
console.log("Sales Return related rows:", salesReturnRows.length);
for (const row of salesReturnRows.slice(0, 5)) {
  console.log({
    date: row[idx.Date],
    type: row[idx.Type],
    no: row[idx["No."]],
    payee: row[idx.Payee],
    category: row[idx.Category],
    total: row[idx.Total],
  });
}

// Sample each type
for (const type of Object.keys(typeCounts)) {
  const sample = data.find((r) => r[idx.Type] === type);
  console.log(`\nSample ${type}:`, {
    date: sample[idx.Date],
    no: sample[idx["No."]],
    payee: sample[idx.Payee],
    category: sample[idx.Category],
    totalBeforeTax: sample[idx["Total before sales tax"]],
    salesTax: sample[idx["Sales tax"]],
    total: sample[idx.Total],
  });
}

// Date range
const dates = data.map((r) => String(r[idx.Date])).filter(Boolean);
console.log("\nDate samples (first/last):", dates[0], dates[dates.length - 1]);
