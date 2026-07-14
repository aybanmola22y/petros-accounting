import { readFileSync } from "node:fs";
import { parseChartOfAccountsCsvText } from "../src/lib/import-chart-of-accounts.ts";

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell);
  return cells;
}

const csvPath = process.argv[2] ?? "d:/chartofaccounts.csv";
const text = readFileSync(csvPath, "utf8");
const lines = text.trim().split(/\r?\n/);
const result = await parseChartOfAccountsCsvText(text);

const sourceRows = lines
  .slice(1)
  .filter((line) => line.trim())
  .map(parseCsvLine);

const mismatches = [];

for (let i = 0; i < result.rows.length; i += 1) {
  const src = sourceRows[i];
  const parsed = result.rows[i];

  if (!src) {
    mismatches.push({ row: i + 2, field: "(row)", src: "(missing)", parsed: parsed.name });
    continue;
  }

  const [number, name, accountType, detailType] = src;

  if ((number ?? "") !== parsed.number) {
    mismatches.push({ row: i + 2, field: "Account number", src: number, parsed: parsed.number });
  }
  if (name !== parsed.name) {
    mismatches.push({ row: i + 2, field: "Account name", src: name, parsed: parsed.name });
  }
  if (accountType !== parsed.accountType) {
    mismatches.push({
      row: i + 2,
      field: "Account type",
      src: accountType,
      parsed: parsed.accountType,
    });
  }
  if (detailType !== parsed.detailType) {
    mismatches.push({
      row: i + 2,
      field: "Detail type",
      src: detailType,
      parsed: parsed.detailType,
    });
  }
}

console.log("CSV path:", csvPath);
console.log("Source rows:", sourceRows.length);
console.log("Parsed rows:", result.rows.length);
console.log("Skipped rows:", result.skippedRows.length);
console.log("Field mismatches:", mismatches.length);

if (mismatches.length > 0) {
  console.log("First mismatches:", mismatches.slice(0, 10));
  process.exit(1);
}

console.log("OK: every QuickBooks row matches field-for-field.");
