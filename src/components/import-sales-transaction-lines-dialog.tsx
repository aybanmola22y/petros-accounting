"use client";

import { useRef, useState } from "react";
import {
  ImportDialog,
  ImportDialogBody,
  ImportDialogError,
  ImportDialogFilePicker,
  ImportDialogFooter,
  ImportDialogHeader,
  ImportDialogPreviewCard,
  ImportDialogPreviewStat,
} from "@/components/import-dialog-shell";
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
    <ImportDialog open={open} onOpenChange={handleOpenChange}>
      <ImportDialogHeader
        title="Import invoice line items from QuickBooks"
        exportSteps={[
          "In QuickBooks: Reports → Sales and customers → Sales by Product/Service Detail.",
          "Set Report period to All Dates.",
          "Run report → Export to Excel.",
          "Upload that file here. It fills the Product/Service lines on each invoice.",
        ]}
      />

      <ImportDialogBody>
        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={SALES_TRANSACTION_LINES_IMPORT_ACCEPT}
          file={file}
          parsing={parsing}
          disabled={importing}
          placeholder="Choose .xls, .xlsx, or .csv file"
          hint="Replaces existing imported invoice line items"
          onFileSelect={(selected) => void handleFileSelect(selected)}
        />

        {parseError ? <ImportDialogError message={parseError} /> : null}

        {preview ? (
          <ImportDialogPreviewCard>
            <ImportDialogPreviewStat
              title={
                <>
                  {preview.rows.length.toLocaleString()} line item
                  {preview.rows.length === 1 ? "" : "s"} ready to import
                </>
              }
              details={
                <>
                  <p>
                    {preview.invoiceCount.toLocaleString()} invoice
                    {preview.invoiceCount === 1 ? "" : "s"} ·{" "}
                    {preview.productCount.toLocaleString()} product
                    {preview.productCount === 1 ? "" : "s"}/service
                    {preview.productCount === 1 ? "" : "s"}
                  </p>
                  <p>
                    Sheet: {preview.sheetName} · Header row: {preview.headerRowNumber}
                  </p>
                  {preview.skippedRows.length > 0 ? (
                    <p className="text-amber-700">
                      {preview.skippedRows.length} row
                      {preview.skippedRows.length === 1 ? "" : "s"} skipped while reading the file
                    </p>
                  ) : null}
                </>
              }
            />
          </ImportDialogPreviewCard>
        ) : null}
      </ImportDialogBody>

      <ImportDialogFooter
        onCancel={() => handleOpenChange(false)}
        onImport={() => void handleImport()}
        importDisabled={!preview || preview.rows.length === 0 || parsing}
        importing={importing}
        importLabel="Import line items"
      />
    </ImportDialog>
  );
}
