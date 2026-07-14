"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useMemo, useSyncExternalStore } from "react";
import {
  GripVertical,
  ImageIcon,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SplitActionButton } from "@/components/split-action-button";
import { Textarea } from "@/components/ui/textarea";
import type {
  CreateProductServiceInput,
  MockProductService,
} from "@/lib/mock-data";
import { getProductServicesSnapshot, subscribeMockStore } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export type BundleLineFormState = {
  id: string;
  productServiceId: string;
  qty: string;
};

export type BundleFormState = {
  name: string;
  sku: string;
  salesDescription: string;
  displayComponentsWhenPrinting: boolean;
  lines: BundleLineFormState[];
};

function newBundleLineId() {
  return `bl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultBundleForm(): BundleFormState {
  return {
    name: "",
    sku: "",
    salesDescription: "",
    displayComponentsWhenPrinting: false,
    lines: [
      { id: newBundleLineId(), productServiceId: "", qty: "" },
      { id: newBundleLineId(), productServiceId: "", qty: "" },
    ],
  };
}

export function bundleToCreateInput(
  form: BundleFormState,
  products: MockProductService[],
): CreateProductServiceInput | null {
  const name = form.name.trim();
  if (!name) return null;

  const bundleLines: NonNullable<CreateProductServiceInput["bundleLines"]> = [];
  let salesPrice = 0;

  for (const line of form.lines) {
    if (!line.productServiceId) continue;
    const qty = Number(line.qty);
    if (!qty || qty <= 0 || Number.isNaN(qty)) continue;
    const product = products.find((p) => p.id === line.productServiceId);
    if (!product || product.itemType === "bundle") continue;
    bundleLines.push({
      productServiceId: product.id,
      productServiceName: product.name,
      qty,
    });
    salesPrice += qty * (product.salesPrice ?? 0);
  }

  return {
    name,
    itemType: "bundle",
    sku: form.sku,
    salesDescription: form.salesDescription || undefined,
    displayBundleComponents: form.displayComponentsWhenPrinting,
    bundleLines,
    salesPrice: bundleLines.length > 0 ? salesPrice : undefined,
  };
}

function TopField({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required ? "*" : ""}
      </Label>
      {children}
    </div>
  );
}

function useBundleProductOptions() {
  const products = useSyncExternalStore(
    subscribeMockStore,
    getProductServicesSnapshot,
    getProductServicesSnapshot,
  );
  return useMemo(
    () => products.filter((p) => p.itemType !== "bundle"),
    [products],
  );
}

type BundleProductFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: BundleFormState;
  setForm: Dispatch<SetStateAction<BundleFormState>>;
  typeIcon: ReactNode;
  typeTitle: string;
  onChangeType: () => void;
  onSave: () => void;
};

export function BundleProductFormSheet({
  open,
  onOpenChange,
  form,
  setForm,
  typeIcon,
  typeTitle,
  onChangeType,
  onSave,
}: BundleProductFormSheetProps) {
  const productOptions = useBundleProductOptions();

  function updateLine(id: string, patch: Partial<BundleLineFormState>) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  }

  function addLine() {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { id: newBundleLineId(), productServiceId: "", qty: "" }],
    }));
  }

  function removeLine(id: string) {
    setForm((f) => {
      if (f.lines.length <= 1) {
        return {
          ...f,
          lines: [{ id: newBundleLineId(), productServiceId: "", qty: "" }],
        };
      }
      return { ...f, lines: f.lines.filter((line) => line.id !== id) };
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[540px] [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Product/Service information</SheetTitle>

        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <p className="text-lg font-semibold">Product/Service information</p>
          <button
            type="button"
            className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 border-b px-5 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {typeIcon}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{typeTitle}</span>
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={onChangeType}
              >
                Change type
              </button>
            </div>
          </div>

          <div className="grid gap-4 border-b px-5 py-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              <TopField label="Name" required>
                <Textarea
                  className="min-h-[72px] resize-y"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </TopField>
              <TopField label="SKU">
                <Input
                  className="h-10"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                />
              </TopField>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex size-28 items-center justify-center rounded-md border border-dashed bg-muted/30 text-muted-foreground">
                <ImageIcon className="size-10 opacity-40" />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled
                >
                  <Pencil className="size-4" />
                </Button>
                <span className="h-4 w-px bg-border" aria-hidden />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="border-b px-5 py-4">
            <TopField label="Description">
              <Textarea
                className="min-h-[80px] resize-y"
                placeholder="Description on sales forms"
                value={form.salesDescription}
                onChange={(e) =>
                  setForm((f) => ({ ...f, salesDescription: e.target.value }))
                }
              />
            </TopField>
          </div>

          <div className="space-y-4 px-5 py-4">
            <p className="text-sm font-semibold text-foreground">
              Products/services included in the bundle
            </p>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={form.displayComponentsWhenPrinting}
                onCheckedChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    displayComponentsWhenPrinting: v === true,
                  }))
                }
              />
              <span className="text-foreground leading-snug">
                Display bundle components when printing or sending transactions
              </span>
            </label>

            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                    <th className="w-9 px-2 py-2" />
                    <th className="px-2 py-2">PRODUCT/SERVICE</th>
                    <th className="w-24 px-2 py-2 text-right">QTY</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line) => (
                    <tr key={line.id} className="border-b last:border-b-0">
                      <td className="px-2 py-1.5 text-muted-foreground/50">
                        <GripVertical className="size-4" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select
                          value={line.productServiceId || undefined}
                          onValueChange={(v) =>
                            updateLine(line.id, { productServiceId: v })
                          }
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue placeholder="Select product/service" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {productOptions.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          className="h-9 text-right"
                          value={line.qty}
                          onChange={(e) =>
                            updateLine(line.id, { qty: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label="Remove line"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              onClick={addLine}
            >
              <Plus className="size-4" />
              Add lines
            </button>
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t px-5 py-3">
          <SplitActionButton
            label="Save and close"
            onClick={onSave}
            className="bg-emerald-700 hover:bg-emerald-800"
            menuItems={[{ label: "Save", onClick: onSave }]}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
