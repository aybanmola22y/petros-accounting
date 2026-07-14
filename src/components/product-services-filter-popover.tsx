"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MockProductService } from "@/lib/mock-data/products-services";
import {
  collectProductServiceCategories,
  DEFAULT_PRODUCT_SERVICE_LIST_FILTERS,
  PRODUCT_SERVICE_STOCK_STATUS_FILTER_OPTIONS,
  PRODUCT_SERVICE_TYPE_FILTER_OPTIONS,
  productServiceListFiltersAreDefault,
  type ProductServiceListFilters,
  type ProductServiceStatusFilter,
  type ProductServiceStockStatusFilter,
  type ProductServiceTypeFilter,
} from "@/lib/product-services/filters";
import { cn } from "@/lib/utils";

type ProductServicesFilterPopoverProps = {
  products: MockProductService[];
  appliedFilters: ProductServiceListFilters;
  onApply: (filters: ProductServiceListFilters) => void;
};

const STATUS_OPTIONS: ProductServiceStatusFilter[] = ["Active", "Inactive", "All"];

export function ProductServicesFilterPopover({
  products,
  appliedFilters,
  onApply,
}: ProductServicesFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProductServiceListFilters>(appliedFilters);

  const categories = useMemo(() => collectProductServiceCategories(products), [products]);
  const filtersActive = !productServiceListFiltersAreDefault(appliedFilters);

  useEffect(() => {
    if (open) setDraft(appliedFilters);
  }, [open, appliedFilters]);

  function handleReset() {
    setDraft(DEFAULT_PRODUCT_SERVICE_LIST_FILTERS);
    onApply(DEFAULT_PRODUCT_SERVICE_LIST_FILTERS);
    setOpen(false);
  }

  function handleApply() {
    onApply(draft);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "h-9 w-9 shrink-0 relative",
            filtersActive && "border-primary/40 bg-primary/5",
          )}
          aria-label="Filter products and services"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {filtersActive && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0 shadow-lg" sideOffset={6}>
        <div className="space-y-4 px-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Status</Label>
            <Select
              value={draft.status}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, status: value as ProductServiceStatusFilter }))
              }
            >
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Type</Label>
            <Select
              value={draft.type}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, type: value as ProductServiceTypeFilter }))
              }
            >
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_SERVICE_TYPE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Category</Label>
            <Select
              value={draft.category}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, category: value }))}
            >
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[min(280px,60vh)]">
                <SelectItem value="All">All</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Stock status</Label>
            <Select
              value={draft.stockStatus}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  stockStatus: value as ProductServiceStockStatusFilter,
                }))
              }
            >
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_SERVICE_STOCK_STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handleApply}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
