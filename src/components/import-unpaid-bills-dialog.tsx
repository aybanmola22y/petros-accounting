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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import unpaid bills from QuickBooks</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">QuickBooks Online export</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                In QuickBooks: <span className="font-medium text-foreground">Expenses → Bills</span>{" "}
                (Unpaid Bills report).
              </li>
              <li>Export to Excel (.xls).</li>
              <li>
                Expected columns: Supplier, Due Date, amount, balance, Status.
                Optional: <span className="font-medium text-foreground">No.</span> / Bill number
                (needed for A/P Ageing Detail).
              </li>
              <li>Upload the file here.</li>
            </ol>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="replace-unpaid-bills"
              checked={replace}
              onCheckedChange={(checked) => setReplace(checked === true)}
            />
            <Label htmlFor="replace-unpaid-bills" className="text-sm font-normal cursor-pointer">
              Replace existing unpaid bills
            </Label>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={UNPAID_BILLS_IMPORT_ACCEPT}
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
                  Supports QuickBooks Unpaid Bills exports
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
                    {preview.rows.length} unpaid bill{preview.rows.length === 1 ? "" : "s"} ready to import
                  </p>
                  <p className="text-muted-foreground">
                    Sheet: {preview.sheetName} · Header row: {preview.headerRowNumber}
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    Total open balance: ₱{totalOpenBalance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {importNote && <p className="text-muted-foreground">{importNote}</p>}
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
                      {row.supplierName} · due {row.dueDate} · ₱{row.openBalance.toLocaleString()}
                      {row.status ? ` · ${row.status}` : ""}
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
            disabled={!preview || preview.rows.length === 0 || parsing || importing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              "Import unpaid bills"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
