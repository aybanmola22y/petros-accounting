"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Pencil,
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
import { ProductCategoryClassFields } from "@/components/product-category-class-fields";
import { PreferredSupplierSelect } from "@/components/preferred-supplier-select";
import { cn } from "@/lib/utils";

const INCOME_ACCOUNTS = [
  "Sales of Product Income",
  "Service Revenue",
  "Other Income",
] as const;

const EXPENSE_ACCOUNTS = [
  "Cost of sales",
  "Cost of Goods Sold",
  "Purchases",
  "Supplies",
  "Other Expense",
] as const;

const INVENTORY_ASSET_ACCOUNTS = ["Inventory Asset", "Inventory"] as const;

const TAX_OPTIONS = [
  "VAT 12%",
  "VAT Exempt",
  "Zero Rated",
] as const;

export type InventoryFormState = {
  name: string;
  sku: string;
  category: string;
  className: string;
  initialQty: string;
  asOfDate: string;
  reorderPoint: string;
  inventoryAssetAccount: string;
  salesDescription: string;
  salesPrice: string;
  incomeAccount: string;
  salesTaxInclusive: boolean;
  salesTax: string;
  showPurchasing: boolean;
  purchaseDescription: string;
  cost: string;
  expenseAccount: string;
  purchaseTaxInclusive: boolean;
  preferredSupplier: string;
};

export function defaultInventoryForm(): InventoryFormState {
  return {
    name: "",
    sku: "",
    category: "",
    className: "",
    initialQty: "",
    asOfDate: "",
    reorderPoint: "",
    inventoryAssetAccount: INVENTORY_ASSET_ACCOUNTS[0],
    salesDescription: "",
    salesPrice: "",
    incomeAccount: INCOME_ACCOUNTS[0],
    salesTaxInclusive: false,
    salesTax: "",
    showPurchasing: false,
    purchaseDescription: "",
    cost: "",
    expenseAccount: EXPENSE_ACCOUNTS[0],
    purchaseTaxInclusive: false,
    preferredSupplier: "",
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

function InlineField({
  label,
  required,
  help,
  children,
  inputClassName,
}: {
  label: string;
  required?: boolean;
  help?: ReactNode;
  children: ReactNode;
  inputClassName?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-6 border-b px-5 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {label}
          {required ? "*" : ""}
        </p>
        {help}
      </div>
      <div className={cn("w-9.5rem shrink-0", inputClassName)}>{children}</div>
    </div>
  );
}

type InventoryProductFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: InventoryFormState;
  setForm: Dispatch<SetStateAction<InventoryFormState>>;
  typeIcon: ReactNode;
  typeTitle: string;
  onChangeType: () => void;
  onSave: () => void;
  allowChangeType?: boolean;
};

export function InventoryProductFormSheet({
  open,
  onOpenChange,
  form,
  setForm,
  typeIcon,
  typeTitle,
  onChangeType,
  onSave,
  allowChangeType = true,
}: InventoryProductFormSheetProps) {
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
              {allowChangeType && (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={onChangeType}
                >
                  Change type
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 border-b px-5 py-4 sm:grid-cols-[1fr_1fr_auto]">
            <TopField label="Name" required className="sm:col-span-2">
              <Textarea
                className="min-h-[72px] resize-y"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </TopField>
            <div className="flex flex-col items-center gap-2 sm:row-span-2">
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
            <TopField label="SKU">
              <Input
                className="h-10"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              />
            </TopField>
            <ProductCategoryClassFields
              category={form.category}
              className={form.className}
              onCategoryChange={(v) => setForm((f) => ({ ...f, category: v }))}
              onClassChange={(v) => setForm((f) => ({ ...f, className: v }))}
            />
          </div>

          <div className="border-b">
            <InlineField label="Initial quantity on hand" required>
              <Input
                className="h-9"
                type="number"
                min={0}
                value={form.initialQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, initialQty: e.target.value }))
                }
              />
            </InlineField>
            <InlineField
              label="As of date"
              required
              inputClassName="w-[10.5rem]"
              help={
                <button
                  type="button"
                  className="mt-0.5 text-xs text-primary hover:underline"
                >
                  What&apos;s the as of date?
                </button>
              }
            >
              <Input
                className="h-9"
                type="date"
                value={form.asOfDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, asOfDate: e.target.value }))
                }
              />
            </InlineField>
            <InlineField
              label="Reorder point"
              help={
                <button
                  type="button"
                  className="mt-0.5 text-xs text-primary hover:underline"
                >
                  What&apos;s the reorder point?
                </button>
              }
            >
              <Input
                className="h-9"
                type="number"
                min={0}
                value={form.reorderPoint}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reorderPoint: e.target.value }))
                }
              />
            </InlineField>
          </div>

          <div className="border-b px-5 py-4">
            <TopField label="Inventory asset account">
              <Select
                value={form.inventoryAssetAccount}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, inventoryAssetAccount: v }))
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_ASSET_ACCOUNTS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TopField>
          </div>

          <div className="space-y-4 border-b px-5 py-4">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <TopField label="Sales price/rate (PHP)">
                <Input
                  className="h-10"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.salesPrice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, salesPrice: e.target.value }))
                  }
                />
              </TopField>
              <TopField label="Income account">
                <Select
                  value={form.incomeAccount}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, incomeAccount: v }))
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_ACCOUNTS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TopField>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={form.salesTaxInclusive}
                onCheckedChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    salesTaxInclusive: v === true,
                  }))
                }
              />
              <span className="text-foreground">Inclusive of tax</span>
            </label>
            <TopField label="Tax">
              <Select
                value={form.salesTax || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, salesTax: v }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select tax" />
                </SelectTrigger>
                <SelectContent>
                  {TAX_OPTIONS.map((tax) => (
                    <SelectItem key={tax} value={tax}>
                      {tax}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TopField>
          </div>

          <div className="border-b bg-muted/30 py-2.5 text-center">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              onClick={() =>
                setForm((f) => ({ ...f, showPurchasing: !f.showPurchasing }))
              }
            >
              {form.showPurchasing ? (
                <>
                  SHOW LESS
                  <ChevronUp className="size-4" />
                </>
              ) : (
                <>
                  SHOW MORE
                  <ChevronDown className="size-4" />
                </>
              )}
            </button>
          </div>

          {form.showPurchasing && (
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm font-semibold text-foreground">
                Purchasing information
              </p>
              <TopField label="Description">
                <Textarea
                  className="min-h-[80px] resize-y"
                  placeholder="Description on purchase forms"
                  value={form.purchaseDescription}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      purchaseDescription: e.target.value,
                    }))
                  }
                />
              </TopField>
              <div className="grid gap-4 sm:grid-cols-2">
                <TopField label="Cost (PHP)">
                  <Input
                    className="h-10"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.cost}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cost: e.target.value }))
                    }
                  />
                </TopField>
                <TopField label="Expense account">
                  <Select
                    value={form.expenseAccount}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, expenseAccount: v }))
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_ACCOUNTS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TopField>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={form.purchaseTaxInclusive}
                  onCheckedChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      purchaseTaxInclusive: v === true,
                    }))
                  }
                />
                <span className="text-foreground">Inclusive of tax</span>
              </label>
              <TopField label="Preferred Supplier">
                <PreferredSupplierSelect
                  value={form.preferredSupplier}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, preferredSupplier: v }))
                  }
                />
              </TopField>
            </div>
          )}
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
