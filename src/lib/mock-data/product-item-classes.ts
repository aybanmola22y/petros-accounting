export type MockProductItemClass = {
  id: string;
  name: string;
  isCustom: boolean;
};

export const SEED_PRODUCT_ITEM_CLASSES = [
  "Elearning/Online",
  "Iloilo City",
  "In-House Training",
  "Public Offering",
  "Roxas City",
  "Tax",
] as const;

function seedId(name: string) {
  return `picl-seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 96)}`;
}

export function buildSeedProductItemClasses(): MockProductItemClass[] {
  const seen = new Set<string>();
  const items: MockProductItemClass[] = [];
  for (const name of SEED_PRODUCT_ITEM_CLASSES) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ id: seedId(name), name, isCustom: false });
  }
  return items;
}
