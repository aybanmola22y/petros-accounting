import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CreateProductServiceInput, MockProductService } from "@/lib/mock-data/products-services";
import {
  createInputToProductServiceInsert,
  parsedProductServiceToInsert,
  productServiceRowToMock,
  type ParsedProductServiceImportPayload,
  type ProductServiceRow,
} from "./types";

const TABLE = "product_services";

export type ImportProductServicesDbResult = {
  added: MockProductService[];
  skipped: Array<{ name: string; reason: string; rowNumber?: number }>;
  replaced: boolean;
};

export async function listProductServicesFromDb(): Promise<MockProductService[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let offset = 0;
  const allRows: ProductServiceRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as ProductServiceRow[];
    allRows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allRows.map(productServiceRowToMock);
}

export async function createProductServiceInDb(
  input: CreateProductServiceInput,
): Promise<MockProductService> {
  const supabase = createSupabaseAdminClient();
  const name = input.name.trim();
  if (!name) throw new Error("Product or service name is required.");

  const { count } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .ilike("name", name);

  if ((count ?? 0) > 0) {
    throw new Error("A product or service with this name already exists.");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(createInputToProductServiceInsert(input))
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return productServiceRowToMock(data as ProductServiceRow);
}

export async function importProductServicesInDb(
  rows: ParsedProductServiceImportPayload[],
  options?: { replace?: boolean },
): Promise<ImportProductServicesDbResult> {
  const supabase = createSupabaseAdminClient();
  const replace = options?.replace ?? false;

  if (replace) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
  }

  const skipped: ImportProductServicesDbResult["skipped"] = [];
  const toInsert: ReturnType<typeof parsedProductServiceToInsert>[] = [];

  const existingNames = replace
    ? new Set<string>()
    : new Set((await listProductServicesFromDb()).map((p) => p.name.toLowerCase()));

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) {
      skipped.push({
        name: "(blank row)",
        reason: "Missing product or service name",
        rowNumber: row.rowNumber,
      });
      continue;
    }
    if (existingNames.has(name.toLowerCase())) {
      skipped.push({
        name,
        reason: "Product or service already exists",
        rowNumber: row.rowNumber,
      });
      continue;
    }
    existingNames.add(name.toLowerCase());
    toInsert.push(
      parsedProductServiceToInsert({
        ...row,
        sortOrder: toInsert.length + 1,
      }),
    );
  }

  if (toInsert.length === 0) {
    return { added: [], skipped, replaced: replace };
  }

  const { data, error } = await supabase.from(TABLE).insert(toInsert).select("*");
  if (error) throw new Error(error.message);

  const added = ((data ?? []) as ProductServiceRow[]).map(productServiceRowToMock);
  return { added, skipped, replaced: replace };
}

export async function updateProductServiceInDb(
  id: string,
  patch: {
    name?: string;
    itemType?: string;
    sku?: string | null;
    category?: string | null;
    className?: string | null;
    salesDescription?: string | null;
    salesPrice?: number | null;
    cost?: number | null;
    qtyOnHand?: number | null;
    reorderPoint?: number | null;
    isActive?: boolean;
  },
): Promise<MockProductService | null> {
  const supabase = createSupabaseAdminClient();

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Product or service name is required.");

    const existing = await listProductServicesFromDb();
    if (
      existing.some(
        (product) => product.id !== id && product.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new Error("A product or service with this name already exists.");
    }
  }

  const update: Record<string, string | number | boolean | null> = {};

  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.itemType !== undefined) update.item_type = patch.itemType;
  if (patch.sku !== undefined) update.sku = patch.sku;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.className !== undefined) update.class_name = patch.className;
  if (patch.salesDescription !== undefined) update.sales_description = patch.salesDescription;
  if (patch.salesPrice !== undefined) update.sales_price = patch.salesPrice;
  if (patch.cost !== undefined) update.cost = patch.cost;
  if (patch.qtyOnHand !== undefined) update.qty_on_hand = patch.qtyOnHand;
  if (patch.reorderPoint !== undefined) update.reorder_point = patch.reorderPoint;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;

  if (Object.keys(update).length === 0) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return productServiceRowToMock(data as ProductServiceRow);
}

export async function productServicesTableExists(): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).select("id").limit(1);
  if (!error) return true;
  if (
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message)
  ) {
    return false;
  }
  throw new Error(error.message);
}
