import fs from "fs";
import path from "path";

const input = fs.readFileSync(path.join("scripts", "category-input.txt"), "utf8");
const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

function parseLine(line) {
  if (/accounts payable/i.test(line)) return null;
  const idx = line.lastIndexOf("  - ");
  if (idx === -1) return null;
  const name = line.slice(0, idx).trim();
  const accountType = line.slice(idx + 4).trim();
  const isSubAccount = /sub-account/i.test(accountType);
  let parentName;
  if (isSubAccount) {
    const m = accountType.match(/sub-account of\s+(.+?)\.?\.?\.?$/i);
    parentName = m?.[1]?.trim();
  }
  return { name, accountType, isSubAccount, parentName: parentName || undefined };
}

const parsed = [];
const seen = new Set();
for (const line of lines) {
  const row = parseLine(line);
  if (!row) continue;
  const key = row.name.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  parsed.push(row);
}

const out = path.join("src", "lib", "mock-data", "expense-category-seed.json");
fs.writeFileSync(out, JSON.stringify(parsed, null, 2));
console.log(`Wrote ${parsed.length} categories to ${out}`);
