import { readFileSync } from "node:fs";
import { parseChartOfAccountsCsvText } from "../src/lib/import-chart-of-accounts.ts";

const text = readFileSync("d:/chartofaccounts.csv", "utf8");
const result = await parseChartOfAccountsCsvText(text);

const map = new Map();
const conflicts = [];

for (const row of result.rows) {
  const existing = map.get(row.detailType);
  if (existing && existing !== row.accountType) {
    conflicts.push({ detailType: row.detailType, a: existing, b: row.accountType });
  } else {
    map.set(row.detailType, row.accountType);
  }
}

console.log("detail types:", map.size);
console.log("conflicts:", conflicts.length);
if (conflicts.length) console.log(conflicts.slice(0, 10));

for (const [detail, account] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(JSON.stringify(detail) + ": " + JSON.stringify(account));
}
