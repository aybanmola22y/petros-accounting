import { parseChartOfAccountsCsvText } from "../src/lib/import-chart-of-accounts.ts";

function simulateRunReportRow(name, typeValue, detailValue, balance) {
  const headers = ["Full name", "Type", "Detail type", "Total balance", "Currency"];
  const row = ["", typeValue, detailValue, balance, "PHP"];
  row[0] = name;
  const text = [headers.join(","), row.map((v) => `"${v}"`).join(",")].join("\n");
  return parseChartOfAccountsCsvText(text);
}

const salesReturn = await simulateRunReportRow("Sales Return", "Bank", "Current", "PHP7950.00");
console.log("Sales Return:", salesReturn.rows[0]);

const inventory = await simulateRunReportRow(
  "Inventory Asset",
  "Inventory",
  "Current assets",
  "-PHP22250.00",
);
console.log("Inventory Asset:", inventory.rows[0]);

const sales = await simulateRunReportRow(
  "Sales",
  "Sales of Product Income",
  "Income",
  "PHP100000.00",
);
console.log("Sales:", sales.rows[0]);
