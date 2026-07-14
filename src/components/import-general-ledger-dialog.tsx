"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  parseGeneralLedgerSpreadsheet,
  type ImportedGeneralLedgerSnapshot,
} from "@/lib/general-ledger-import";
import { SPREADSHEET_IMPORT_ACCEPT } from "@/lib/import-spreadsheet-utils";

type ImportGeneralLedgerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (result: { inserted: number; matchedAccounts: number }) => void;
};

type PreviewSummary = {
  snapshot: ImportedGeneralLedgerSnapshot;
  accountCount: number;
  topAccounts: Array<{ label: string; count: number }>;
};

function summarize(snapshot: ImportedGeneralLedgerSnapshot): PreviewSummary {
  const counts = new Map<string, number>();
  for (const row of snapshot.rows) {
    counts.set(row.accountLabel, (counts.get(row.accountLabel) ?? 0) + 1);
  }
  const topAccounts = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return { snapshot, accountCount: counts.size, topAccounts };
}

export function ImportGeneralLedgerDialog({
  open,
  onOpenChange,
  onImported,
}: ImportGeneralLedgerDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function resetState() {
    setFile(null);
    setPreview(null);
    setParseError(null);
    setParsing(false);
    setImporting(false);
    setProgress(null);
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
      const snapshot = await parseGeneralLedgerSpreadsheet(selected);
      setPreview(summarize(snapshot));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Could not read the file.");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);

    const allRows = preview.snapshot.rows;
    const periodLabel = preview.snapshot.periodLabel;
    // Upload in chunks so the request body stays well under server limits.
    const CHUNK_SIZE = 2000;
    const totalChunks = Math.ceil(allRows.length / CHUNK_SIZE);
    setProgress({ done: 0, total: totalChunks });

    try {
      let totalInserted = 0;
      const matchedAccountIds = new Set<string>();

      for (let i = 0; i < totalChunks; i += 1) {
        const chunk = allRows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const response = await fetch("/api/general-ledger", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodLabel, rows: chunk, replace: i === 0 }),
        });
        const result = (await response.json()) as {
          inserted?: number;
          matchedAccounts?: number;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error ?? "Import failed.");
        totalInserted += result.inserted ?? 0;
        setProgress({ done: i + 1, total: totalChunks });
      }

      void matchedAccountIds;
      onImported?.({ inserted: totalInserted, matchedAccounts: preview.accountCount });
      toast({
        title: "Account history imported",
        description: `${totalInserted.toLocaleString()} transactions across ${preview.accountCount} accounts.`,
      });
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Import failed.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  const totalRows = preview?.snapshot.rows.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import account history (General Ledger)</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Use the QuickBooks{" "}
            <span className="font-medium text-foreground">
              Reports → General Ledger → All Dates → Accrual → Export to Excel
            </span>{" "}
            file. This populates the real per-account transaction history (the register you see when
            you click <span className="font-medium text-foreground">Account history</span>), so each
            account matches QuickBooks exactly. (Transaction Detail by Account works too.)
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept={SPREADSHEET_IMPORT_ACCEPT}
            className="hidden"
            onChange={(event) => void handleFileSelect(event.target.files?.[0] ?? null)}
          />

          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing || importing}
          >
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {file ? file.name : "Choose General Ledger export (.csv, .xlsx)"}
          </Button>

          {parseError ? (
            <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              {parseError}
            </p>
          ) : null}

          {preview ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="font-semibold tabular-nums">{totalRows.toLocaleString()}</span>{" "}
                  transactions across{" "}
                  <span className="font-semibold tabular-nums">{preview.accountCount}</span> accounts
                  {preview.snapshot.periodLabel ? (
                    <span className="text-muted-foreground"> · {preview.snapshot.periodLabel}</span>
                  ) : null}
                </span>
              </div>

              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full min-w-[480px] text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left font-medium">Account</th>
                      <th className="px-3 py-2 text-right font-medium">Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.topAccounts.map((row) => (
                      <tr key={row.label} className="border-b last:border-0">
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Importing replaces any previously imported account history.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={!preview || importing || parsing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {progress
                  ? `Importing… ${Math.round((progress.done / progress.total) * 100)}%`
                  : "Importing…"}
              </>
            ) : (
              `Import ${totalRows.toLocaleString()} transactions`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
