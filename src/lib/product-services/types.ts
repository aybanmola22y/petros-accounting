import type {
  BundleComponentLine,
  CreateProductServiceInput,
  MockProductService,
  ProductServiceItemType,
} from "@/lib/mock-data/products-services";
import { productServiceFromCreateInput } from "@/lib/mock-data/products-services";

export type ProductServiceRow = {
  id: string;
  name: string;
  item_type: string | null;
  sku: string | null;
  category: string | null;
  class_name: string | null;
  sales_description: string | null;
  sales_price: number | string | null;
  cost: number | string | null;
  qty_on_hand: number | string | null;
  reorder_point: number | string | null;
  bundle_lines: BundleComponentLine[] | null;
  display_bundle_components: boolean | null;
  is_custom: boolean;
  sort_order: number;
  is_active?: boolean | null;
  created_at: string;
  updated_at: string;
};

export type ProductServiceInsert = {
  name: string;
  item_type?: string | null;
  sku?: string | null;
  category?: string | null;
  class_name?: string | null;
  sales_description?: string | null;
  sales_price?: number | null;
  cost?: number | null;
  qty_on_hand?: number | null;
  reorder_point?: number | null;
  bundle_lines?: BundleComponentLine[] | null;
  display_bundle_components?: boolean | null;
  is_custom?: boolean;
  sort_order?: number;
};

function normalizeItemType(value: string | null | undefined): ProductServiceItemType | undefined {
  const trimmed = value?.trim();
  if (
    trimmed === "inventory" ||
    trimmed === "non-inventory" ||
    trimmed === "service" ||
    trimmed === "bundle"
  ) {
    return trimmed;
  }
  return undefined;
}

export function productServiceRowToMock(row: ProductServiceRow): MockProductService {
  const bundleLines = Array.isArray(row.bundle_lines) ? row.bundle_lines : undefined;
  return {
    id: row.id,
    name: row.name.trim(),
    itemType: normalizeItemType(row.item_type),
    sku: row.sku?.trim() || undefined,
    category: row.category?.trim() || undefined,
    className: row.class_name?.trim() || undefined,
    salesDescription: row.sales_description?.trim() || undefined,
    salesPrice: row.sales_price != null ? Number(row.sales_price) : undefined,
    cost: row.cost != null ? Number(row.cost) : undefined,
    qtyOnHand: row.qty_on_hand != null ? Number(row.qty_on_hand) : undefined,
    reorderPoint: row.reorder_point != null ? Number(row.reorder_point) : undefined,
    bundleLines,
    displayBundleComponents: row.display_bundle_components ?? undefined,
    isCustom: row.is_custom,
    isActive: row.is_active !== false,
  };
}

export function createInputToProductServiceInsert(
  input: CreateProductServiceInput,
  sortOrder?: number,
): ProductServiceInsert {
  const product = productServiceFromCreateInput(input, "temp");
  return {
    name: product.name,
    item_type: product.itemType ?? null,
    sku: product.sku ?? null,
    category: product.category ?? null,
    class_name: product.className ?? null,
    sales_description: product.salesDescription ?? null,
    sales_price: product.salesPrice ?? null,
    cost: product.cost ?? null,
    qty_on_hand: product.qtyOnHand ?? null,
    reorder_point: product.reorderPoint ?? null,
    bundle_lines: product.bundleLines ?? null,
    display_bundle_components: product.displayBundleComponents ?? null,
    is_custom: true,
    sort_order: sortOrder,
  };
}

export type ParsedProductServiceImportPayload = {
  rowNumber: number;
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
  sortOrder?: number;
};

export function parsedProductServiceToInsert(
  row: ParsedProductServiceImportPayload,
): ProductServiceInsert {
  return {
    name: row.name.trim(),
    item_type: row.itemType ?? "service",
    sku: row.sku?.trim() || null,
    category: row.category?.trim() || null,
    class_name: row.className?.trim() || null,
    sales_description: row.salesDescription?.trim() || null,
    sales_price: row.salesPrice ?? null,
    cost: row.cost ?? null,
    qty_on_hand: row.qtyOnHand ?? null,
    reorder_point: row.reorderPoint ?? null,
    bundle_lines: null,
    display_bundle_components: null,
    is_custom: false,
    sort_order: row.sortOrder ?? 0,
  };
}
