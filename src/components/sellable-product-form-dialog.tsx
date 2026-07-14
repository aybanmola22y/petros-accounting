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
import type { CreateProductServiceInput, ProductServiceItemType } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { ProductCategoryClassFields } from "@/components/product-category-class-fields";
import { PreferredSupplierSelect } from "@/components/preferred-supplier-select";

const SELLABLE_INCOME_ACCOUNTS = [
  "Sales",
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

const TAX_OPTIONS = [
  "VAT 12%",
  "VAT Exempt",
  "Zero Rated",
] as const;

export type SellableFormState = {
  name: string;
  sku: string;
  category: string;
  className: string;
  sellToCustomer: boolean;
  salesDescription: string;
  salesPrice: string;
  incomeAccount: string;
  salesTaxInclusive: boolean;
  salesTax: string;
  showPurchasing: boolean;
  purchaseFromSupplier: boolean;
  purchaseDescription: string;
  cost: string;
  expenseAccount: string;
  purchaseTaxInclusive: boolean;
  preferredSupplier: string;
};

export function defaultSellableForm(): SellableFormState {
  return {
    name: "",
    sku: "",
    category: "",
    className: "",
    sellToCustomer: true,
    salesDescription: "",
    salesPrice: "",
    incomeAccount: SELLABLE_INCOME_ACCOUNTS[0],
    salesTaxInclusive: false,
    salesTax: "",
    showPurchasing: false,
    purchaseFromSupplier: true,
    purchaseDescription: "",
    cost: "",
    expenseAccount: "Purchases",
    purchaseTaxInclusive: false,
    preferredSupplier: "",
  };
}

export function sellableToCreateInput(
  form: SellableFormState,
  itemType: Extract<ProductServiceItemType, "non-inventory" | "service">,
): CreateProductServiceInput | null {
  const name = form.name.trim();
  if (!name) return null;
  return {
    name,
    itemType,
    sku: form.sku,
    category: form.category || undefined,
    className: form.className || undefined,
    salesDescription: form.sellToCustomer ? form.salesDescription : undefined,
    salesPrice:
      form.sellToCustomer && form.salesPrice ? Number(form.salesPrice) : undefined,
    incomeAccount: form.sellToCustomer ? form.incomeAccount : undefined,
    salesTaxInclusive: form.sellToCustomer ? form.salesTaxInclusive : undefined,
    purchaseDescription:
      form.showPurchasing && form.purchaseFromSupplier
        ? form.purchaseDescription
        : undefined,
    cost:
      form.showPurchasing && form.purchaseFromSupplier && form.cost
        ? Number(form.cost)
        : undefined,
    expenseAccount:
      form.showPurchasing && form.purchaseFromSupplier
        ? form.expenseAccount
        : undefined,
    purchaseTaxInclusive:
      form.showPurchasing && form.purchaseFromSupplier
        ? form.purchaseTaxInclusive
        : undefined,
    preferredSupplier:
      form.showPurchasing && form.purchaseFromSupplier && form.preferredSupplier
        ? form.preferredSupplier
        : undefined,
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

type SellableProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: SellableFormState;
  setForm: Dispatch<SetStateAction<SellableFormState>>;
  typeTitle: string;
  typeIcon: ReactNode;
  onChangeType: () => void;
  onSave: () => void;
  allowChangeType?: boolean;
};

export function SellableProductFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  typeTitle,
  typeIcon,
  onChangeType,
  onSave,
  allowChangeType = true,
}: SellableProductFormDialogProps) {
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
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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

          <div className="space-y-4 border-b px-5 py-4">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={form.sellToCustomer}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, sellToCustomer: v === true }))
                }
              />
              <span className="font-medium text-foreground">
                I sell this product/service to my customer.
              </span>
            </label>
            {form.sellToCustomer && (
              <>
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
                        {SELLABLE_INCOME_ACCOUNTS.map((a) => (
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
                      setForm((f) => ({ ...f, salesTaxInclusive: v === true }))
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
              </>
            )}
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
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={form.purchaseFromSupplier}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, purchaseFromSupplier: v === true }))
                  }
                />
                <span className="font-medium text-foreground">
                  I purchase this product/service from a supplier.
                </span>
              </label>
              {form.purchaseFromSupplier && (
                <>
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
                </>
              )}
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
