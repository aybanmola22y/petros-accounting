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
  parseBalanceSheetSummarySpreadsheet,
  type ImportedBalanceSheetSnapshot,
} from "@/lib/balance-sheet-summary-import";
import { SPREADSHEET_IMPORT_ACCEPT } from "@/lib/import-spreadsheet-utils";

type ImportBalanceSheetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
};

export function ImportBalanceSheetDialog({
  open,
  onOpenChange,
  onImported,
}: ImportBalanceSheetDialogProps) {
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
      const snapshot: ImportedBalanceSheetSnapshot =
        await parseBalanceSheetSummarySpreadsheet(file);
      const response = await fetch("/api/balance-sheet-summary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const result = (await response.json()) as { error?: string; count?: number };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      window.dispatchEvent(new Event("balance-sheet-summary-imported"));
      toast({
        title: "Balance Sheet imported",
        description: `Loaded ${result.count ?? snapshot.rows.length} account rows${snapshot.periodLabel ? ` ${snapshot.periodLabel}` : ""}. Re-import anytime to refresh from QuickBooks. New transactions update balances automatically.`,
      });
      onImported?.(result.count ?? snapshot.rows.length);
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
        title="Import Balance Sheet"
        description={
          <>
            Import the QuickBooks <strong>Balance Sheet report</strong> (Reports → Balance Sheet).
            Set <strong>All Dates</strong> and <strong>Accrual</strong> before exporting. The report
            displays your import exactly — re-import to refresh from QuickBooks.
          </>
        }
        exportSteps={[
          "Reports → Balance Sheet → set All Dates and Accrual.",
          "Export to Excel and upload here.",
        ]}
      />

      <ImportDialogBody>
        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={SPREADSHEET_IMPORT_ACCEPT}
          file={file}
          disabled={importing}
          placeholder="Choose Balance Sheet file"
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
