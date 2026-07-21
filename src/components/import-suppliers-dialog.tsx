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
  parseSuppliersSpreadsheet,
  SUPPLIER_IMPORT_ACCEPT,
  type ParseSuppliersSpreadsheetResult,
} from "@/lib/import-suppliers";
import type { MockSupplier } from "@/lib/mock-data/suppliers";
import { replaceSuppliersInStore, getSuppliersSnapshot, subscribeMockStore } from "@/lib/mock-data/store";

export type ImportSuppliersResult = {
  added: MockSupplier[];
  skipped: Array<{ name: string; reason: string; rowNumber?: number }>;
};

type ImportSuppliersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replaceExisting?: boolean;
  onImported?: (result: ImportSuppliersResult) => void;
};

export function ImportSuppliersDialog({
  open,
  onOpenChange,
  replaceExisting = true,
  onImported,
}: ImportSuppliersDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replace, setReplace] = useState(replaceExisting);
  const [preview, setPreview] = useState<ParseSuppliersSpreadsheetResult | null>(null);
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
      const parsed = await parseSuppliersSpreadsheet(selected);
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
      const response = await fetch("/api/suppliers", {
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
            currency: row.currency,
            attachmentCount: row.attachmentCount,
            openingBalance: row.openingBalance,
          })),
        }),
      });
      const result = (await response.json()) as ImportSuppliersResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      const reload = await fetch("/api/suppliers");
      const reloaded = (await reload.json()) as { suppliers?: MockSupplier[] };
      replaceSuppliersInStore(reloaded.suppliers ?? []);

      const importResult: ImportSuppliersResult = {
        added: result.added ?? [],
        skipped: result.skipped ?? [],
      };
      onImported?.(importResult);
      toast({
        title: "Import complete",
        description: `${importResult.added.length} supplier${importResult.added.length === 1 ? "" : "s"} added${
          importResult.skipped.length > 0 ? ` · ${importResult.skipped.length} skipped` : ""
        }.`,
      });
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import suppliers.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  const existingSuppliers = useSyncExternalStore(
    subscribeMockStore,
    getSuppliersSnapshot,
    getSuppliersSnapshot,
  );

  const invalidRows = preview?.skippedRows.length ?? 0;

  const duplicateCount = useMemo(() => {
    if (!preview || replace) return 0;
    const existing = new Set(existingSuppliers.map((s) => s.name.toLowerCase()));
    return preview.rows.filter((row) => existing.has(row.name.toLowerCase())).length;
  }, [preview, replace, existingSuppliers]);

  const importableCount = preview ? preview.rows.length - duplicateCount : 0;

  const importNote = useMemo(() => {
    if (!preview) return null;
    if (replace) {
      if (existingSuppliers.length > 0) {
        return `Replaces all ${existingSuppliers.length} supplier${existingSuppliers.length === 1 ? "" : "s"} currently saved, then imports ${preview.rows.length} from the file.`;
      }
      return `Imports all ${preview.rows.length} suppliers from the file.`;
    }
    if (duplicateCount > 0) {
      return `${duplicateCount} name${duplicateCount === 1 ? "" : "s"} already in your database will be skipped · ${importableCount} new`;
    }
    return null;
  }, [preview, replace, existingSuppliers.length, duplicateCount, importableCount]);

  return (
    <ImportDialog open={open} onOpenChange={handleOpenChange}>
      <ImportDialogHeader
        title="Import suppliers from QuickBooks"
        exportSteps={[
          "In QuickBooks: Expenses → Suppliers.",
          "Export the supplier list to Excel (.xls).",
          "Expected columns: Supplier, Company name, Street Address, City, State, Country, Zip, Phone, Email, Currency, Attachments, Open Balance.",
        ]}
      />

      <ImportDialogBody>
        <ImportDialogReplaceOption
          id="replace-suppliers"
          label="Replace existing suppliers"
          checked={replace}
          onCheckedChange={setReplace}
        />

        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={SUPPLIER_IMPORT_ACCEPT}
          file={file}
          parsing={parsing}
          disabled={importing}
          placeholder="Choose .xls, .xlsx, or .csv file"
          hint="Supports QuickBooks vendor/supplier exports"
          onFileSelect={(selected) => void handleFileSelect(selected)}
        />

        {parseError ? <ImportDialogError message={parseError} /> : null}

        {preview ? (
          <ImportDialogPreviewCard>
            <ImportDialogPreviewStat
              title={
                replace
                  ? `${preview.rows.length} supplier${preview.rows.length === 1 ? "" : "s"} ready to import`
                  : `${importableCount} supplier${importableCount === 1 ? "" : "s"} ready to import`
              }
              details={
                <>
                  <p>
                    Sheet: {preview.sheetName} · Header row: {preview.headerRowNumber}
                  </p>
                  {importNote ? (
                    <p className={duplicateCount > 0 && !replace ? "text-amber-700" : undefined}>
                      {importNote}
                    </p>
                  ) : null}
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
                    {row.name}
                    {row.email ? ` · ${row.email}` : ""}
                    {row.openingBalance > 0 ? ` · ${row.openingBalance.toLocaleString()}` : ""}
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
        importDisabled={importableCount === 0 || parsing}
        importing={importing}
        importLabel="Import suppliers"
      />
    </ImportDialog>
  );
}
