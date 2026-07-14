import { readFileSync } from "node:fs";
import { parseChartOfAccountsCsvText } from "../src/lib/import-chart-of-accounts.ts";

const text = readFileSync("d:/chartofaccounts.csv", "utf8");
const result = await parseChartOfAccountsCsvText(text);

console.log("parsed:", result.rows.length);
console.log("skipped:", result.skippedRows.length);
console.log("header row:", result.headerRowNumber);

const sample = result.rows.find((r) => r.name.includes("Property"));
console.log("quoted sample:", sample);

const withNumber = result.rows.filter((r) => r.number);
console.log("with account number:", withNumber.length, withNumber.map((r) => r.name));

const types = new Set(result.rows.map((r) => r.accountType));
console.log("account types:", types.size, [...types].sort());

const first = result.rows[0];
console.log("first row:", first);

if (result.skippedRows.length) {
  console.log("skipped sample:", result.skippedRows.slice(0, 5));
}
