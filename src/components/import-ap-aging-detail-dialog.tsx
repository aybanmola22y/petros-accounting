"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import A/P Ageing Detail</DialogTitle>
          <DialogDescription>
            Export <strong>A/P Ageing Detail</strong> from QuickBooks to Excel and import it here
            so Expenses Performance matches QuickBooks (No., Location, Amount / Open Balance).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">QuickBooks Online</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                Reports → What you owe → <span className="font-medium text-foreground">A/P Ageing Detail</span>
              </li>
              <li>Set as of date (e.g. Today or Dec 31, 2026) → Export to Excel</li>
              <li>Upload the file here</li>
            </ol>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={SPREADSHEET_IMPORT_ACCEPT}
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {file ? file.name : "Choose Excel file"}
          </Button>
          {file ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Ready to import
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!file || importing} onClick={() => void handleImport()}>
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              "Import"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
