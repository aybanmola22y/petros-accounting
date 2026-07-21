"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ImportDialog,
  ImportDialogBody,
  ImportDialogError,
  ImportDialogFilePicker,
  ImportDialogFooter,
  ImportDialogHeader,
  ImportDialogPreviewCard,
  ImportDialogPreviewList,
  ImportDialogPreviewStat,
  ImportDialogReplaceOption,
} from "@/components/import-dialog-shell";
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

      if (Array.isArray(result.salesTransactions)) {
        replaceSalesTransactionsInStore(
          result.salesTransactions as Parameters<typeof replaceSalesTransactionsInStore>[0],
        );
      } else {
        const reload = await fetch("/api/sales-transactions");
        const reloaded = (await reload.json()) as {
          salesTransactions?: Parameters<typeof replaceSalesTransactionsInStore>[0];
        };
        replaceSalesTransactionsInStore(reloaded.salesTransactions ?? []);
      }

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
    <ImportDialog open={open} onOpenChange={handleOpenChange}>
      <ImportDialogHeader
        title="Import sales transactions from QuickBooks"
        exportSteps={[
          "In QuickBooks: Sales → All sales (or Sales Transactions report).",
          "Export to Excel (sales.xls).",
          "Expected columns: Date, Type, No., Customer, Memo, Amount, Status.",
        ]}
      />

      <ImportDialogBody>
        <ImportDialogReplaceOption
          id="replace-sales-transactions"
          label="Replace existing sales transactions"
          checked={replace}
          onCheckedChange={setReplace}
        />

        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={SALES_TRANSACTIONS_IMPORT_ACCEPT}
          file={file}
          parsing={parsing}
          disabled={importing}
          placeholder="Choose .xls, .xlsx, or .csv file"
          hint="Supports QuickBooks sales transaction exports"
          onFileSelect={(selected) => void handleFileSelect(selected)}
        />

        {parseError ? <ImportDialogError message={parseError} /> : null}

        {preview ? (
          <ImportDialogPreviewCard>
            <ImportDialogPreviewStat
              title={
                <>
                  {preview.rows.length.toLocaleString()} transaction
                  {preview.rows.length === 1 ? "" : "s"} ready to import
                </>
              }
              details={
                <>
                  <p>
                    Sheet: {preview.sheetName} · Header row: {preview.headerRowNumber}
                  </p>
                  {importNote ? <p>{importNote}</p> : null}
                  {invalidRows > 0 ? (
                    <p className="text-amber-700">
                      {invalidRows} row{invalidRows === 1 ? "" : "s"} skipped while reading the file
                    </p>
                  ) : null}
                </>
              }
            />
            {typeBreakdown.length > 0 ? (
              <ImportDialogPreviewList>
                {typeBreakdown.map(([type, count]) => (
                  <p key={type}>
                    {type}: {count.toLocaleString()}
                  </p>
                ))}
              </ImportDialogPreviewList>
            ) : null}
          </ImportDialogPreviewCard>
        ) : null}
      </ImportDialogBody>

      <ImportDialogFooter
        onCancel={() => handleOpenChange(false)}
        onImport={() => void handleImport()}
        importDisabled={!preview || preview.rows.length === 0 || parsing}
        importing={importing}
        importLabel="Import sales transactions"
      />
    </ImportDialog>
  );
}
