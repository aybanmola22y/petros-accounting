"use client";

import { useRef, useState } from "react";
import {
  ImportDialog,
  ImportDialogBody,
  ImportDialogError,
  ImportDialogFilePicker,
  ImportDialogFooter,
  ImportDialogHeader,
  ImportDialogPreviewCard,
  ImportDialogPreviewStat,
  ImportDialogTable,
  ImportDialogTip,
} from "@/components/import-dialog-shell";
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
    <ImportDialog open={open} onOpenChange={handleOpenChange} size="wide">
      <ImportDialogHeader
        title="Import account history (General Ledger)"
        description={
          <>
            Use the QuickBooks{" "}
            <span className="font-medium text-foreground">
              Reports → General Ledger → All Dates → Accrual → Export to Excel
            </span>{" "}
            file. This populates the real per-account transaction history (the register you see when
            you click <span className="font-medium text-foreground">Account history</span>), so each
            account matches QuickBooks exactly.
          </>
        }
        exportSteps={[
          "Reports → General Ledger → set All Dates and Accrual.",
          "Export to Excel and upload here.",
          "Transaction Detail by Account works too.",
        ]}
      />

      <ImportDialogBody scrollable>
        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={SPREADSHEET_IMPORT_ACCEPT}
          file={file}
          parsing={parsing}
          disabled={importing}
          placeholder="Choose General Ledger export (.csv, .xlsx)"
          onFileSelect={(selected) => void handleFileSelect(selected)}
        />

        {parseError ? <ImportDialogError message={parseError} /> : null}

        {preview ? (
          <div className="space-y-3">
            <ImportDialogPreviewCard>
              <ImportDialogPreviewStat
                title={
                  <>
                    <span className="tabular-nums">{totalRows.toLocaleString()}</span> transactions
                    across{" "}
                    <span className="tabular-nums">{preview.accountCount.toLocaleString()}</span>{" "}
                    accounts
                  </>
                }
                details={
                  preview.snapshot.periodLabel ? (
                    <p>{preview.snapshot.periodLabel}</p>
                  ) : undefined
                }
              />
            </ImportDialogPreviewCard>

            <ImportDialogTable minWidth={480}>
              <thead>
                <tr className="border-b border-border/70 bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium">Account</th>
                  <th className="px-3 py-2 text-right font-medium">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {preview.topAccounts.map((row) => (
                  <tr key={row.label} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ImportDialogTable>

            <ImportDialogTip>
              Importing replaces any previously imported account history.
            </ImportDialogTip>
          </div>
        ) : null}
      </ImportDialogBody>

      <ImportDialogFooter
        onCancel={() => handleOpenChange(false)}
        onImport={() => void handleImport()}
        importDisabled={!preview || parsing}
        importing={importing}
        importingLabel={
          progress
            ? `Importing… ${Math.round((progress.done / progress.total) * 100)}%`
            : undefined
        }
        importLabel={`Import ${totalRows.toLocaleString()} transactions`}
      />
    </ImportDialog>
  );
}
