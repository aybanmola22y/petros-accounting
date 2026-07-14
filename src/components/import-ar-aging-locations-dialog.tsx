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
import { importArAgingReport } from "@/lib/ar-aging-location-enrichment";
import { replaceSalesTransactionsInStore } from "@/lib/mock-data/store";
import { SPREADSHEET_IMPORT_ACCEPT } from "@/lib/import-spreadsheet-utils";

type ImportArAgingLocationsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
};

export function ImportArAgingLocationsDialog({
  open,
  onOpenChange,
  onImported,
}: ImportArAgingLocationsDialogProps) {
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
      const result = await importArAgingReport(file);
      if (result.salesTransactions) {
        replaceSalesTransactionsInStore(result.salesTransactions);
      }
      toast({
        title:
          result.kind === "summary"
            ? "AR Ageing Summary imported"
            : "AR Ageing Detail imported",
        description:
          result.kind === "summary"
            ? `Loaded ${result.count} customers for the A/R Aging Summary report.`
            : `Loaded ${result.count} open receivable rows with amounts and locations.`,
      });
      onImported?.(result.count);
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
          <DialogTitle>Import AR Ageing Report</DialogTitle>
          <DialogDescription>
            Export either <strong>A/R Ageing Summary</strong> or <strong>A/R Ageing Detail</strong>{" "}
            from QuickBooks to Excel and import it here. The app detects which report you uploaded.
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
            {file ? <FileSpreadsheet className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            {file ? file.name : "Choose AR Ageing Summary or Detail export (.xls, .xlsx)"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Use <strong>Summary</strong> for Standard Reports → A/R Aging. Use <strong>Detail</strong>{" "}
            for Sales Performance and transaction-level locations.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleImport} disabled={!file || importing}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Import report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
