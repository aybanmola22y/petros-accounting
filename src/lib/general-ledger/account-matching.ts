import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function stripDeleted(value: string): string {
  return value.replace(/\s*\(deleted\)\s*$/i, "").trim();
}

/**
 * Resolve a QuickBooks General Ledger account-group label to a chart-of-accounts id.
 * GL labels look like "3483 0576 19 Cash on Bank (BPI)" or just "Cash on hand".
 */
export function buildGeneralLedgerAccountMatcher(
  chartAccounts: MockChartAccount[],
): (label: string) => string | null {
  const byCandidate = new Map<string, string>();

  for (const account of chartAccounts) {
    const name = normalize(account.name);
    const number = normalize(account.number);
    const withNumber = number ? normalize(`${account.number} ${account.name}`) : "";

    if (name && !byCandidate.has(name)) byCandidate.set(name, account.id);
    if (withNumber && !byCandidate.has(withNumber)) byCandidate.set(withNumber, account.id);
    const nameNoDeleted = normalize(stripDeleted(account.name));
    if (nameNoDeleted && !byCandidate.has(nameNoDeleted)) byCandidate.set(nameNoDeleted, account.id);
  }

  return (label: string): string | null => {
    const normalizedLabel = normalize(label);
    if (byCandidate.has(normalizedLabel)) return byCandidate.get(normalizedLabel)!;

    const noDeleted = normalize(stripDeleted(label));
    if (byCandidate.has(noDeleted)) return byCandidate.get(noDeleted)!;

    // Try stripping a leading account-number token, then match by name.
    const nameOnly = normalize(noDeleted.replace(/^[\d][\d\s-]*\d\s+/, ""));
    if (nameOnly && byCandidate.has(nameOnly)) return byCandidate.get(nameOnly)!;

    return null;
  };
}
