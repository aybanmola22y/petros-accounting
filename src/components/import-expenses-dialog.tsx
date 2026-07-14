"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  parseExpensesSpreadsheet,
  type ParseExpensesSpreadsheetResult,
} from "@/lib/import-expenses";
import { SPREADSHEET_IMPORT_ACCEPT } from "@/lib/import-spreadsheet-utils";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import { replaceExpensesInStore } from "@/lib/mock-data/store";
import { formatPHP } from "@/views/financial-report-shared";

type ImportExpensesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replaceExisting: boolean;
  onImported?: (result: {
    added: number;
    skipped: number;
    unmatchedCategories: number;
  }) => void;
};

export function ImportExpensesDialog({
  open,
  onOpenChange,
  replaceExisting,
  onImported,
}: ImportExpensesDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParseExpensesSpreadsheetResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function resetState() {
    setFile(null);
    setPreview(null);
    setParseError(null);
    setParsing(false);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  }

  async function handleFileSelect(selected: File | null) {
    if (!selected) return;
    setFile(selected);
    setPreview(null);
    setParseError(null);
    setParsing(true);

    try {
      const parsed = await parseExpensesSpreadsheet(selected);
      setPreview(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read the file.";
      setParseError(message);
      toast({ title: "Could not read file", description: message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const response = await fetch("/api/expense-transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace: replaceExisting,
          rows: preview.rows.map((row) => ({
            rowNumber: row.rowNumber,
            date: row.date,
            transactionType: row.transactionType,
            referenceNumber: row.referenceNumber,
            payee: row.payee,
            category: row.category,
            totalBeforeTax: row.totalBeforeTax,
            salesTax: row.salesTax,
            total: row.total,
            isSplit: row.isSplit,
          })),
        }),
      });
      const result = (await response.json()) as {
        added?: unknown[];
        skipped?: unknown[];
        unmatchedCategories?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      const reload = await fetch("/api/expense-transactions");
      const reloaded = (await reload.json()) as { expenses?: MockExpenseTransaction[] };
      replaceExpensesInStore(reloaded.expenses ?? []);

      const added = result.added?.length ?? 0;
      const skipped = result.skipped?.length ?? 0;
      const unmatchedCategories = result.unmatchedCategories ?? 0;
      onImported?.({ added, skipped, unmatchedCategories });
      toast({
        title: "Expenses imported",
        description: `${added} transaction${added === 1 ? "" : "s"} saved to Supabase${
          unmatchedCategories ? ` · ${unmatchedCategories} unmatched categories` : ""
        }`,
      });
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Import failed.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  const previewRows = preview?.rows.slice(0, 8) ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import expenses</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            QuickBooks columns: <span className="font-medium text-foreground">Date</span>,{" "}
            <span className="font-medium text-foreground">Type</span>,{" "}
            <span className="font-medium text-foreground">No.</span>,{" "}
            <span className="font-medium text-foreground">Payee</span>,{" "}
            <span className="font-medium text-foreground">Category</span>, and{" "}
            <span className="font-medium text-foreground">Total</span>. Category is matched to your
            chart of accounts by account name.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept={SPREADSHEET_IMPORT_ACCEPT}
            className="hidden"
            onChange={(event) => void handleFileSelect(event.target.files?.[0] ?? null)}
          />

          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing || importing}
          >
            {parsing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {file ? file.name : "Choose QuickBooks Expenses export (.xls, .xlsx)"}
          </Button>

          {parseError ? (
            <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              {parseError}
            </p>
          ) : null}

          {preview ? (
            <div className="space-y-3">
              {preview.skippedRows.length > 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <p>
                    {preview.skippedRows.length} row(s) will be skipped during import.
                  </p>
                </div>
              ) : null}

              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="font-semibold tabular-nums">{preview.rows.length}</span> expenses
                  ready to import
                </span>
              </div>

              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Payee</th>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.rowNumber} className="border-b last:border-0">
                        <td className="px-3 py-2 tabular-nums">{row.date}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.transactionType}</td>
                        <td className="px-3 py-2">{row.payee || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.category || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatPHP(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > previewRows.length ? (
                <p className="text-xs text-muted-foreground">
                  Showing first {previewRows.length} of {preview.rows.length} expenses.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={!preview || importing || parsing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              `Import ${preview?.rows.length ?? 0} expenses`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
