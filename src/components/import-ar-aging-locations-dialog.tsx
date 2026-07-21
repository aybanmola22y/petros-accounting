"use client";

import { useRef, useState } from "react";
import {
  ImportDialog,
  ImportDialogBody,
  ImportDialogFilePicker,
  ImportDialogFooter,
  ImportDialogHeader,
  ImportDialogTip,
} from "@/components/import-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import { importArAgingReport } from "@/lib/ar-aging-location-enrichment";
import { replaceSalesTransactionsInStore } from "@/lib/mock-data/store";
import { SPREADSHEET_IMPORT_ACCEPT } from "@/lib/import-spreadsheet-utils";

type ImportArAgingLocationsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
};

export function ImportArAgingLocationsDialog({
  open,
  onOpenChange,
  onImported,
}: ImportArAgingLocationsDialogProps) {
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
      const result = await importArAgingReport(file);
      if (result.salesTransactions) {
        replaceSalesTransactionsInStore(result.salesTransactions);
      }
      toast({
        title:
          result.kind === "summary"
            ? "AR Ageing Summary imported"
            : "AR Ageing Detail imported",
        description:
          result.kind === "summary"
            ? `Loaded ${result.count} customers for the A/R Aging Summary report.`
            : `Loaded ${result.count} open receivable rows with amounts and locations.`,
      });
      onImported?.(result.count);
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
        title="Import AR Ageing Report"
        description={
          <>
            Export either <strong>A/R Ageing Summary</strong> or <strong>A/R Ageing Detail</strong>{" "}
            from QuickBooks to Excel and import it here. The app detects which report you uploaded.
          </>
        }
        exportSteps={[
          "Reports → What you owe → A/R Ageing Summary or A/R Ageing Detail.",
          "Export to Excel and upload here.",
        ]}
      />

      <ImportDialogBody>
        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={SPREADSHEET_IMPORT_ACCEPT}
          file={file}
          disabled={importing}
          placeholder="Choose AR Ageing Summary or Detail export (.xls, .xlsx)"
          onFileSelect={(selected) => setFile(selected)}
        />
        <ImportDialogTip>
          Use <strong>Summary</strong> for Standard Reports → A/R Aging. Use <strong>Detail</strong>{" "}
          for Sales Performance and transaction-level locations.
        </ImportDialogTip>
      </ImportDialogBody>

      <ImportDialogFooter
        onCancel={() => handleOpenChange(false)}
        onImport={() => void handleImport()}
        importDisabled={!file}
        importing={importing}
        importLabel="Import report"
      />
    </ImportDialog>
  );
}
