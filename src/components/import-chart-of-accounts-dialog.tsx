"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from "lucide-react";
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
  parseChartOfAccountsSpreadsheet,
  type ParseChartOfAccountsResult,
} from "@/lib/import-chart-of-accounts";
import { SPREADSHEET_IMPORT_ACCEPT } from "@/lib/import-spreadsheet-utils";
import { formatPHP } from "@/views/financial-report-shared";

type ImportChartOfAccountsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replaceExisting: boolean;
  onImported?: (result: { added: number; updated: number; skipped: number }) => void;
};

export function ImportChartOfAccountsDialog({
  open,
  onOpenChange,
  replaceExisting,
  onImported,
}: ImportChartOfAccountsDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParseChartOfAccountsResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function resetState() {
    setFile(null);
    setPreview(null);
    setParseError(null);
    setParsing(false);
    setImporting(false);
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
      const parsed = await parseChartOfAccountsSpreadsheet(selected);
      setPreview(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read the file.";
      setParseError(message);
      toast({ title: "Could not read file", description: message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const response = await fetch("/api/chart-of-accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace: replaceExisting,
          hasBalanceColumn: preview.hasBalanceColumn,
          hasBankBalanceColumn: preview.hasBankBalanceColumn,
          rows: preview.rows.map((row) => ({
            rowNumber: row.rowNumber,
            number: row.number,
            name: row.name,
            accountType: row.accountType,
            detailType: row.detailType,
            currency: row.currency,
            ledgerBalance: row.ledgerBalance,
            bankBalance: row.bankBalance,
          })),
        }),
      });
      const result = (await response.json()) as {
        added?: unknown[];
        updated?: unknown[];
        skipped?: Array<{ name: string; reason: string }>;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Import failed.");

      const added = result.added?.length ?? 0;
      const updated = result.updated?.length ?? 0;
      const skipped = result.skipped?.length ?? 0;
      onImported?.({ added, updated, skipped });
      const parts = [
        added > 0 ? `${added} added` : null,
        updated > 0 ? `${updated} updated` : null,
        skipped > 0 ? `${skipped} skipped` : null,
      ].filter(Boolean);
      toast({
        title: "Chart of accounts imported",
        description: parts.length > 0 ? parts.join(" · ") : "Import complete.",
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
    }
  }

  const previewRows = preview?.rows.slice(0, 8) ?? [];
  const showBalanceWarning =
    preview != null && (!preview.hasBalanceColumn || preview.rowsWithBalance === 0);
  const hasBankBalanceColumn =
    preview != null &&
    (preview.hasBankBalanceColumn || preview.rows.some((row) => row.bankBalance !== undefined));
  const showBankBalanceWarning =
    preview != null && preview.hasBalanceColumn && !hasBankBalanceColumn;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import chart of accounts</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Recommended: export the QuickBooks{" "}
            <span className="font-medium text-foreground">Account List</span> report (Reports →
            Account List → Export). It includes a{" "}
            <span className="font-medium text-foreground">Total balance</span> column with every
            account balance. You can also use the Chart of accounts list export if you need{" "}
            <span className="font-medium text-foreground">Bank Balance</span> for connected bank
            accounts.
          </p>
          <p className="text-sm text-muted-foreground rounded-md border bg-muted/30 px-3 py-2">
            <span className="font-medium text-foreground">Account List</span> gives QuickBooks
            balances for all accounts. Re-importing updates existing accounts — you do not need
            Replace unless you want a full wipe first.
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
            {parsing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {file ? file.name : "Choose QuickBooks export (.csv, .xlsx)"}
          </Button>

          {parseError ? (
            <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              {parseError}
            </p>
          ) : null}

          {preview ? (
            <div className="space-y-3">
              {showBankBalanceWarning ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <p>
                    This file has no <span className="font-medium text-foreground">Bank Balance</span>{" "}
                    column. In QuickBooks, open Chart of accounts, turn on the Bank Balance column,
                    then export the list (not Run report) and import again. Existing accounts will be
                    updated with bank balances without replacing your whole chart.
                  </p>
                </div>
              ) : null}

              {showBalanceWarning ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <p>
                    {!preview.hasBalanceColumn ? (
                      <>
                        This file has no <span className="font-medium text-foreground">QuickBooks Balance</span>{" "}
                        or <span className="font-medium text-foreground">Total balance</span>{" "}
                        column, so balances will import as{" "}
                        <span className="font-medium text-foreground">₱0.00</span>. In QuickBooks,
                        go to <span className="font-medium text-foreground">Reports → Account List</span>,
                        export to Excel, then import that file here.
                      </>
                    ) : (
                      <>
                        A balance column was found but every account is zero. Re-export from QuickBooks with
                        the <span className="font-medium text-foreground">QuickBooks Balance</span> column
                        visible on the Chart of accounts list, then import again.
                      </>
                    )}
                  </p>
                </div>
              ) : null}

              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="font-semibold tabular-nums">{preview.rows.length}</span> accounts
                  ready to import
                  {preview.hasBalanceColumn && preview.rowsWithBalance > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {preview.rowsWithBalance} with QuickBooks balances
                    </span>
                  )}
                  {hasBankBalanceColumn && preview.rowsWithBankBalance > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {preview.rowsWithBankBalance} with bank balances
                    </span>
                  )}
                  {preview.skippedRows.length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {preview.skippedRows.length} row(s) skipped
                    </span>
                  )}
                </span>
              </div>

              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left font-medium">Account number</th>
                      <th className="px-3 py-2 text-left font-medium">Account name</th>
                      <th className="px-3 py-2 text-left font-medium">Account type</th>
                      <th className="px-3 py-2 text-left font-medium">Detail type</th>
                      {preview.hasBalanceColumn ? (
                        <th className="px-3 py-2 text-right font-medium">Total / QB balance</th>
                      ) : null}
                      {hasBankBalanceColumn ? (
                        <th className="px-3 py-2 text-right font-medium">Bank balance</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.rowNumber} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {row.number || "—"}
                        </td>
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.accountType}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.detailType}</td>
                        {preview.hasBalanceColumn ? (
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatPHP(row.ledgerBalance)}
                          </td>
                        ) : null}
                        {hasBankBalanceColumn ? (
                          <td className="px-3 py-2 text-right tabular-nums">
                            {row.bankBalance !== undefined ? formatPHP(row.bankBalance) : "—"}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > previewRows.length ? (
                <p className="text-xs text-muted-foreground">
                  Showing first {previewRows.length} of {preview.rows.length} accounts.
                </p>
              ) : null}
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
                Importing…
              </>
            ) : (
              `Import ${preview?.rows.length ?? 0} accounts`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
