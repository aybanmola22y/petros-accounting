"use client";

import {
  ChevronDown,
  FileText,
  Package,
  Pencil,
  Receipt,
  ScrollText,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SupplierActionSplitButtonProps = {
  onCreateBill: () => void;
  onCreateExpense: () => void;
  onWriteCheque: () => void;
  onCreateItemReceipt: () => void;
  onViewProfile?: () => void;
  onEditSupplier?: () => void;
  onMakeInactive: () => void;
  className?: string;
};

export function SupplierActionSplitButton({
  onCreateBill,
  onCreateExpense,
  onWriteCheque,
  onCreateItemReceipt,
  onViewProfile,
  onEditSupplier,
  onMakeInactive,
  className,
}: SupplierActionSplitButtonProps) {
  return (
    <div className={cn("inline-flex items-center", className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        onClick={onCreateBill}
      >
        <FileText className="h-3.5 w-3.5" />
        Create bill
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground hover:bg-muted/70"
            aria-label="More supplier actions"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuItem className="cursor-pointer" onClick={onCreateExpense}>
            <Receipt className="mr-2 h-4 w-4" />
            Create Expense
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={onWriteCheque}>
            <ScrollText className="mr-2 h-4 w-4" />
            Write cheque
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={onCreateItemReceipt}>
            <Package className="mr-2 h-4 w-4" />
            Create item receipt
          </DropdownMenuItem>
          {onViewProfile && (
            <DropdownMenuItem className="cursor-pointer" onClick={onViewProfile}>
              <User className="mr-2 h-4 w-4" />
              View supplier profile
            </DropdownMenuItem>
          )}
          {onEditSupplier && (
            <DropdownMenuItem className="cursor-pointer" onClick={onEditSupplier}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit supplier
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" onClick={onMakeInactive}>
            Make inactive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
