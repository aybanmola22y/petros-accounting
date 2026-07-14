"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
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
  parseSalesTransactionLinesSpreadsheet,
  SALES_TRANSACTION_LINES_IMPORT_ACCEPT,
  type ParseSalesTransactionLinesResult,
} from "@/lib/import-sales-transaction-lines";
import { replaceSalesTransactionLinesInStore } from "@/lib/mock-data";
import type { MockInvoiceLine } from "@/lib/mock-data/types";

type ImportSalesTransactionLinesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (result: { inserted: number; invoiceCount: number }) => void;
};

export function ImportSalesTransactionLinesDialog({
  open,
  onOpenChange,
  onImported,
}: ImportSalesTransactionLinesDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParseSalesTransactionLinesResult | null>(null);
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
      const parsed = await parseSalesTransactionLinesSpreadsheet(selected);
      setPreview(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read the spreadsheet.";
      setParseError(message);
      toast({ title: "Import failed", description: message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);

    try {
      const response = await fetch("/api/sales-transaction-lines", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: preview.rows.map((row) => ({
            referenceNumber: row.referenceNumber,
            productService: row.productService,
            description: row.description,
            quantity: row.quantity,
            rate: row.rate,
            amount: row.amount,
            sortOrder: row.sortOrder,
          })),
        }),
      });
      const result = (await response.json()) as {
        inserted?: number;
        invoiceCount?: number;
        lines?: Record<string, MockInvoiceLine[]>;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      replaceSalesTransactionLinesInStore(result.lines ?? {});

      const inserted = result.inserted ?? 0;
      const invoiceCount = result.invoiceCount ?? 0;
      onImported?.({ inserted, invoiceCount });
      toast({
        title: "Invoice line items imported",
        description: `${inserted.toLocaleString()} line${inserted === 1 ? "" : "s"} across ${invoiceCount.toLocaleString()} invoice${invoiceCount === 1 ? "" : "s"}.`,
      });
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import line items.",
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
          <DialogTitle>Import invoice line items from QuickBooks</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Sales by Product/Service Detail</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                In QuickBooks:{" "}
                <span className="font-medium text-foreground">Reports → Sales and customers → Sales by Product/Service Detail</span>
              </li>
              <li>Set Report period to All Dates.</li>
              <li>Run report → Export to Excel.</li>
              <li>Upload that file here. It fills the Product/Service lines on each invoice.</li>
            </ol>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={SALES_TRANSACTION_LINES_IMPORT_ACCEPT}
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
                  Replaces existing imported invoice line items
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
                    {preview.rows.length.toLocaleString()} line item
                    {preview.rows.length === 1 ? "" : "s"} ready to import
                  </p>
                  <p className="text-muted-foreground">
                    {preview.invoiceCount.toLocaleString()} invoice
                    {preview.invoiceCount === 1 ? "" : "s"} · {preview.productCount.toLocaleString()} product
                    {preview.productCount === 1 ? "" : "s"}/service
                    {preview.productCount === 1 ? "" : "s"}
                  </p>
                  <p className="text-muted-foreground">
                    Sheet: {preview.sheetName} · Header row: {preview.headerRowNumber}
                  </p>
                  {preview.skippedRows.length > 0 && (
                    <p className="text-amber-700">
                      {preview.skippedRows.length} row
                      {preview.skippedRows.length === 1 ? "" : "s"} skipped while reading the file
                    </p>
                  )}
                </div>
              </div>
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
              "Import line items"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
