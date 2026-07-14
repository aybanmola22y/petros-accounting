"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Package, Paintbrush, Shirt } from "lucide-react";
import { InventoryProductFormSheet } from "@/components/inventory-product-form-sheet";
import {
  SellableProductFormDialog,
  sellableToCreateInput,
} from "@/components/sellable-product-form-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  formatProductItemType,
  type MockProductService,
  type ProductServiceItemType,
} from "@/lib/mock-data/products-services";
import { replaceProductServicesInStore } from "@/lib/mock-data/store";
import {
  createInputToUpdatePatch,
  inventoryFormToCreateInput,
  productToInventoryForm,
  productToSellableForm,
} from "@/lib/product-services/form-mappers";
import type { InventoryFormState } from "@/components/inventory-product-form-sheet";
import type { SellableFormState } from "@/components/sellable-product-form-dialog";

type ProductServiceEditFlowProps = {
  product: MockProductService | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

function typeIconFor(itemType: ProductServiceItemType | undefined): ReactNode {
  switch (itemType) {
    case "inventory":
    case "bundle":
      return <Shirt className="h-5 w-5" strokeWidth={1.75} />;
    case "non-inventory":
      return <Package className="h-5 w-5" strokeWidth={1.75} />;
    default:
      return <Paintbrush className="h-5 w-5" strokeWidth={1.75} />;
  }
}

async function saveProductPatch(
  id: string,
  patch: ReturnType<typeof createInputToUpdatePatch>,
) {
  const response = await fetch("/api/product-services", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  });
  const payload = (await response.json()) as {
    productServices?: MockProductService[];
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error ?? "Update failed.");
  replaceProductServicesInStore(payload.productServices ?? []);
}

export function ProductServiceEditFlow({
  product,
  open,
  onOpenChange,
  onSaved,
}: ProductServiceEditFlowProps) {
  const { toast } = useToast();
  const [sellableForm, setSellableForm] = useState<SellableFormState | null>(null);
  const [inventoryForm, setInventoryForm] = useState<InventoryFormState | null>(null);

  const itemType = product?.itemType ?? "service";
  const typeTitle = formatProductItemType(itemType);

  useEffect(() => {
    if (!open || !product) return;
    if (itemType === "bundle") {
      toast({
        title: "Bundle editing",
        description: "Editing bundles will be available soon.",
      });
      onOpenChange(false);
      return;
    }
    if (itemType === "inventory") {
      setInventoryForm(productToInventoryForm(product));
      setSellableForm(null);
      return;
    }
    setSellableForm(productToSellableForm(product));
    setInventoryForm(null);
  }, [open, product, itemType]);

  const typeIcon = useMemo(() => typeIconFor(itemType), [itemType]);

  async function handleSave() {
    if (!product) return;

    try {
      if (itemType === "bundle") {
        toast({
          title: "Bundle editing",
          description: "Editing bundles will be available soon.",
        });
        return;
      }

      if (itemType === "inventory") {
        if (!inventoryForm) return;
        const input = inventoryFormToCreateInput(inventoryForm, "inventory", {
          requireAsOfDate: false,
        });
        if (!input) {
          toast({
            title: "Missing required fields",
            description: "Enter a name and quantity on hand.",
            variant: "destructive",
          });
          return;
        }
        await saveProductPatch(product.id, createInputToUpdatePatch(input));
      } else {
        if (!sellableForm) return;
        const resolvedType =
          itemType === "non-inventory" ? "non-inventory" : "service";
        const input = sellableToCreateInput(sellableForm, resolvedType);
        if (!input) {
          toast({
            title: "Name required",
            description: "Enter a product or service name.",
            variant: "destructive",
          });
          return;
        }
        await saveProductPatch(product.id, createInputToUpdatePatch(input));
      }

      onSaved?.();
      onOpenChange(false);
      toast({
        title: "Product/service saved",
        description: product.name,
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save changes.",
        variant: "destructive",
      });
    }
  }

  if (!product) return null;

  if (itemType === "inventory" && inventoryForm) {
    return (
      <InventoryProductFormSheet
        open={open}
        onOpenChange={onOpenChange}
        form={inventoryForm}
        setForm={(next) => {
          setInventoryForm((prev) => {
            if (prev === null) return prev;
            return typeof next === "function" ? next(prev) : next;
          });
        }}
        typeIcon={typeIcon}
        typeTitle={typeTitle}
        onChangeType={() => undefined}
        onSave={() => void handleSave()}
        allowChangeType={false}
      />
    );
  }

  if ((itemType === "service" || itemType === "non-inventory") && sellableForm) {
    return (
      <SellableProductFormDialog
        open={open}
        onOpenChange={onOpenChange}
        form={sellableForm}
        setForm={(next) => {
          setSellableForm((prev) => {
            if (prev === null) return prev;
            return typeof next === "function" ? next(prev) : next;
          });
        }}
        typeTitle={typeTitle}
        typeIcon={typeIcon}
        onChangeType={() => undefined}
        onSave={() => void handleSave()}
        allowChangeType={false}
      />
    );
  }

  return null;
}
