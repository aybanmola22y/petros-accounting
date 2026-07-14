"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RECURRING_TRANSACTION_TYPES,
  type RecurringTransactionType,
} from "@/lib/mock-data/recurring-transactions";

type RecurringTransactionTypeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (type: RecurringTransactionType) => void;
  defaultType?: RecurringTransactionType;
};

export function RecurringTransactionTypeDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultType = "Bill",
}: RecurringTransactionTypeDialogProps) {
  const [type, setType] = useState<RecurringTransactionType>(defaultType);

  useEffect(() => {
    if (open) setType(defaultType);
  }, [open, defaultType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="space-y-1 border-b px-6 py-5 text-left">
          <DialogTitle className="text-xl font-semibold">Select Transaction Type</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select the type of template to create
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="recurring-txn-type" className="text-sm font-semibold">
              Transaction Type
            </Label>
            <Select value={type} onValueChange={(v) => setType(v as RecurringTransactionType)}>
              <SelectTrigger id="recurring-txn-type" className="h-10 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[min(320px,70vh)]">
                {RECURRING_TRANSACTION_TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => onConfirm(type)}
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
