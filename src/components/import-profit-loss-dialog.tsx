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
  parseProfitLossSummarySpreadsheet,
  type ImportedProfitLossSnapshot,
} from "@/lib/profit-loss-summary-import";
import { SPREADSHEET_IMPORT_ACCEPT } from "@/lib/import-spreadsheet-utils";

type ImportProfitLossDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
};

export function ImportProfitLossDialog({
  open,
  onOpenChange,
  onImported,
}: ImportProfitLossDialogProps) {
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
      const snapshot: ImportedProfitLossSnapshot = await parseProfitLossSummarySpreadsheet(file);
      const response = await fetch("/api/profit-loss-summary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const result = (await response.json()) as { error?: string; count?: number };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      window.dispatchEvent(new Event("profit-loss-summary-imported"));
      toast({
        title: "Profit and Loss imported",
        description: `Loaded ${result.count ?? snapshot.rows.length} account rows${snapshot.periodLabel ? ` for ${snapshot.periodLabel}` : ""}. New transactions will update this report automatically.`,
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
        title="Import Profit and Loss"
        description={
          <>
            Import your QuickBooks <strong>Profit and Loss</strong> once to set the correct account
            breakdown. After that, new sales and expenses you add in this app automatically update the
            report — you only need to re-import when you want to refresh from QuickBooks.
          </>
        }
        exportSteps={[
          "In QuickBooks: Reports → Profit and Loss.",
          "Set the report period and Accrual method to match this app.",
          "Export to Excel and upload here.",
        ]}
      />

      <ImportDialogBody>
        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={SPREADSHEET_IMPORT_ACCEPT}
          file={file}
          disabled={importing}
          placeholder="Choose Profit and Loss file"
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
