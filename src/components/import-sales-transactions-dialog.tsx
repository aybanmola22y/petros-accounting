"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  parseSalesTransactionsSpreadsheet,
  SALES_TRANSACTIONS_IMPORT_ACCEPT,
  type ParseSalesTransactionsSpreadsheetResult,
} from "@/lib/import-sales-transactions";
import {
  getSalesTransactionsSnapshot,
  replaceSalesTransactionsInStore,
  subscribeMockStore,
} from "@/lib/mock-data/store";

export type ImportSalesTransactionsResult = {
  added: number;
  skipped: Array<{ customer: string; reason: string; rowNumber?: number }>;
};

type ImportSalesTransactionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replaceExisting?: boolean;
  onImported?: (result: ImportSalesTransactionsResult) => void;
};

export function ImportSalesTransactionsDialog({
  open,
  onOpenChange,
  replaceExisting = true,
  onImported,
}: ImportSalesTransactionsDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replace, setReplace] = useState(replaceExisting);
  const [preview, setPreview] = useState<ParseSalesTransactionsSpreadsheetResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function resetState() {
    setFile(null);
    setPreview(null);
    setParseError(null);
    setParsing(false);
    setImporting(false);
    setReplace(replaceExisting);
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
      const parsed = await parseSalesTransactionsSpreadsheet(selected);
      setPreview(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read the spreadsheet.";
      setParseError(message);
      toast({
        title: "Import failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);

    try {
      const response = await fetch("/api/sales-transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace,
          rows: preview.rows.map((row) => ({
            rowNumber: row.rowNumber,
            date: row.date,
            transactionType: row.transactionType,
            referenceNumber: row.referenceNumber,
            customer: row.customer,
            memo: row.memo,
            location: row.location,
            incomeAccount: row.incomeAccount,
            amount: row.amount,
            status: row.status,
          })),
        }),
      });
      const result = (await response.json()) as ImportSalesTransactionsResult & {
        error?: string;
        salesTransactions?: unknown[];
      };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      const reload = await fetch("/api/sales-transactions");
      const reloaded = (await reload.json()) as {
        salesTransactions?: Parameters<typeof replaceSalesTransactionsInStore>[0];
      };
      replaceSalesTransactionsInStore(reloaded.salesTransactions ?? []);

      const importResult: ImportSalesTransactionsResult = {
        added: result.added ?? 0,
        skipped: result.skipped ?? [],
      };
      onImported?.(importResult);
      toast({
        title: "Import complete",
        description: `${importResult.added.toLocaleString()} sales transaction${importResult.added === 1 ? "" : "s"} imported${
          importResult.skipped.length > 0 ? ` · ${importResult.skipped.length} skipped` : ""
        }.`,
      });
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import sales transactions.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  const existingSales = useSyncExternalStore(
    subscribeMockStore,
    getSalesTransactionsSnapshot,
    getSalesTransactionsSnapshot,
  );

  const invalidRows = preview?.skippedRows.length ?? 0;
  const typeBreakdown = useMemo(() => {
    if (!preview) return [];
    const counts = new Map<string, number>();
    for (const row of preview.rows) {
      counts.set(row.transactionType, (counts.get(row.transactionType) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [preview]);

  const importNote = useMemo(() => {
    if (!preview) return null;
    if (replace) {
      if (existingSales.length > 0) {
        return `Replaces all ${existingSales.length.toLocaleString()} sales transaction${existingSales.length === 1 ? "" : "s"} currently saved, then imports ${preview.rows.length.toLocaleString()} from the file.`;
      }
      return `Imports all ${preview.rows.length.toLocaleString()} sales transactions from the file.`;
    }
    return `Appends ${preview.rows.length.toLocaleString()} transactions to existing sales data.`;
  }, [preview, replace, existingSales.length]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import sales transactions from QuickBooks</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">QuickBooks Online export</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                In QuickBooks: <span className="font-medium text-foreground">Sales → All sales</span>{" "}
                (or Sales Transactions report).
              </li>
              <li>Export to Excel (sales.xls).</li>
              <li>
                Expected columns: Date, Type, No., Customer, Memo, Amount, Status.
              </li>
              <li>Upload the file here.</li>
            </ol>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="replace-sales-transactions"
              checked={replace}
              onCheckedChange={(checked) => setReplace(checked === true)}
            />
            <Label htmlFor="replace-sales-transactions" className="text-sm font-normal cursor-pointer">
              Replace existing sales transactions
            </Label>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={SALES_TRANSACTIONS_IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => void handleFileSelect(e.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            className="flex min-h-[140px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/35 bg-muted/10 px-4 py-6 text-center hover:bg-muted/30 transition-colors disabled:opacity-60"
            disabled={parsing || importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {parsing ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm font-medium">Reading spreadsheet…</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-primary">
                  {file ? file.name : "Choose .xls, .xlsx, or .csv file"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Supports QuickBooks sales transaction exports
                </span>
              </>
            )}
          </button>

          {parseError && <p className="text-sm text-destructive">{parseError}</p>}

          {preview && (
            <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    {preview.rows.length.toLocaleString()} transaction
                    {preview.rows.length === 1 ? "" : "s"} ready to import
                  </p>
                  <p className="text-muted-foreground">
                    Sheet: {preview.sheetName} · Header row: {preview.headerRowNumber}
                  </p>
                  {importNote && <p className="text-muted-foreground">{importNote}</p>}
                  {invalidRows > 0 && (
                    <p className="text-amber-700">
                      {invalidRows} row{invalidRows === 1 ? "" : "s"} skipped while reading the file
                    </p>
                  )}
                </div>
              </div>
              {typeBreakdown.length > 0 && (
                <div className="border-t pt-2 text-xs text-muted-foreground max-h-28 overflow-y-auto space-y-1">
                  {typeBreakdown.map(([type, count]) => (
                    <p key={type}>
                      {type}: {count.toLocaleString()}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleImport()}
            disabled={!preview || preview.rows.length === 0 || parsing || importing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              "Import sales transactions"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
