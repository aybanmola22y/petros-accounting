import { readFileSync } from "node:fs";
import { parseExpensesSpreadsheet } from "../src/lib/import-expenses.ts";

const buffer = readFileSync("d:/Expenses.xls");
const file = new File([buffer], "Expenses.xls", {
  type: "application/vnd.ms-excel",
});

const result = await parseExpensesSpreadsheet(file);
console.log("parsed:", result.rows.length);
console.log("skipped:", result.skippedRows.length);
console.log("first:", result.rows[0]);
console.log("types:", [...new Set(result.rows.map((r) => r.transactionType))]);
