export type MockProductItemCategory = {
  id: string;
  name: string;
  isCustom: boolean;
};

export const SEED_PRODUCT_ITEM_CATEGORIES = [
  "Assessment",
  "Consultancy",
  "Consultancy & Certification",
  "Fixed Asset Account",
  "HSE Training",
  "Merchandise",
  "Review",
  "Seminar",
  "Training",
] as const;

function seedId(name: string) {
  return `pic-seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 96)}`;
}

export function buildSeedProductItemCategories(): MockProductItemCategory[] {
  const seen = new Set<string>();
  const items: MockProductItemCategory[] = [];
  for (const name of SEED_PRODUCT_ITEM_CATEGORIES) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ id: seedId(name), name, isCustom: false });
  }
  return items;
}
