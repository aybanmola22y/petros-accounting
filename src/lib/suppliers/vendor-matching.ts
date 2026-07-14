/** Normalize vendor / supplier names for fuzzy QuickBooks-style matching. */
export function normalizeVendorName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\ufeff/g, "")
    .replace(/[''"]/g, "")
    .replace(/[.,]/g, " ")
    .replace(
      /\b(incorporated|inc|corp|corporation|co|company|ltd|limited|ph|philippines)\b\.?/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSupplierVendorKeys(
  suppliers: ReadonlyArray<{ name: string; companyName?: string }>,
  extraVendorNames: Iterable<string> = [],
): Set<string> {
  const keys = new Set<string>();
  const add = (name?: string) => {
    const normalized = normalizeVendorName(name ?? "");
    if (normalized) keys.add(normalized);
  };

  for (const supplier of suppliers) {
    add(supplier.name);
    add(supplier.companyName);
  }
  for (const name of extraVendorNames) add(name);

  return keys;
}

/** True when payee matches a supplier name (exact, normalized, or truncated QBO export). */
export function vendorNameMatches(keys: Set<string>, payee: string): boolean {
  const key = normalizeVendorName(payee);
  if (!key) return false;
  if (keys.has(key)) return true;

  for (const supplierKey of keys) {
    if (key === supplierKey) return true;
    if (key.length < 4 || supplierKey.length < 4) continue;
    if (key.includes(supplierKey) || supplierKey.includes(key)) return true;
  }

  return false;
}
