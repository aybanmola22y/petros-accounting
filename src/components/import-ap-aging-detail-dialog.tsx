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
  parseApAgingDetailSpreadsheet,
  saveImportedApAgingDetailSnapshot,
} from "@/lib/ap-aging-detail-import";
import { SPREADSHEET_IMPORT_ACCEPT } from "@/lib/import-spreadsheet-utils";
import { formatPHP } from "@/views/financial-report-shared";

type ImportApAgingDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
};

export function ImportApAgingDetailDialog({
  open,
  onOpenChange,
  onImported,
}: ImportApAgingDetailDialogProps) {
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
      const snapshot = await parseApAgingDetailSpreadsheet(file);
      const response = await fetch("/api/ap-aging-detail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const result = (await response.json()) as {
        error?: string;
        count?: number;
        lines?: typeof snapshot.lines;
        asOf?: string;
        totalAmount?: number;
        totalOpenBalance?: number;
      };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      const nextSnapshot = {
        asOf: result.asOf ?? snapshot.asOf,
        lines: result.lines ?? snapshot.lines,
        totalAmount: result.totalAmount ?? snapshot.totalAmount,
        totalOpenBalance: result.totalOpenBalance ?? snapshot.totalOpenBalance,
      };
      saveImportedApAgingDetailSnapshot(nextSnapshot);

      toast({
        title: "A/P Ageing Detail imported",
        description: `Saved ${nextSnapshot.lines.length} open payable rows to Supabase${
          nextSnapshot.totalOpenBalance != null
            ? ` · TOTAL open ${formatPHP(nextSnapshot.totalOpenBalance)}`
            : ""
        }.`,
      });
      onImported?.(nextSnapshot.lines.length);
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
        title="Import A/P Ageing Detail"
        description={
          <>
            Export <strong>A/P Ageing Detail</strong> from QuickBooks to Excel and import it here
            so Expenses Performance matches QuickBooks (No., Location, Amount / Open Balance).
          </>
        }
        exportSteps={[
          "Reports → What you owe → A/P Ageing Detail.",
          "Set as of date (e.g. Today or Dec 31, 2026) → Export to Excel.",
          "Upload the file here.",
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
