"use client";

import { memo, useCallback, useState } from "react";
import { ChevronDown, Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MockExpenseCategory } from "@/lib/mock-data/expense-categories";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import { cn } from "@/lib/utils";
import { formatPHP } from "@/views/financial-report-shared";

type LazyCategorySelectProps = {
  value: string;
  categories: MockExpenseCategory[];
  onValueChange: (value: string) => void;
};

function resolveCategoryDisplay(
  value: string,
  categories: MockExpenseCategory[],
): string {
  const normalized = value.trim();
  if (!normalized) return "";
  if (normalized.toLowerCase() === "--split--") return "--Split--";

  const match =
    categories.find((c) => c.name === normalized) ??
    categories.find(
      (c) =>
        c.name.localeCompare(normalized, undefined, { sensitivity: "base" }) === 0,
    );

  return match?.displayName ?? normalized;
}

function LazyCategorySelect({
  value,
  categories,
  onValueChange,
}: LazyCategorySelectProps) {
  const [open, setOpen] = useState(false);
  const displayLabel = resolveCategoryDisplay(value, categories);

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
      value={value.trim() || undefined}
      onValueChange={onValueChange}
    >
      <SelectTrigger className="h-8 w-full max-w-[200px] bg-background text-sm">
        <SelectValue placeholder="Select category">
          {displayLabel || undefined}
        </SelectValue>
      </SelectTrigger>
      {open ? (
        <SelectContent className="max-h-[min(320px,var(--radix-select-content-available-height))]">
          {categories.map((c) => (
            <SelectItem
              key={c.id}
              value={c.name}
              className={cn("py-2", c.isSubAccount && "pl-6")}
            >
              {c.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      ) : null}
    </Select>
  );
}

export type ExpenseTransactionRowProps = {
  expense: MockExpenseTransaction;
  index: number;
  isSelected: boolean;
  category: string;
  showSalesTax: boolean;
  expenseCategories: MockExpenseCategory[];
  onToggleSelect: (id: string) => void;
  onCategoryChange: (id: string, category: string) => void;
  onViewEdit: (expense: MockExpenseTransaction) => void;
  onDuplicate: (expense: MockExpenseTransaction) => void;
  onDelete: (id: string, payee: string) => void;
};

export const ExpenseTransactionRow = memo(function ExpenseTransactionRow({
  expense,
  index,
  isSelected,
  category,
  showSalesTax,
  expenseCategories,
  onToggleSelect,
  onCategoryChange,
  onViewEdit,
  onDuplicate,
  onDelete,
}: ExpenseTransactionRowProps) {
  const stripe = index % 2 === 0 ? "bg-background" : "bg-muted/15";

  const handleToggle = useCallback(() => {
    onToggleSelect(expense.id);
  }, [expense.id, onToggleSelect]);

  const handleCategoryChange = useCallback(
    (value: string) => {
      onCategoryChange(expense.id, value);
    },
    [expense.id, onCategoryChange],
  );

  const handleViewEdit = useCallback(() => {
    onViewEdit(expense);
  }, [expense, onViewEdit]);

  const handleDuplicate = useCallback(() => {
    onDuplicate(expense);
  }, [expense, onDuplicate]);

  const handleDelete = useCallback(() => {
    onDelete(expense.id, expense.payee);
  }, [expense.id, expense.payee, onDelete]);

  return (
    <tr
      className={cn(
        "border-b border-border/50 transition-colors hover:bg-muted/30",
        stripe,
        isSelected && "bg-primary/5",
      )}
    >
      <td className="px-4 py-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleToggle}
          aria-label={`Select ${expense.payee}`}
        />
      </td>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
        {expense.date}
      </td>
      <td className="px-4 py-3">{expense.type}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
        {expense.number}
      </td>
      <td className="px-4 py-3 font-medium capitalize">{expense.payee}</td>
      <td className="px-4 py-3">
        {expense.isSplit ? (
          <span className="text-muted-foreground italic">
            {category || "--Split--"}
          </span>
        ) : (
          <LazyCategorySelect
            value={category}
            categories={expenseCategories}
            onValueChange={handleCategoryChange}
          />
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
        {formatPHP(expense.totalBeforeTax)}
      </td>
      {showSalesTax && (
        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
          {formatPHP(expense.salesTax)}
        </td>
      )}
      <td className="px-4 py-3 text-right tabular-nums font-semibold">
        {formatPHP(expense.total)}
      </td>
      <td className="w-[1%] whitespace-nowrap px-4 py-3 text-left">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="link"
              size="sm"
              className="h-auto justify-start gap-1 px-0 text-primary font-medium"
            >
              View/Edit
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleViewEdit}>
              View details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleViewEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit transaction
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
});
