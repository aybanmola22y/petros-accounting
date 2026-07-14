"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ProductServiceEditFlow } from "@/components/product-service-edit-flow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { MockProductService } from "@/lib/mock-data/products-services";
import { isProductServiceActive } from "@/lib/product-services/filters";
import { replaceProductServicesInStore } from "@/lib/mock-data/store";
import { cn } from "@/lib/utils";

type ProductServiceRowMenuProps = {
  product: MockProductService;
  onChanged?: () => void;
};

async function patchProductService(
  id: string,
  patch: { isActive?: boolean; qtyOnHand?: number; cost?: number },
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

export function ProductServiceRowMenu({ product, onChanged }: ProductServiceRowMenuProps) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const isInventory = product.itemType === "inventory";
  const isActive = isProductServiceActive(product);

  async function setActive(nextActive: boolean) {
    try {
      await patchProductService(product.id, { isActive: nextActive });
      onChanged?.();
      toast({
        title: nextActive ? "Product/service activated" : "Product/service made inactive",
        description: product.name,
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Could not update item.",
        variant: "destructive",
      });
    }
  }

  return (
    <>
      <div className="inline-flex items-center gap-0.5">
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
          onClick={() => setEditOpen(true)}
        >
          Edit
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full",
                "text-primary hover:bg-primary/10 transition-colors",
              )}
              aria-label={`More actions for ${product.name}`}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => void setActive(!isActive)}>
              {isActive ? "Make inactive" : "Make active"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                toast({
                  title: "Run report",
                  description: `Sales by product/service for ${product.name} will be available soon.`,
                })
              }
            >
              Run report
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                toast({
                  title: "Duplicate",
                  description: `Duplicate ${product.name} will be available soon.`,
                })
              }
            >
              Duplicate
            </DropdownMenuItem>
            {isInventory && (
              <DropdownMenuItem
                onClick={() =>
                  toast({
                    title: "Adjust quantity",
                    description: `Quantity adjustment for ${product.name} will be available soon.`,
                  })
                }
              >
                Adjust quantity
              </DropdownMenuItem>
            )}
            {isInventory && (
              <DropdownMenuItem
                onClick={() =>
                  toast({
                    title: "Adjust starting value",
                    description: `Starting value adjustment for ${product.name} will be available soon.`,
                  })
                }
              >
                Adjust starting value
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProductServiceEditFlow
        product={product}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onChanged}
      />
    </>
  );
}
