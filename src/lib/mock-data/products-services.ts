export type ProductServiceItemType =
  | "inventory"
  | "non-inventory"
  | "service"
  | "bundle";

export type BundleComponentLine = {
  productServiceId: string;
  productServiceName: string;
  qty: number;
};

export type MockProductService = {
  id: string;
  name: string;
  itemType?: ProductServiceItemType;
  sku?: string;
  category?: string;
  className?: string;
  salesDescription?: string;
  salesPrice?: number;
  cost?: number;
  qtyOnHand?: number;
  reorderPoint?: number;
  bundleLines?: BundleComponentLine[];
  displayBundleComponents?: boolean;
  isCustom: boolean;
  /** When false, item is hidden from the default Active filter. */
  isActive?: boolean;
};

export type CreateProductServiceInput = {
  name: string;
  itemType: ProductServiceItemType;
  sku?: string;
  category?: string;
  className?: string;
  initialQty?: number;
  asOfDate?: string;
  reorderPoint?: number;
  inventoryAssetAccount?: string;
  salesDescription?: string;
  salesPrice?: number;
  incomeAccount?: string;
  salesTaxInclusive?: boolean;
  purchaseDescription?: string;
  cost?: number;
  expenseAccount?: string;
  purchaseTaxInclusive?: boolean;
  preferredSupplier?: string;
  bundleLines?: BundleComponentLine[];
  displayBundleComponents?: boolean;
};

export const SEED_PRODUCT_SERVICE_NAMES = [
  "Equipment Purchase",
  "Sales of Asset",
  "Fixed Asset Account",
  "Occupational First Aid",
  "HSE Training",
  "Loss Cosh Id fee",
  "Meal allowance",
  "OTHER Expense",
  "Occupational First Aid Training SFAT",
  "Office Expense",
  "Refund",
  "Training Expense",
  "Training Supplies",
  "Training food expense",
  "IADC RigPass",
  "IADC HSE Rigpass Training",
  "Training",
  "IADC RigPass - Regular",
  "Identification Card",
  "Loss Cosh Id",
  "PECB ISO 27001 LEAD IMPLPEMENTER",
  "PECB ISO 27001 Lead Implementer",
  "Referral / Marketing Fee",
  "Utilities",
  "Utility",
  "fare expense",
] as const;

const QBO_STYLE_SEEDS: Omit<MockProductService, "id" | "isCustom">[] = [
  {
    name: "1st Surveillance Audit (10.5 hrs)",
    itemType: "service",
    category: "Assessment",
    salesPrice: 26_250,
  },
  {
    name: "Adjustment",
    itemType: "service",
    category: "Assessment",
    salesDescription: "Adjustment done to ta...",
  },
  {
    name: "ISO Application Fee",
    itemType: "service",
    category: "Assessment",
    salesPrice: 5_000,
  },
  {
    name: "ISO 9001 Gap Analysis",
    itemType: "service",
    category: "Consultancy",
    salesPrice: 18_500,
    salesDescription: "On-site gap analysis and report",
  },
  {
    name: "Basic Occupational Safety and Health (BOSH)",
    itemType: "service",
    category: "Training",
    salesPrice: 3_500,
    salesDescription: "BOSH for Safety Officer 2",
  },
  {
    name: "Consulting services",
    itemType: "service",
    category: "Consultancy",
    salesPrice: 1_000,
  },
  {
    name: "Training Supplies Kit",
    itemType: "inventory",
    category: "Merchandise",
    sku: "TSK-001",
    salesPrice: 2_450,
    cost: 1_200,
    qtyOnHand: 0,
    reorderPoint: 5,
  },
  {
    name: "Safety Manual (printed)",
    itemType: "inventory",
    category: "Merchandise",
    sku: "SM-100",
    salesPrice: 850,
    cost: 400,
    qtyOnHand: 0,
    reorderPoint: 10,
  },
  {
    name: "Freight delivery",
    itemType: "non-inventory",
    category: "Review",
    salesPrice: 1_500,
  },
  {
    name: "Monthly retainer",
    itemType: "service",
    category: "Consultancy & Certification",
    salesPrice: 15_000,
  },
];

function seedId(name: string) {
  return `ps-seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 96)}`;
}

export function formatProductItemType(itemType?: ProductServiceItemType): string {
  switch (itemType) {
    case "inventory":
      return "Inventory";
    case "non-inventory":
      return "Non-inventory";
    case "service":
      return "Service";
    case "bundle":
      return "Bundle";
    default:
      return "Service";
  }
}

export function computeProductStockSummary(products: MockProductService[]) {
  let lowStock = 0;
  let outOfStock = 0;
  for (const product of products) {
    if (product.itemType !== "inventory") continue;
    const qty = product.qtyOnHand ?? 0;
    if (qty <= 0) outOfStock += 1;
    else if (product.reorderPoint !== undefined && qty <= product.reorderPoint) {
      lowStock += 1;
    }
  }
  return { lowStock, outOfStock };
}

export function groupProductsByCategory(
  products: MockProductService[],
): { category: string; items: MockProductService[] }[] {
  const map = new Map<string, MockProductService[]>();
  for (const product of products) {
    const category = product.category?.trim() || "Uncategorized";
    const list = map.get(category) ?? [];
    list.push(product);
    map.set(category, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    })
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export function productServiceFromCreateInput(
  input: CreateProductServiceInput,
  id: string,
): MockProductService {
  const bundleLines =
    input.itemType === "bundle" ? input.bundleLines : undefined;

  return {
    id,
    name: input.name.trim(),
    itemType: input.itemType,
    sku: input.sku?.trim() || undefined,
    category: input.category?.trim() || undefined,
    className: input.className?.trim() || undefined,
    salesDescription: input.salesDescription?.trim() || undefined,
    salesPrice: input.salesPrice,
    cost: input.cost,
    qtyOnHand: input.itemType === "inventory" ? input.initialQty : undefined,
    reorderPoint: input.reorderPoint,
    bundleLines: bundleLines?.map(({ productServiceId, productServiceName, qty }) => ({
      productServiceId,
      productServiceName,
      qty,
    })),
    displayBundleComponents: input.displayBundleComponents,
    isCustom: true,
    isActive: true,
  };
}

export function buildSeedProductServices(): MockProductService[] {
  const seen = new Set<string>();
  const items: MockProductService[] = [];

  for (const seed of QBO_STYLE_SEEDS) {
    const key = seed.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      ...seed,
      id: seedId(seed.name),
      isCustom: false,
    });
  }

  for (const name of SEED_PRODUCT_SERVICE_NAMES) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: seedId(name),
      name,
      itemType: "service",
      isCustom: false,
    });
  }

  return items;
}
