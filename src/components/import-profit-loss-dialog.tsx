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
  parseProfitLossSummarySpreadsheet,
  type ImportedProfitLossSnapshot,
} from "@/lib/profit-loss-summary-import";
import { SPREADSHEET_IMPORT_ACCEPT } from "@/lib/import-spreadsheet-utils";

type ImportProfitLossDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
};

export function ImportProfitLossDialog({
  open,
  onOpenChange,
  onImported,
}: ImportProfitLossDialogProps) {
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
      const snapshot: ImportedProfitLossSnapshot = await parseProfitLossSummarySpreadsheet(file);
      const response = await fetch("/api/profit-loss-summary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const result = (await response.json()) as { error?: string; count?: number };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      window.dispatchEvent(new Event("profit-loss-summary-imported"));
      toast({
        title: "Profit and Loss imported",
        description: `Loaded ${result.count ?? snapshot.rows.length} account rows${snapshot.periodLabel ? ` for ${snapshot.periodLabel}` : ""}. New transactions will update this report automatically.`,
      });
      onImported?.(result.count ?? snapshot.rows.length);
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
          <DialogTitle>Import Profit and Loss</DialogTitle>
          <DialogDescription>
            Import your QuickBooks <strong>Profit and Loss</strong> once to set the correct account
            breakdown. After that, new sales and expenses you add in this app automatically update the
            report — you only need to re-import when you want to refresh from QuickBooks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            {file ? file.name : "Choose Profit and Loss file"}
          </Button>
          {file ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Ready to import
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleImport} disabled={!file || importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
