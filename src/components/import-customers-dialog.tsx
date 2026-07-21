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
  ImportDialogPreviewStat,
  ImportDialogReplaceOption,
} from "@/components/import-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import {
  CUSTOMERS_IMPORT_ACCEPT,
  parseCustomersSpreadsheet,
  type ParseCustomersSpreadsheetResult,
} from "@/lib/import-customers";
import type { MockCustomer } from "@/lib/mock-data/types";
import {
  getCustomersSnapshot,
  replaceCustomersInStore,
  subscribeMockStore,
} from "@/lib/mock-data/store";

export type ImportCustomersResult = {
  added: MockCustomer[];
  skipped: Array<{ name: string; reason: string; rowNumber?: number }>;
};

type ImportCustomersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replaceExisting?: boolean;
  onImported?: (result: ImportCustomersResult) => void;
};

export function ImportCustomersDialog({
  open,
  onOpenChange,
  replaceExisting = true,
  onImported,
}: ImportCustomersDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replace, setReplace] = useState(replaceExisting);
  const [preview, setPreview] = useState<ParseCustomersSpreadsheetResult | null>(null);
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
      const parsed = await parseCustomersSpreadsheet(selected);
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
      const response = await fetch("/api/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace,
          rows: preview.rows.map((row) => ({
            rowNumber: row.rowNumber,
            name: row.name,
            companyName: row.companyName,
            streetAddress: row.streetAddress,
            city: row.city,
            state: row.state,
            country: row.country,
            zip: row.zip,
            phone: row.phone,
            email: row.email,
            attachmentCount: row.attachmentCount,
            openBalance: row.openBalance,
          })),
        }),
      });
      const result = (await response.json()) as ImportCustomersResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      const reload = await fetch("/api/customers");
      const reloaded = (await reload.json()) as { customers?: MockCustomer[] };
      replaceCustomersInStore(reloaded.customers ?? []);

      const importResult: ImportCustomersResult = {
        added: result.added ?? [],
        skipped: result.skipped ?? [],
      };
      onImported?.(importResult);
      toast({
        title: "Import complete",
        description: `${importResult.added.length.toLocaleString()} customer${importResult.added.length === 1 ? "" : "s"} added${
          importResult.skipped.length > 0 ? ` · ${importResult.skipped.length} skipped` : ""
        }.`,
      });
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import customers.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  const existingCustomers = useSyncExternalStore(
    subscribeMockStore,
    getCustomersSnapshot,
    getCustomersSnapshot,
  );

  const invalidRows = preview?.skippedRows.length ?? 0;

  const duplicateCount = useMemo(() => {
    if (!preview || replace) return 0;
    const existing = new Set(existingCustomers.map((c) => c.name.toLowerCase()));
    return preview.rows.filter((row) => existing.has(row.name.toLowerCase())).length;
  }, [preview, replace, existingCustomers]);

  const importableCount = preview ? preview.rows.length - duplicateCount : 0;
  const previewTotalBalance = preview
    ? preview.rows.reduce((sum, row) => sum + row.openBalance, 0)
    : 0;

  const importNote = useMemo(() => {
    if (!preview) return null;
    if (replace) {
      if (existingCustomers.length > 0) {
        return `Replaces all ${existingCustomers.length.toLocaleString()} customer${existingCustomers.length === 1 ? "" : "s"} currently saved, then imports ${preview.rows.length.toLocaleString()} from the file.`;
      }
      return `Imports all ${preview.rows.length.toLocaleString()} customers from the file.`;
    }
    if (duplicateCount > 0) {
      return `${duplicateCount.toLocaleString()} name${duplicateCount === 1 ? "" : "s"} already in your database will be skipped · ${importableCount.toLocaleString()} new`;
    }
    return null;
  }, [preview, replace, existingCustomers.length, duplicateCount, importableCount]);

  return (
    <ImportDialog open={open} onOpenChange={handleOpenChange}>
      <ImportDialogHeader
        title="Import customers from QuickBooks"
        exportSteps={[
          "In QuickBooks: Sales & Get Paid → Customers & leads → Customers.",
          "Export to Excel (Customers.xls).",
          "Expected columns: Name, Company name, Street Address, City, State, Country, Zip, Phone, Email, Attachments, Open balance.",
        ]}
      />

      <ImportDialogBody>
        <ImportDialogReplaceOption
          id="replace-customers"
          label="Replace existing customers"
          checked={replace}
          onCheckedChange={setReplace}
        />

        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={CUSTOMERS_IMPORT_ACCEPT}
          file={file}
          parsing={parsing}
          disabled={importing}
          placeholder="Choose .xls, .xlsx, or .csv file"
          hint="Supports QuickBooks customer exports"
          onFileSelect={(selected) => void handleFileSelect(selected)}
        />

        {parseError ? <ImportDialogError message={parseError} /> : null}

        {preview ? (
          <ImportDialogPreviewCard>
            <ImportDialogPreviewStat
              title={
                <>
                  {preview.rows.length.toLocaleString()} customer
                  {preview.rows.length === 1 ? "" : "s"} ready to import
                </>
              }
              details={
                <>
                  <p>
                    Sheet: {preview.sheetName} · header row {preview.headerRowNumber}
                  </p>
                  {invalidRows > 0 ? (
                    <p className="text-amber-700">
                      {invalidRows} row{invalidRows === 1 ? "" : "s"} skipped while reading the file
                    </p>
                  ) : null}
                  <p className="tabular-nums">
                    Open balance in file: ₱
                    {previewTotalBalance.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  {importNote ? <p>{importNote}</p> : null}
                </>
              }
            />
          </ImportDialogPreviewCard>
        ) : null}
      </ImportDialogBody>

      <ImportDialogFooter
        onCancel={() => handleOpenChange(false)}
        onImport={() => void handleImport()}
        importDisabled={!preview || importableCount === 0}
        importing={importing}
        importLabel={`Import ${importableCount > 0 ? importableCount.toLocaleString() : ""} customers`}
      />
    </ImportDialog>
  );
}
