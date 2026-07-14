"use client";

import { AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type VoidInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function VoidInvoiceDialog({
  open,
  onOpenChange,
  onConfirm,
}: VoidInvoiceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md gap-5 text-center sm:rounded-lg">
        <div className="flex justify-center pt-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50">
            <AlertCircle className="h-7 w-7 text-orange-500" strokeWidth={2} />
          </div>
        </div>
        <AlertDialogTitle className="text-xl font-semibold text-center">
          Void invoice?
        </AlertDialogTitle>
        <AlertDialogDescription className="text-center text-[15px] leading-relaxed text-muted-foreground px-1">
          The invoice balance will go to zero, and your customer won&apos;t be able to pay it. You
          can&apos;t undo this.
        </AlertDialogDescription>
        <AlertDialogFooter className="flex-row justify-center gap-3 sm:justify-center sm:space-x-0">
          <AlertDialogCancel className="min-w-30 border-emerald-700 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-w-30 bg-emerald-700 hover:bg-emerald-800"
            onClick={onConfirm}
          >
            Void invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
