import type { CreateProductServiceInput, MockProductService } from "@/lib/mock-data/products-services";
import type { InventoryFormState } from "@/components/inventory-product-form-sheet";
import type { SellableFormState } from "@/components/sellable-product-form-dialog";
import { defaultInventoryForm } from "@/components/inventory-product-form-sheet";
import { defaultSellableForm } from "@/components/sellable-product-form-dialog";

export function productToSellableForm(product: MockProductService): SellableFormState {
  const form = defaultSellableForm();
  const hasSales = product.salesPrice != null || Boolean(product.salesDescription?.trim());
  const hasPurchase = product.cost != null;

  return {
    ...form,
    name: product.name,
    sku: product.sku ?? "",
    category: product.category ?? "",
    className: product.className ?? "",
    sellToCustomer: hasSales || product.itemType === "service",
    salesDescription: product.salesDescription ?? "",
    salesPrice: product.salesPrice != null ? String(product.salesPrice) : "",
    cost: product.cost != null ? String(product.cost) : "",
    showPurchasing: hasPurchase,
    purchaseFromSupplier: hasPurchase,
  };
}

export function productToInventoryForm(product: MockProductService): InventoryFormState {
  const form = defaultInventoryForm();
  const hasPurchase = product.cost != null;

  return {
    ...form,
    name: product.name,
    sku: product.sku ?? "",
    category: product.category ?? "",
    className: product.className ?? "",
    initialQty: product.qtyOnHand != null ? String(product.qtyOnHand) : "",
    asOfDate: new Date().toISOString().slice(0, 10),
    reorderPoint: product.reorderPoint != null ? String(product.reorderPoint) : "",
    salesDescription: product.salesDescription ?? "",
    salesPrice: product.salesPrice != null ? String(product.salesPrice) : "",
    cost: product.cost != null ? String(product.cost) : "",
    showPurchasing: hasPurchase,
    purchaseDescription: "",
    purchaseFromSupplier: hasPurchase,
  };
}

export function createInputToUpdatePatch(input: CreateProductServiceInput): {
  name: string;
  itemType: string;
  sku: string | null;
  category: string | null;
  className: string | null;
  salesDescription: string | null;
  salesPrice: number | null;
  cost: number | null;
  qtyOnHand?: number | null;
  reorderPoint?: number | null;
} {
  const patch = {
    name: input.name.trim(),
    itemType: input.itemType,
    sku: input.sku?.trim() || null,
    category: input.category?.trim() || null,
    className: input.className?.trim() || null,
    salesDescription: input.salesDescription?.trim() || null,
    salesPrice: input.salesPrice ?? null,
    cost: input.cost ?? null,
    reorderPoint: input.reorderPoint ?? null,
  };

  if (input.itemType === "inventory") {
    return {
      ...patch,
      qtyOnHand: input.initialQty ?? null,
    };
  }

  return patch;
}

export function inventoryFormToCreateInput(
  form: InventoryFormState,
  itemType: "inventory",
  options?: { requireAsOfDate?: boolean },
): CreateProductServiceInput | null {
  const name = form.name.trim();
  if (!name) return null;

  const qty = form.initialQty.trim();
  if (!qty || Number.isNaN(Number(qty))) return null;

  if (options?.requireAsOfDate !== false && !form.asOfDate.trim()) return null;

  return {
    name,
    itemType,
    sku: form.sku,
    category: form.category || undefined,
    className: form.className || undefined,
    initialQty: Number(qty),
    asOfDate: form.asOfDate || new Date().toISOString().slice(0, 10),
    reorderPoint: form.reorderPoint ? Number(form.reorderPoint) : undefined,
    inventoryAssetAccount: form.inventoryAssetAccount,
    salesDescription: form.salesDescription,
    salesPrice: form.salesPrice ? Number(form.salesPrice) : undefined,
    incomeAccount: form.incomeAccount,
    salesTaxInclusive: form.salesTaxInclusive,
    purchaseDescription: form.showPurchasing ? form.purchaseDescription : undefined,
    cost: form.showPurchasing && form.cost ? Number(form.cost) : undefined,
    expenseAccount: form.showPurchasing ? form.expenseAccount : undefined,
    purchaseTaxInclusive: form.showPurchasing ? form.purchaseTaxInclusive : undefined,
    preferredSupplier: form.showPurchasing ? form.preferredSupplier || undefined : undefined,
  };
}
