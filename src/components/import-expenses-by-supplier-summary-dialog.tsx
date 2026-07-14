"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  parseExpensesBySupplierSummarySpreadsheet,
  saveImportedExpensesBySupplierSnapshot,
} from "@/lib/expenses-by-supplier-summary-import";
import { SPREADSHEET_IMPORT_ACCEPT } from "@/lib/import-spreadsheet-utils";
import { formatPHP } from "@/views/financial-report-shared";

type ImportExpensesBySupplierSummaryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
};

export function ImportExpensesBySupplierSummaryDialog({
  open,
  onOpenChange,
  onImported,
}: ImportExpensesBySupplierSummaryDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  function resetState() {
    setFile(null);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const snapshot = await parseExpensesBySupplierSummarySpreadsheet(file);
      const response = await fetch("/api/expenses-by-supplier-summary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const result = (await response.json()) as {
        error?: string;
        count?: number;
        rows?: typeof snapshot.rows;
        periodLabel?: string;
        totalAmount?: number;
      };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      const nextSnapshot = {
        periodLabel: result.periodLabel ?? snapshot.periodLabel,
        rows: result.rows ?? snapshot.rows,
        totalAmount: result.totalAmount ?? snapshot.totalAmount,
      };
      saveImportedExpensesBySupplierSnapshot(nextSnapshot);

      toast({
        title: "Expenses by Supplier Summary imported",
        description: `Saved ${nextSnapshot.rows.length} supplier${nextSnapshot.rows.length === 1 ? "" : "s"} to Supabase${
          nextSnapshot.totalAmount != null ? ` · TOTAL ${formatPHP(nextSnapshot.totalAmount)}` : ""
        }.`,
      });
      onImported?.(nextSnapshot.rows.length);
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not read the spreadsheet.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Expenses by Supplier Summary</DialogTitle>
          <DialogDescription>
            Export <strong>Expenses by Supplier Summary</strong> from QuickBooks to Excel so Expenses
            Performance matches QuickBooks totals (e.g. ₱3,048,146.76).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">QuickBooks Online</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                Reports → Expenses and suppliers →{" "}
                <span className="font-medium text-foreground">Expenses by Supplier Summary</span>
              </li>
              <li>Set the same Report period and Accrual method as this management report</li>
              <li>Export to Excel and upload here</li>
            </ol>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={SPREADSHEET_IMPORT_ACCEPT}
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {file ? file.name : "Choose Excel file"}
          </Button>
          {file ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Ready to import
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!file || importing} onClick={() => void handleImport()}>
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              "Import"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
