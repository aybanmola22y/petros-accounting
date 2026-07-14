import type { MockProductService } from "@/lib/mock-data/products-services";

export type ProductServiceStatusFilter = "Active" | "Inactive" | "All";
export type ProductServiceTypeFilter =
  | "All"
  | "Service"
  | "Inventory"
  | "Non-inventory"
  | "Bundle";
export type ProductServiceStockStatusFilter =
  | "All"
  | "Low stock"
  | "Out of stock"
  | "In stock";

export type ProductServiceListFilters = {
  status: ProductServiceStatusFilter;
  type: ProductServiceTypeFilter;
  category: string;
  stockStatus: ProductServiceStockStatusFilter;
};

export const DEFAULT_PRODUCT_SERVICE_LIST_FILTERS: ProductServiceListFilters = {
  status: "Active",
  type: "All",
  category: "All",
  stockStatus: "All",
};

export const PRODUCT_SERVICE_TYPE_FILTER_OPTIONS: ProductServiceTypeFilter[] = [
  "All",
  "Service",
  "Inventory",
  "Non-inventory",
  "Bundle",
];

export const PRODUCT_SERVICE_STOCK_STATUS_FILTER_OPTIONS: ProductServiceStockStatusFilter[] =
  ["All", "Low stock", "Out of stock", "In stock"];

export function isProductServiceActive(product: MockProductService): boolean {
  return product.isActive !== false;
}

function matchesTypeFilter(
  product: MockProductService,
  type: ProductServiceTypeFilter,
): boolean {
  if (type === "All") return true;
  const itemType = product.itemType ?? "service";
  switch (type) {
    case "Service":
      return itemType === "service";
    case "Inventory":
      return itemType === "inventory";
    case "Non-inventory":
      return itemType === "non-inventory";
    case "Bundle":
      return itemType === "bundle";
    default:
      return true;
  }
}

function matchesStockStatusFilter(
  product: MockProductService,
  stockStatus: ProductServiceStockStatusFilter,
): boolean {
  if (stockStatus === "All") return true;
  if (product.itemType !== "inventory") return false;

  const qty = product.qtyOnHand ?? 0;
  if (stockStatus === "Out of stock") return qty <= 0;
  if (stockStatus === "Low stock") {
    return qty > 0 && product.reorderPoint !== undefined && qty <= product.reorderPoint;
  }
  if (stockStatus === "In stock") {
    if (qty <= 0) return false;
    if (product.reorderPoint === undefined) return true;
    return qty > product.reorderPoint;
  }
  return true;
}

export function productServiceMatchesListFilters(
  product: MockProductService,
  filters: ProductServiceListFilters,
): boolean {
  if (filters.status === "Active" && !isProductServiceActive(product)) return false;
  if (filters.status === "Inactive" && isProductServiceActive(product)) return false;
  if (!matchesTypeFilter(product, filters.type)) return false;

  if (filters.category !== "All") {
    const category = product.category?.trim() || "Uncategorized";
    if (category !== filters.category) return false;
  }

  if (!matchesStockStatusFilter(product, filters.stockStatus)) return false;
  return true;
}

export function productServiceListFiltersAreDefault(
  filters: ProductServiceListFilters,
): boolean {
  return (
    filters.status === DEFAULT_PRODUCT_SERVICE_LIST_FILTERS.status &&
    filters.type === DEFAULT_PRODUCT_SERVICE_LIST_FILTERS.type &&
    filters.category === DEFAULT_PRODUCT_SERVICE_LIST_FILTERS.category &&
    filters.stockStatus === DEFAULT_PRODUCT_SERVICE_LIST_FILTERS.stockStatus
  );
}

export function collectProductServiceCategories(
  products: MockProductService[],
): string[] {
  const categories = new Set<string>();
  for (const product of products) {
    categories.add(product.category?.trim() || "Uncategorized");
  }
  return [...categories].sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });
}
