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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import customers from QuickBooks</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">QuickBooks Online export</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                In QuickBooks:{" "}
                <span className="font-medium text-foreground">
                  Sales &amp; Get Paid → Customers &amp; leads → Customers
                </span>
                .
              </li>
              <li>Export to Excel (Customers.xls).</li>
              <li>
                Expected columns: Name, Company name, Street Address, City, State, Country,
                Zip, Phone, Email, Attachments, Open balance.
              </li>
            </ol>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="replace-customers"
              checked={replace}
              onCheckedChange={(checked) => setReplace(checked === true)}
            />
            <Label htmlFor="replace-customers" className="text-sm font-normal cursor-pointer">
              Replace existing customers
            </Label>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={CUSTOMERS_IMPORT_ACCEPT}
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
              </>
            )}
          </button>

          {parseError ? (
            <p className="text-sm text-destructive">{parseError}</p>
          ) : null}

          {preview ? (
            <div className="rounded-lg border bg-muted/10 px-4 py-3 text-sm space-y-1">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                {preview.rows.length.toLocaleString()} customers ready to import
              </div>
              <p className="text-muted-foreground">
                Sheet: {preview.sheetName} · header row {preview.headerRowNumber}
              </p>
              {invalidRows > 0 ? (
                <p className="text-muted-foreground">
                  {invalidRows} row{invalidRows === 1 ? "" : "s"} skipped while reading the file
                </p>
              ) : null}
              <p className="text-muted-foreground">
                Open balance in file: ₱
                {previewTotalBalance.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              {importNote ? <p className="text-muted-foreground">{importNote}</p> : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={() => void handleImport()} disabled={!preview || importing || importableCount === 0}>
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Importing…
              </>
            ) : (
              `Import ${importableCount > 0 ? importableCount.toLocaleString() : ""} customers`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
