import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const filePath = process.argv[2] ?? "d:/Expenses.xls";
const buffer = readFileSync(filePath);
const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

console.log("File:", filePath);
console.log("Sheets:", workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) continue;

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  console.log(`\n=== Sheet: ${sheetName} ===`);
  console.log("Total rows:", rows.length);

  // Find likely header row in first 25 rows
  let headerRowIndex = 0;
  let bestScore = 0;
  const keywords = [
    "date",
    "payee",
    "amount",
    "total",
    "type",
    "account",
    "category",
    "memo",
    "ref",
    "payment",
    "method",
  ];

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const normalized = (rows[i] ?? []).map((cell) =>
      String(cell ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim(),
    );
    let score = 0;
    for (const kw of keywords) {
      if (normalized.some((h) => h.includes(kw))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = i;
    }
  }

  console.log("Likely header row index (0-based):", headerRowIndex);
  console.log("Header row number (1-based):", headerRowIndex + 1);
  console.log("Headers:", rows[headerRowIndex]);

  const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.some((c) => String(c).trim()));
  console.log("Data rows below header:", dataRows.length);

  console.log("\nFirst 5 data rows:");
  for (const row of dataRows.slice(0, 5)) {
    console.log(row);
  }

  console.log("\nLast 3 data rows:");
  for (const row of dataRows.slice(-3)) {
    console.log(row);
  }

  // Column stats
  const headers = (rows[headerRowIndex] ?? []).map((h) => String(h ?? "").trim());
  console.log("\nColumn count:", headers.length);
  for (let col = 0; col < headers.length; col++) {
    const label = headers[col] || `(col ${col})`;
    const samples = dataRows
      .slice(0, 200)
      .map((row) => row[col])
      .filter((v) => v !== "" && v != null)
      .slice(0, 3);
    const nonEmpty = dataRows.filter((row) => String(row[col] ?? "").trim()).length;
    console.log(`- ${label}: ${nonEmpty}/${dataRows.length} filled | samples: ${JSON.stringify(samples)}`);
  }

  // Transaction types if present
  const typeCol = headers.findIndex((h) => /^type$/i.test(h) || /transaction type/i.test(h));
  if (typeCol >= 0) {
    const types = new Set(dataRows.map((r) => String(r[typeCol] ?? "").trim()).filter(Boolean));
    console.log("\nDistinct Type values:", [...types].sort());
  }
}
