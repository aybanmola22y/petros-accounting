// Re-link general_ledger_rows.account_id to chart_of_accounts by re-running the
// same matcher used at import time. Read-only unless run with `--apply`.
//
//   node scripts/relink-gl-accounts.mjs          (dry run / report only)
//   node scripts/relink-gl-accounts.mjs --apply  (write account_id updates)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("MISSING url or service role key in .env");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- replicate src/lib/general-ledger/account-matching.ts ----
function normalize(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
function stripDeleted(value) {
  return value.replace(/\s*\(deleted\)\s*$/i, "").trim();
}
function buildMatcher(chartAccounts) {
  const byCandidate = new Map();
  for (const account of chartAccounts) {
    const name = normalize(account.name);
    const number = normalize(account.number);
    const withNumber = number ? normalize(`${account.number} ${account.name}`) : "";
    if (name && !byCandidate.has(name)) byCandidate.set(name, account.id);
    if (withNumber && !byCandidate.has(withNumber)) byCandidate.set(withNumber, account.id);
    const nameNoDeleted = normalize(stripDeleted(account.name));
    if (nameNoDeleted && !byCandidate.has(nameNoDeleted)) byCandidate.set(nameNoDeleted, account.id);
  }
  return (label) => {
    const normalizedLabel = normalize(label);
    if (byCandidate.has(normalizedLabel)) return byCandidate.get(normalizedLabel);
    const noDeleted = normalize(stripDeleted(label));
    if (byCandidate.has(noDeleted)) return byCandidate.get(noDeleted);
    const nameOnly = normalize(noDeleted.replace(/^[\d][\d\s-]*\d\s+/, ""));
    if (nameOnly && byCandidate.has(nameOnly)) return byCandidate.get(nameOnly);
    return null;
  };
}

const PAGE = 1000;

const { data: coaRaw, error: coaErr } = await supabase
  .from("chart_of_accounts")
  .select("id,account_name,account_number");
if (coaErr) {
  console.error("coa error", coaErr.message);
  process.exit(1);
}
const chartAccounts = (coaRaw ?? []).map((a) => ({
  id: a.id,
  name: a.account_name ?? "",
  number: (a.account_number ?? "").trim(),
}));
const accountById = new Map(chartAccounts.map((a) => [a.id, a]));
const matcher = buildMatcher(chartAccounts);

// Pull distinct labels with their current account_id + counts
async function fetchAllLabels() {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("general_ledger_rows")
      .select("account_label,account_id")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

console.log("Loading general_ledger_rows...");
const allRows = await fetchAllLabels();
console.log("Total GL rows:", allRows.length);

const labelStats = new Map(); // label -> { count, currentIds:Set }
for (const r of allRows) {
  const s = labelStats.get(r.account_label) ?? { count: 0, currentIds: new Set() };
  s.count += 1;
  s.currentIds.add(r.account_id);
  labelStats.set(r.account_label, s);
}

let willLink = 0; // rows that gain or change a non-null account_id
let alreadyOk = 0;
let stillUnmatched = 0;
const unmatchedLabels = [];
const linkPlan = []; // { label, targetId, count }

for (const [label, s] of labelStats) {
  const target = matcher(label);
  if (!target) {
    stillUnmatched += s.count;
    unmatchedLabels.push({ label, count: s.count });
    continue;
  }
  // Need update if any row's current account_id != target
  const needsUpdate = ![...s.currentIds].every((id) => id === target);
  if (needsUpdate) {
    willLink += s.count;
    linkPlan.push({ label, targetId: target, count: s.count });
  } else {
    alreadyOk += s.count;
  }
}

console.log("\n--- MATCH SUMMARY ---");
console.log("Rows already linked correctly:", alreadyOk);
console.log("Rows that will be (re)linked:", willLink);
console.log("Rows still unmatched (no chart account):", stillUnmatched);

console.log("\n--- LABELS THAT WILL BE LINKED ---");
for (const p of linkPlan.sort((a, b) => b.count - a.count)) {
  const acct = accountById.get(p.targetId);
  console.log(`   ${p.count}\t"${p.label}"  ->  ${acct?.number} ${acct?.name}`);
}

if (unmatchedLabels.length > 0) {
  console.log("\n--- UNMATCHED LABELS (left as null) ---");
  for (const u of unmatchedLabels.sort((a, b) => b.count - a.count)) {
    console.log(`   ${u.count}\t"${u.label}"`);
  }
}

if (!APPLY) {
  console.log("\nDry run only. Re-run with --apply to write these account_id updates.");
  process.exit(0);
}

console.log("\nApplying updates...");
let updated = 0;
for (const p of linkPlan) {
  // Set account_id for every row with this label. Idempotent: rows already on
  // the target id are unchanged. We cannot use .neq() to skip them because the
  // current value is NULL and `NULL <> value` is never true in SQL, which would
  // exclude exactly the rows we need to fix.
  const { error, count } = await supabase
    .from("general_ledger_rows")
    .update({ account_id: p.targetId }, { count: "exact" })
    .eq("account_label", p.label);
  if (error) throw new Error(`update failed for "${p.label}": ${error.message}`);
  updated += count ?? 0;
  console.log(`   linked ${count ?? 0} rows for "${p.label}"`);
}
console.log(`\nDone. Updated ${updated} rows.`);
