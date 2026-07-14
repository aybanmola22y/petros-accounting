"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import products and services from QuickBooks</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">QuickBooks Online export</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                In QuickBooks:{" "}
                <span className="font-medium text-foreground">Sales → Products and services</span>.
              </li>
              <li>Click the export icon (or More → Export) to download the list as Excel.</li>
              <li>
                Expected columns: Name, SKU, Type, Sales Description, Sales Price, Cost, Qty on
                Hand, Reorder Point. Category header rows are supported.
              </li>
              <li>Upload the file here.</li>
            </ol>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="replace-product-services"
              checked={replace}
              onCheckedChange={(checked) => setReplace(checked === true)}
            />
            <Label htmlFor="replace-product-services" className="text-sm font-normal cursor-pointer">
              Replace existing products and services
            </Label>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={PRODUCT_SERVICE_IMPORT_ACCEPT}
            className="hidden"
            onChange={(e) => void handleFileSelect(e.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            className="flex min-h-[140px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/35 bg-muted/10 px-4 py-6 text-center hover:bg-muted/30 transition-colors disabled:opacity-60"
            disabled={parsing || importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {parsing ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm font-medium">Reading spreadsheet…</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-primary">
                  {file ? file.name : "Choose .xls, .xlsx, or .csv file"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Supports QuickBooks Products and services exports
                </span>
              </>
            )}
          </button>

          {parseError && <p className="text-sm text-destructive">{parseError}</p>}

          {preview && (
            <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    {replace
                      ? `${preview.rows.length} item${preview.rows.length === 1 ? "" : "s"} ready to import`
                      : `${importableCount} item${importableCount === 1 ? "" : "s"} ready to import`}
                  </p>
                  <p className="text-muted-foreground">
                    Sheet: {preview.sheetName} · Header row: {preview.headerRowNumber}
                  </p>
                  {importNote && (
                    <p className={duplicateCount > 0 && !replace ? "text-amber-700" : "text-muted-foreground"}>
                      {importNote}
                    </p>
                  )}
                  {invalidRows > 0 && (
                    <p className="text-amber-700">
                      {invalidRows} row{invalidRows === 1 ? "" : "s"} skipped while reading the file
                    </p>
                  )}
                </div>
              </div>
              {preview.rows.length > 0 && (
                <div className="border-t pt-2 text-xs text-muted-foreground max-h-28 overflow-y-auto space-y-1">
                  {preview.rows.slice(0, 5).map((row) => (
                    <p key={row.rowNumber}>
                      {row.name}
                      {row.category ? ` · ${row.category}` : ""}
                      {row.salesPrice != null ? ` · ${row.salesPrice.toLocaleString()}` : ""}
                    </p>
                  ))}
                  {preview.rows.length > 5 && <p>…and {preview.rows.length - 5} more</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleImport()}
            disabled={importableCount === 0 || parsing || importing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              "Import products and services"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
