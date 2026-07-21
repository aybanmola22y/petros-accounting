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
  parseUnpaidBillsSpreadsheet,
  UNPAID_BILLS_IMPORT_ACCEPT,
  type ParseUnpaidBillsSpreadsheetResult,
} from "@/lib/import-unpaid-bills";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";
import {
  getUnpaidBillsSnapshot,
  replaceUnpaidBillsInStore,
  subscribeMockStore,
} from "@/lib/mock-data/store";

export type ImportUnpaidBillsResult = {
  added: UnpaidBill[];
  skipped: Array<{ supplier: string; reason: string; rowNumber?: number }>;
};

type ImportUnpaidBillsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replaceExisting?: boolean;
  onImported?: (result: ImportUnpaidBillsResult) => void;
};

export function ImportUnpaidBillsDialog({
  open,
  onOpenChange,
  replaceExisting = true,
  onImported,
}: ImportUnpaidBillsDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replace, setReplace] = useState(replaceExisting);
  const [preview, setPreview] = useState<ParseUnpaidBillsSpreadsheetResult | null>(null);
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
      const parsed = await parseUnpaidBillsSpreadsheet(selected);
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
      const response = await fetch("/api/unpaid-bills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace,
          rows: preview.rows.map((row) => ({
            rowNumber: row.rowNumber,
            supplierName: row.supplierName,
            dueDate: row.dueDate,
            billAmount: row.billAmount,
            openBalance: row.openBalance,
            status: row.status,
            billNo: row.billNo,
          })),
        }),
      });
      const result = (await response.json()) as ImportUnpaidBillsResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      const reload = await fetch("/api/unpaid-bills");
      const reloaded = (await reload.json()) as { unpaidBills?: UnpaidBill[] };
      replaceUnpaidBillsInStore(reloaded.unpaidBills ?? []);

      const importResult: ImportUnpaidBillsResult = {
        added: result.added ?? [],
        skipped: result.skipped ?? [],
      };
      onImported?.(importResult);
      toast({
        title: "Import complete",
        description: `${importResult.added.length} unpaid bill${importResult.added.length === 1 ? "" : "s"} imported${
          importResult.skipped.length > 0 ? ` · ${importResult.skipped.length} skipped` : ""
        }.`,
      });
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import unpaid bills.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  const existingBills = useSyncExternalStore(
    subscribeMockStore,
    getUnpaidBillsSnapshot,
    getUnpaidBillsSnapshot,
  );

  const invalidRows = preview?.skippedRows.length ?? 0;
  const totalOpenBalance = preview
    ? preview.rows.reduce((sum, row) => sum + row.openBalance, 0)
    : 0;

  const importNote = useMemo(() => {
    if (!preview) return null;
    if (replace) {
      if (existingBills.length > 0) {
        return `Replaces all ${existingBills.length} unpaid bill${existingBills.length === 1 ? "" : "s"} currently saved, then imports ${preview.rows.length} from the file.`;
      }
      return `Imports all ${preview.rows.length} unpaid bills from the file.`;
    }
    return `Appends ${preview.rows.length} bill${preview.rows.length === 1 ? "" : "s"} to existing unpaid bills.`;
  }, [preview, replace, existingBills.length]);

  return (
    <ImportDialog open={open} onOpenChange={handleOpenChange}>
      <ImportDialogHeader
        title="Import unpaid bills from QuickBooks"
        exportSteps={[
          "In QuickBooks: Expenses → Bills (Unpaid Bills report).",
          "Export to Excel (.xls).",
          "Expected columns: Supplier, Due Date, amount, balance, Status. Optional: No. / Bill number (needed for A/P Ageing Detail).",
        ]}
      />

      <ImportDialogBody>
        <ImportDialogReplaceOption
          id="replace-unpaid-bills"
          label="Replace existing unpaid bills"
          checked={replace}
          onCheckedChange={setReplace}
        />

        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={UNPAID_BILLS_IMPORT_ACCEPT}
          file={file}
          parsing={parsing}
          disabled={importing}
          placeholder="Choose .xls, .xlsx, or .csv file"
          hint="Supports QuickBooks Unpaid Bills exports"
          onFileSelect={(selected) => void handleFileSelect(selected)}
        />

        {parseError ? <ImportDialogError message={parseError} /> : null}

        {preview ? (
          <ImportDialogPreviewCard>
            <ImportDialogPreviewStat
              title={`${preview.rows.length} unpaid bill${preview.rows.length === 1 ? "" : "s"} ready to import`}
              details={
                <>
                  <p>
                    Sheet: {preview.sheetName} · Header row: {preview.headerRowNumber}
                  </p>
                  <p className="tabular-nums">
                    Total open balance: ₱
                    {totalOpenBalance.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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
            {preview.rows.length > 0 ? (
              <ImportDialogPreviewList>
                {preview.rows.slice(0, 5).map((row) => (
                  <p key={row.rowNumber}>
                    {row.supplierName} · due {row.dueDate} · ₱{row.openBalance.toLocaleString()}
                    {row.status ? ` · ${row.status}` : ""}
                  </p>
                ))}
                {preview.rows.length > 5 ? <p>…and {preview.rows.length - 5} more</p> : null}
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
        importLabel="Import unpaid bills"
      />
    </ImportDialog>
  );
}
