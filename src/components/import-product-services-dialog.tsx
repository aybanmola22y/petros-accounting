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
  parseProductServicesSpreadsheet,
  PRODUCT_SERVICE_IMPORT_ACCEPT,
  type ParseProductServicesSpreadsheetResult,
} from "@/lib/import-product-services";
import type { MockProductService } from "@/lib/mock-data/products-services";
import {
  getProductServicesSnapshot,
  replaceProductServicesInStore,
  subscribeMockStore,
} from "@/lib/mock-data/store";

export type ImportProductServicesResult = {
  added: MockProductService[];
  skipped: Array<{ name: string; reason: string; rowNumber?: number }>;
};

type ImportProductServicesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replaceExisting?: boolean;
  onImported?: (result: ImportProductServicesResult) => void;
};

export function ImportProductServicesDialog({
  open,
  onOpenChange,
  replaceExisting = true,
  onImported,
}: ImportProductServicesDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replace, setReplace] = useState(replaceExisting);
  const [preview, setPreview] = useState<ParseProductServicesSpreadsheetResult | null>(null);
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
      const parsed = await parseProductServicesSpreadsheet(selected);
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
      const response = await fetch("/api/product-services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace,
          rows: preview.rows.map((row) => ({
            rowNumber: row.rowNumber,
            name: row.name,
            itemType: row.itemType,
            sku: row.sku,
            category: row.category,
            className: row.className,
            salesDescription: row.salesDescription,
            salesPrice: row.salesPrice,
            cost: row.cost,
            qtyOnHand: row.qtyOnHand,
            reorderPoint: row.reorderPoint,
          })),
        }),
      });
      const result = (await response.json()) as ImportProductServicesResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      const reload = await fetch("/api/product-services");
      const reloaded = (await reload.json()) as { productServices?: MockProductService[] };
      replaceProductServicesInStore(reloaded.productServices ?? []);

      const importResult: ImportProductServicesResult = {
        added: result.added ?? [],
        skipped: result.skipped ?? [],
      };
      onImported?.(importResult);
      toast({
        title: "Import complete",
        description: `${importResult.added.length} item${importResult.added.length === 1 ? "" : "s"} added${
          importResult.skipped.length > 0 ? ` · ${importResult.skipped.length} skipped` : ""
        }.`,
      });
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import products and services.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  const existingProducts = useSyncExternalStore(
    subscribeMockStore,
    getProductServicesSnapshot,
    getProductServicesSnapshot,
  );

  const invalidRows = preview?.skippedRows.length ?? 0;

  const duplicateCount = useMemo(() => {
    if (!preview || replace) return 0;
    const existing = new Set(existingProducts.map((p) => p.name.toLowerCase()));
    return preview.rows.filter((row) => existing.has(row.name.toLowerCase())).length;
  }, [preview, replace, existingProducts]);

  const importableCount = preview ? preview.rows.length - duplicateCount : 0;

  const importNote = useMemo(() => {
    if (!preview) return null;
    if (replace) {
      if (existingProducts.length > 0) {
        return `Replaces all ${existingProducts.length} item${existingProducts.length === 1 ? "" : "s"} currently saved, then imports ${preview.rows.length} from the file.`;
      }
      return `Imports all ${preview.rows.length} products and services from the file.`;
    }
    if (duplicateCount > 0) {
      return `${duplicateCount} name${duplicateCount === 1 ? "" : "s"} already in your database will be skipped · ${importableCount} new`;
    }
    return null;
  }, [preview, replace, existingProducts.length, duplicateCount, importableCount]);

  return (
    <ImportDialog open={open} onOpenChange={handleOpenChange}>
      <ImportDialogHeader
        title="Import products and services from QuickBooks"
        exportSteps={[
          "In QuickBooks: Sales → Products and services.",
          "Click the export icon (or More → Export) to download the list as Excel.",
          "Expected columns: Name, SKU, Type, Sales Description, Sales Price, Cost, Qty on Hand, Reorder Point. Category header rows are supported.",
        ]}
      />

      <ImportDialogBody>
        <ImportDialogReplaceOption
          id="replace-product-services"
          label="Replace existing products and services"
          checked={replace}
          onCheckedChange={setReplace}
        />

        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={PRODUCT_SERVICE_IMPORT_ACCEPT}
          file={file}
          parsing={parsing}
          disabled={importing}
          placeholder="Choose .xls, .xlsx, or .csv file"
          hint="Supports QuickBooks Products and services exports"
          onFileSelect={(selected) => void handleFileSelect(selected)}
        />

        {parseError ? <ImportDialogError message={parseError} /> : null}

        {preview ? (
          <ImportDialogPreviewCard>
            <ImportDialogPreviewStat
              title={
                replace
                  ? `${preview.rows.length} item${preview.rows.length === 1 ? "" : "s"} ready to import`
                  : `${importableCount} item${importableCount === 1 ? "" : "s"} ready to import`
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
                    {row.category ? ` · ${row.category}` : ""}
                    {row.salesPrice != null ? ` · ${row.salesPrice.toLocaleString()}` : ""}
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
        importLabel="Import products and services"
      />
    </ImportDialog>
  );
}
