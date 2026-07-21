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
  ImportDialogTable,
  ImportDialogTableMore,
  ImportDialogWarning,
} from "@/components/import-dialog-shell";
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

      if (replaceExisting && Array.isArray(result.added)) {
        replaceExpensesInStore(result.added as MockExpenseTransaction[]);
      } else {
        const reload = await fetch("/api/expense-transactions");
        const reloaded = (await reload.json()) as { expenses?: MockExpenseTransaction[] };
        replaceExpensesInStore(reloaded.expenses ?? []);
      }

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
    <ImportDialog open={open} onOpenChange={handleOpenChange} size="wide">
      <ImportDialogHeader
        title="Import expenses"
        description={
          <>
            QuickBooks columns: <span className="font-medium text-foreground">Date</span>,{" "}
            <span className="font-medium text-foreground">Type</span>,{" "}
            <span className="font-medium text-foreground">No.</span>,{" "}
            <span className="font-medium text-foreground">Payee</span>,{" "}
            <span className="font-medium text-foreground">Category</span>, and{" "}
            <span className="font-medium text-foreground">Total</span>. Category is matched to your
            chart of accounts by account name.
          </>
        }
        exportSteps={[
          "In QuickBooks: Expenses → Expenses (or Expense Transactions report).",
          "Export to Excel (.xls or .xlsx).",
          "Upload the file here.",
        ]}
      />

      <ImportDialogBody scrollable>
        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={SPREADSHEET_IMPORT_ACCEPT}
          file={file}
          parsing={parsing}
          disabled={importing}
          placeholder="Choose QuickBooks Expenses export (.xls, .xlsx)"
          onFileSelect={(selected) => void handleFileSelect(selected)}
        />

        {parseError ? <ImportDialogError message={parseError} /> : null}

        {preview ? (
          <div className="space-y-3">
            {preview.skippedRows.length > 0 ? (
              <ImportDialogWarning>
                {preview.skippedRows.length.toLocaleString()} row(s) will be skipped during import.
              </ImportDialogWarning>
            ) : null}

            <ImportDialogPreviewCard>
              <ImportDialogPreviewStat
                title={
                  <>
                    <span className="tabular-nums">{preview.rows.length.toLocaleString()}</span>{" "}
                    expenses ready to import
                  </>
                }
              />
            </ImportDialogPreviewCard>

            <ImportDialogTable minWidth={720}>
              <thead>
                <tr className="border-b border-border/70 bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Payee</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.rowNumber} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2 tabular-nums">{row.date}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.transactionType}</td>
                    <td className="px-3 py-2">{row.payee || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.category || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPHP(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </ImportDialogTable>
            <ImportDialogTableMore
              shown={previewRows.length}
              total={preview.rows.length}
              noun="expenses"
            />
          </div>
        ) : null}
      </ImportDialogBody>

      <ImportDialogFooter
        onCancel={() => handleOpenChange(false)}
        onImport={() => void handleImport()}
        importDisabled={!preview || parsing}
        importing={importing}
        importLabel={`Import ${(preview?.rows.length ?? 0).toLocaleString()} expenses`}
      />
    </ImportDialog>
  );
}
