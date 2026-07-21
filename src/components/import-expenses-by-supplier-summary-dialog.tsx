"use client";

import { useRef, useState } from "react";
import {
  ImportDialog,
  ImportDialogBody,
  ImportDialogFilePicker,
  ImportDialogFileReady,
  ImportDialogFooter,
  ImportDialogHeader,
} from "@/components/import-dialog-shell";
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
    <ImportDialog open={open} onOpenChange={handleOpenChange}>
      <ImportDialogHeader
        title="Import Expenses by Supplier Summary"
        description={
          <>
            Export <strong>Expenses by Supplier Summary</strong> from QuickBooks to Excel so Expenses
            Performance matches QuickBooks totals (e.g. ₱3,048,146.76).
          </>
        }
        exportSteps={[
          "Reports → Expenses and suppliers → Expenses by Supplier Summary.",
          "Set the same Report period and Accrual method as this management report.",
          "Export to Excel and upload here.",
        ]}
      />

      <ImportDialogBody>
        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={SPREADSHEET_IMPORT_ACCEPT}
          file={file}
          disabled={importing}
          placeholder="Choose Excel file"
          onFileSelect={(selected) => setFile(selected)}
        />
        {file ? <ImportDialogFileReady /> : null}
      </ImportDialogBody>

      <ImportDialogFooter
        onCancel={() => handleOpenChange(false)}
        onImport={() => void handleImport()}
        importDisabled={!file}
        importing={importing}
        importLabel="Import"
      />
    </ImportDialog>
  );
}
