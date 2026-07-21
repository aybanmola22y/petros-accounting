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
  ImportDialogTableMore,
  ImportDialogTip,
  ImportDialogWarning,
} from "@/components/import-dialog-shell";
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

  const previewDetails = preview ? (
    <>
      {preview.hasBalanceColumn && preview.rowsWithBalance > 0 ? (
        <p>{preview.rowsWithBalance.toLocaleString()} with QuickBooks balances</p>
      ) : null}
      {hasBankBalanceColumn && preview.rowsWithBankBalance > 0 ? (
        <p>{preview.rowsWithBankBalance.toLocaleString()} with bank balances</p>
      ) : null}
      {preview.skippedRows.length > 0 ? (
        <p>{preview.skippedRows.length.toLocaleString()} row(s) skipped</p>
      ) : null}
    </>
  ) : null;

  return (
    <ImportDialog open={open} onOpenChange={handleOpenChange} size="wide">
      <ImportDialogHeader
        title="Import chart of accounts"
        description={
          <>
            Recommended: export the QuickBooks{" "}
            <span className="font-medium text-foreground">Account List</span> report (Reports →
            Account List → Export). It includes a{" "}
            <span className="font-medium text-foreground">Total balance</span> column with every
            account balance. You can also use the Chart of accounts list export if you need{" "}
            <span className="font-medium text-foreground">Bank Balance</span> for connected bank
            accounts.
          </>
        }
        exportSteps={[
          "In QuickBooks: Reports → Account List → Export to Excel.",
          "Or open Chart of accounts, enable Bank Balance column, and export the list.",
        ]}
      />

      <ImportDialogBody scrollable>
        <ImportDialogTip>
          <span className="font-medium text-foreground">Account List</span> gives QuickBooks
          balances for all accounts. Re-importing updates existing accounts — you do not need
          Replace unless you want a full wipe first.
        </ImportDialogTip>

        <ImportDialogFilePicker
          fileInputRef={fileInputRef}
          accept={SPREADSHEET_IMPORT_ACCEPT}
          file={file}
          parsing={parsing}
          disabled={importing}
          placeholder="Choose QuickBooks export (.csv, .xlsx)"
          onFileSelect={(selected) => void handleFileSelect(selected)}
        />

        {parseError ? <ImportDialogError message={parseError} /> : null}

        {preview ? (
          <div className="space-y-3">
            {showBankBalanceWarning ? (
              <ImportDialogWarning>
                This file has no <span className="font-medium text-foreground">Bank Balance</span>{" "}
                column. In QuickBooks, open Chart of accounts, turn on the Bank Balance column,
                then export the list (not Run report) and import again. Existing accounts will be
                updated with bank balances without replacing your whole chart.
              </ImportDialogWarning>
            ) : null}

            {showBalanceWarning ? (
              <ImportDialogWarning>
                {!preview.hasBalanceColumn ? (
                  <>
                    This file has no{" "}
                    <span className="font-medium text-foreground">QuickBooks Balance</span> or{" "}
                    <span className="font-medium text-foreground">Total balance</span> column, so
                    balances will import as{" "}
                    <span className="font-medium text-foreground">₱0.00</span>. In QuickBooks, go
                    to <span className="font-medium text-foreground">Reports → Account List</span>,
                    export to Excel, then import that file here.
                  </>
                ) : (
                  <>
                    A balance column was found but every account is zero. Re-export from QuickBooks
                    with the <span className="font-medium text-foreground">QuickBooks Balance</span>{" "}
                    column visible on the Chart of accounts list, then import again.
                  </>
                )}
              </ImportDialogWarning>
            ) : null}

            <ImportDialogPreviewCard>
              <ImportDialogPreviewStat
                title={
                  <>
                    <span className="tabular-nums">{preview.rows.length.toLocaleString()}</span>{" "}
                    accounts ready to import
                  </>
                }
                details={previewDetails}
              />
            </ImportDialogPreviewCard>

            <ImportDialogTable minWidth={640}>
              <thead>
                <tr className="border-b border-border/70 bg-muted/40">
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
                  <tr key={row.rowNumber} className="border-b border-border/50 last:border-0">
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
            </ImportDialogTable>
            <ImportDialogTableMore
              shown={previewRows.length}
              total={preview.rows.length}
              noun="accounts"
            />
          </div>
        ) : null}
      </ImportDialogBody>

      <ImportDialogFooter
        onCancel={() => handleOpenChange(false)}
        onImport={() => void handleImport()}
        importDisabled={!preview || parsing}
        importing={importing}
        importLabel={`Import ${(preview?.rows.length ?? 0).toLocaleString()} accounts`}
      />
    </ImportDialog>
  );
}
