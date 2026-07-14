"use client";

import { memo } from "react";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductClassSelect } from "@/components/product-class-select";
import type {
  ExpenseCategoryLine,
  ExpenseItemLine,
} from "@/components/expense-form-dialog";
import type { MockExpenseCategory, MockProductItemClass } from "@/lib/mock-data";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

const ADD_CATEGORY_VALUE = "__add_category__";
const ADD_PRODUCT_SERVICE_VALUE = "__add_product_service__";

const LINE_TABLE_CELL = "px-2 py-1.5 align-middle";
const LINE_TABLE_FIELD = "h-9 border-0 bg-transparent px-2 shadow-none";
const LINE_TABLE_DATE_FIELD =
  "h-9 min-w-[7.25rem] border-0 bg-transparent px-2 text-sm shadow-none tabular-nums leading-normal";
const LINE_TABLE_SELECT = "h-9 w-full border-0 bg-transparent px-2 shadow-none";
const LINE_TABLE_CENTER_CELL = "px-2 py-1.5 text-center align-middle";
const LINE_TABLE_CENTER_FIELD =
  "h-9 min-w-[5rem] border-0 bg-transparent px-2 text-center shadow-none tabular-nums";
const LINE_TABLE_CENTER_SELECT = cn(
  LINE_TABLE_SELECT,
  "relative min-w-[9rem] justify-center px-7 [&>span]:line-clamp-1 [&>span]:text-center [&>svg]:absolute [&>svg]:right-2",
);
const LINE_COL_QTY = "min-w-[4.75rem] w-[4.75rem]";
const LINE_COL_RATE = "min-w-[7.5rem] w-[7.5rem]";
const LINE_COL_AMOUNT = "min-w-[9rem] w-[9rem]";
const LINE_COL_BILLABLE = "min-w-[6rem] w-[6rem]";
const LINE_COL_CLASS = "min-w-[10.5rem]";

function itemLineAmount(line: ExpenseItemLine) {
  return (Number(line.qty) || 0) * (Number(line.rate) || 0);
}

type CustomerOption = { id: string; name: string };
type ProductServiceOption = { id: string; name: string };

type ExpenseCategoryLineRowProps = {
  line: ExpenseCategoryLine;
  index: number;
  isBill: boolean;
  expenseCategories: MockExpenseCategory[];
  customers: CustomerOption[];
  productClasses: MockProductItemClass[];
  categorySelectLineId: string | null;
  onCategorySelectLineIdChange: (id: string | null) => void;
  onUpdateLine: (id: string, patch: Partial<ExpenseCategoryLine>) => void;
  onAddCategory: (lineId: string) => void;
  onDuplicateLine: (id: string) => void;
  onRemoveLine: (id: string) => void;
  canRemove: boolean;
};

export const ExpenseCategoryLineRow = memo(function ExpenseCategoryLineRow({
  line,
  index,
  isBill,
  expenseCategories,
  customers,
  productClasses,
  categorySelectLineId,
  onCategorySelectLineIdChange,
  onUpdateLine,
  onAddCategory,
  onDuplicateLine,
  onRemoveLine,
  canRemove,
}: ExpenseCategoryLineRowProps) {
  const isCategorySelectOpen = categorySelectLineId === line.id;

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-2 py-1.5 text-muted-foreground/50">
        <GripVertical className="h-4 w-4" />
      </td>
      <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{index + 1}</td>
      <td className={LINE_TABLE_CELL}>
        <Select
          open={isCategorySelectOpen}
          onOpenChange={(open) =>
            onCategorySelectLineIdChange(open ? line.id : null)
          }
          value={line.category || undefined}
          onValueChange={(v) => {
            if (v === ADD_CATEGORY_VALUE) {
              onCategorySelectLineIdChange(null);
              onAddCategory(line.id);
              return;
            }
            onUpdateLine(line.id, { category: v });
          }}
        >
          <SelectTrigger className={LINE_TABLE_SELECT}>
            <SelectValue placeholder="Select category">
              {line.category || undefined}
            </SelectValue>
          </SelectTrigger>
          {isCategorySelectOpen ? (
            <SelectContent className="max-h-[min(320px,var(--radix-select-content-available-height))] p-0">
              <SelectItem
                value={ADD_CATEGORY_VALUE}
                className="rounded-none border-b border-border/60 bg-muted/40 py-2.5 pl-3 pr-8 text-primary font-medium focus:bg-muted/60 focus:text-primary"
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4 shrink-0" />
                  Add new
                </span>
              </SelectItem>
              {expenseCategories.map((c) => (
                <SelectItem
                  key={c.id}
                  value={c.name}
                  className={cn("py-2 pl-3 pr-8", c.isSubAccount && "pl-6")}
                >
                  {isBill ? (
                    <span className="text-sm leading-snug font-medium">{c.displayName}</span>
                  ) : (
                    <span className="flex flex-col gap-1">
                      <span className="text-sm leading-snug font-medium">{c.displayName}</span>
                      <span className="max-w-[240px] truncate text-xs text-muted-foreground/90">
                        {c.accountType}
                      </span>
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          ) : null}
        </Select>
      </td>
      <td className={LINE_TABLE_CELL}>
        <Input
          className={LINE_TABLE_FIELD}
          value={line.description}
          onChange={(e) => onUpdateLine(line.id, { description: e.target.value })}
        />
      </td>
      <td className={cn(LINE_TABLE_CENTER_CELL, LINE_COL_AMOUNT)}>
        <Input
          type="number"
          min="0"
          step="0.01"
          className={cn(LINE_TABLE_CENTER_FIELD, "w-full")}
          value={line.amount || ""}
          onChange={(e) =>
            onUpdateLine(line.id, {
              amount: Number.parseFloat(e.target.value) || 0,
            })
          }
        />
      </td>
      <td className={cn(LINE_TABLE_CENTER_CELL, LINE_COL_BILLABLE)}>
        <div className="flex items-center justify-center">
          <Checkbox
            checked={line.billable}
            onCheckedChange={(v) => onUpdateLine(line.id, { billable: v === true })}
            aria-label="Billable"
          />
        </div>
      </td>
      <td className={LINE_TABLE_CELL}>
        <Select
          value={line.customerId || "__none__"}
          onValueChange={(v) =>
            onUpdateLine(line.id, {
              customerId: v === "__none__" ? "" : v,
            })
          }
        >
          <SelectTrigger className={LINE_TABLE_SELECT}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className={cn(LINE_TABLE_CENTER_CELL, LINE_COL_CLASS)}>
        <ProductClassSelect
          value={line.className}
          onValueChange={(v) => onUpdateLine(line.id, { className: v })}
          classes={productClasses}
          triggerClassName={LINE_TABLE_CENTER_SELECT}
        />
      </td>
      <td className={LINE_TABLE_CELL}>
        <div className="flex items-center justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Duplicate line"
            onClick={() => onDuplicateLine(line.id)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Delete line"
            disabled={!canRemove}
            onClick={() => onRemoveLine(line.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
});

type ExpenseItemLineRowProps = {
  line: ExpenseItemLine;
  index: number;
  isBill: boolean;
  productServices: ProductServiceOption[];
  customers: CustomerOption[];
  productClasses: MockProductItemClass[];
  productServiceSelectLineId: string | null;
  onProductServiceSelectLineIdChange: (id: string | null) => void;
  onUpdateItemLine: (id: string, patch: Partial<ExpenseItemLine>) => void;
  onAddProduct: (lineId: string) => void;
  onDuplicateItemLine: (id: string) => void;
  onRemoveItemLine: (id: string) => void;
  canRemove: boolean;
};

export const ExpenseItemLineRow = memo(function ExpenseItemLineRow({
  line,
  index,
  isBill,
  productServices,
  customers,
  productClasses,
  productServiceSelectLineId,
  onProductServiceSelectLineIdChange,
  onUpdateItemLine,
  onAddProduct,
  onDuplicateItemLine,
  onRemoveItemLine,
  canRemove,
}: ExpenseItemLineRowProps) {
  const isProductSelectOpen = productServiceSelectLineId === line.id;

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-2 py-1.5 text-muted-foreground/50">
        <GripVertical className="h-4 w-4" />
      </td>
      <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{index + 1}</td>
      <td className={cn(LINE_TABLE_CELL, "min-w-[128px]")}>
        <Input
          className={LINE_TABLE_DATE_FIELD}
          placeholder="MM/DD/YYYY"
          value={line.serviceDate}
          onChange={(e) => onUpdateItemLine(line.id, { serviceDate: e.target.value })}
        />
      </td>
      <td className={LINE_TABLE_CELL}>
        <Select
          open={isProductSelectOpen}
          onOpenChange={(open) =>
            onProductServiceSelectLineIdChange(open ? line.id : null)
          }
          value={line.productService || undefined}
          onValueChange={(v) => {
            if (v === ADD_PRODUCT_SERVICE_VALUE) {
              onProductServiceSelectLineIdChange(null);
              onAddProduct(line.id);
              return;
            }
            onUpdateItemLine(line.id, { productService: v });
          }}
        >
          <SelectTrigger className={LINE_TABLE_SELECT}>
            <SelectValue placeholder="Select product/service">
              {line.productService || undefined}
            </SelectValue>
          </SelectTrigger>
          {isProductSelectOpen ? (
            <SelectContent className="max-h-[min(320px,var(--radix-select-content-available-height))] p-0">
              <SelectItem
                value={ADD_PRODUCT_SERVICE_VALUE}
                className="rounded-none border-b border-border/60 bg-muted/40 py-2.5 pl-3 pr-8 text-primary font-medium focus:bg-muted/60 focus:text-primary"
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4 shrink-0" />
                  Add new
                </span>
              </SelectItem>
              {productServices.map((p) => (
                <SelectItem key={p.id} value={p.name} className="py-2.5 pl-3 pr-8">
                  <span className="text-sm font-medium">{p.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          ) : null}
        </Select>
      </td>
      <td className={LINE_TABLE_CELL}>
        <Input
          className={LINE_TABLE_FIELD}
          value={line.sku}
          onChange={(e) => onUpdateItemLine(line.id, { sku: e.target.value })}
        />
      </td>
      <td className={LINE_TABLE_CELL}>
        <Input
          className={LINE_TABLE_FIELD}
          value={line.description}
          onChange={(e) => onUpdateItemLine(line.id, { description: e.target.value })}
        />
      </td>
      <td className={cn(LINE_TABLE_CENTER_CELL, LINE_COL_QTY)}>
        <Input
          type="number"
          min="0"
          step="any"
          className={cn(LINE_TABLE_CENTER_FIELD, "w-full")}
          value={line.qty || ""}
          onChange={(e) =>
            onUpdateItemLine(line.id, {
              qty: Number.parseFloat(e.target.value) || 0,
            })
          }
        />
      </td>
      <td className={cn(LINE_TABLE_CENTER_CELL, LINE_COL_RATE)}>
        <Input
          type="number"
          min="0"
          step="0.01"
          className={cn(LINE_TABLE_CENTER_FIELD, "w-full")}
          value={line.rate || ""}
          onChange={(e) =>
            onUpdateItemLine(line.id, {
              rate: Number.parseFloat(e.target.value) || 0,
            })
          }
        />
      </td>
      <td
        className={cn(
          LINE_TABLE_CENTER_CELL,
          LINE_COL_AMOUNT,
          "tabular-nums font-medium",
        )}
      >
        {formatPHP(itemLineAmount(line))}
      </td>
      {!isBill && (
        <>
          <td className={cn(LINE_TABLE_CENTER_CELL, LINE_COL_BILLABLE)}>
            <div className="flex items-center justify-center">
              <Checkbox
                checked={line.billable}
                onCheckedChange={(v) => onUpdateItemLine(line.id, { billable: v === true })}
                aria-label="Billable"
              />
            </div>
          </td>
          <td className={LINE_TABLE_CELL}>
            <Select
              value={line.customerId || "__none__"}
              onValueChange={(v) =>
                onUpdateItemLine(line.id, {
                  customerId: v === "__none__" ? "" : v,
                })
              }
            >
              <SelectTrigger className={LINE_TABLE_SELECT}>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </td>
        </>
      )}
      <td className={cn(LINE_TABLE_CENTER_CELL, LINE_COL_CLASS)}>
        <ProductClassSelect
          value={line.className}
          onValueChange={(v) => onUpdateItemLine(line.id, { className: v })}
          classes={productClasses}
          triggerClassName={LINE_TABLE_CENTER_SELECT}
        />
      </td>
      <td className={cn("sticky right-0 z-10 bg-background", LINE_TABLE_CELL)}>
        <div className="flex items-center justify-end gap-0.5">
          {!isBill && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Duplicate line"
              onClick={() => onDuplicateItemLine(line.id)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Delete line"
            disabled={!canRemove}
            onClick={() => onRemoveItemLine(line.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
});
