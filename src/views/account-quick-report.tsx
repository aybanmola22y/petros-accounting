"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { ReportDateField } from "@/components/report-date-field";
import { ReportPeriodSelect } from "@/components/report-period-select";
import { Button } from "@/components/ui/button";
import { useChartAccounts } from "@/hooks/use-chart-accounts";
import { useExpenseTransactions } from "@/hooks/use-expense-transactions";
import { useImportedAccountHistory } from "@/hooks/use-imported-account-history";
import { useMockSales } from "@/hooks/use-mock-sales";
import { CHART_OF_ACCOUNTS_PATH } from "@/lib/account-quick-report-navigation";
import { computeAccountQuickReport } from "@/lib/ledger/compute-account-quick-report";
import { buildAccountHistoryFromGeneralLedger } from "@/lib/general-ledger/build-account-history";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import {
  formatReportDateLong,
  formatReportRangeLabel,
  resolveReportRange,
  startOfDay,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";
import {
  ReportChrome,
  ReportToolbar,
  formatPHP,
  printReport,
} from "@/views/financial-report-shared";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DEFAULT_PERIOD: ReportRangePeriod = "All Dates";
const PAGE_SIZE = 15;

const SINCE_PERIODS = [
  "Since 30 days ago",
  "Since 60 days ago",
  "Since 90 days ago",
  "Since 365 days ago",
] as const satisfies readonly ReportRangePeriod[];

const ACCOUNT_QUICK_REPORT_PERIODS = [
  "All Dates",
  "Custom dates",
  "Today",
  "This week",
  "This week to date",
  "This month",
  "This month to date",
  "This quarter",
  "This quarter to date",
  "This year",
  "This year to date",
  "Last 30 days",
  "Last 90 days",
  ...SINCE_PERIODS,
] as const satisfies readonly ReportRangePeriod[];

function isSinceReportPeriod(period: ReportRangePeriod): boolean {
  return (SINCE_PERIODS as readonly string[]).includes(period);
}

function inferSincePeriod(
  from: Date,
  to: Date,
  anchor: Date,
): ReportRangePeriod {
  for (const preset of SINCE_PERIODS) {
    const resolved = resolveReportRange(preset, anchor, anchor, anchor);
    if (
      startOfDay(from).getTime() === startOfDay(resolved.from).getTime() &&
      startOfDay(to).getTime() === startOfDay(resolved.to).getTime()
    ) {
      return preset;
    }
  }
  if (startOfDay(to).getTime() === startOfDay(anchor).getTime()) {
    for (const preset of SINCE_PERIODS) {
      const resolved = resolveReportRange(preset, anchor, anchor, anchor);
      if (startOfDay(from).getTime() === startOfDay(resolved.from).getTime()) {
        return preset;
      }
    }
  }
  return "Custom dates";
}

const REGISTER_COLUMNS = [
  { key: "date", label: "Date", align: "left" as const },
  { key: "refType", label: "Ref no. / type", align: "left" as const },
  { key: "payeeAccount", label: "Payee / account", align: "left" as const },
  { key: "memo", label: "Memo", align: "left" as const },
  { key: "classLocation", label: "Class / Location", align: "left" as const },
  { key: "foreignCurrencyExchangeRate", label: "Foreign currency / exchange rate", align: "center" as const },
  { key: "tax", label: "Tax", align: "center" as const },
  { key: "debit", label: "Debit (PHP)", align: "right" as const },
  { key: "credit", label: "Credit (PHP)", align: "right" as const },
  { key: "balance", label: "Balance (PHP)", align: "right" as const },
] as const;

const BANK_REGISTER_COLUMNS = [
  { key: "date", label: "Date", align: "left" as const },
  { key: "refType", label: "Ref no. / type", align: "left" as const },
  { key: "payeeAccount", label: "Payee / account", align: "left" as const },
  { key: "memo", label: "Memo", align: "left" as const },
  { key: "classLocation", label: "Class / Location", align: "left" as const },
  { key: "foreignCurrencyExchangeRate", label: "Foreign currency / exchange rate", align: "center" as const },
  { key: "tax", label: "Tax", align: "center" as const },
  { key: "payment", label: "Payment (PHP)", align: "right" as const },
  { key: "deposit", label: "Deposit (PHP)", align: "right" as const },
  { key: "balance", label: "Balance (PHP)", align: "right" as const },
] as const;

function formatAmountCell(amount: number): string {
  if (amount === 0) return "—";
  return formatPHP(amount);
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell.replace(/"/g, '""');
          return /[",\n]/.test(value) ? `"${value}"` : value;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatAccountQuickReportDateLabel(
  period: ReportRangePeriod,
  range: { from: Date; to: Date },
): string {
  if (period.startsWith("Since ")) {
    return `Since ${formatReportDateLong(range.from)}`;
  }
  if (period === "All Dates") {
    return "All dates";
  }
  return formatReportRangeLabel(range);
}

export function AccountQuickReport() {
  const { toast } = useToast();
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;

  const { accounts: chartAccounts, loading: accountsLoading } = useChartAccounts();
  const { expenses, loading: expensesLoading } = useExpenseTransactions();
  const sales = useMockSales();
  const { data: importedHistory, isLoading: importedHistoryLoading } =
    useImportedAccountHistory(accountId);

  const anchor = dashboardLedgerAnchor();
  const initialRange = resolveReportRange(DEFAULT_PERIOD, anchor, anchor, anchor);

  const [period, setPeriod] = useState<ReportRangePeriod>(DEFAULT_PERIOD);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [refreshKey, setRefreshKey] = useState(0);
  const [groupOpen, setGroupOpen] = useState(true);
  const [page, setPage] = useState(1);

  const range = useMemo(
    () => resolveReportRange(period, fromDate, toDate, anchor),
    [period, fromDate, toDate, anchor],
  );

  const usingImportedHistory = Boolean(
    importedHistory?.importExists && (importedHistory?.rows.length ?? 0) > 0,
  );

  const report = useMemo(() => {
    if (accountsLoading || expensesLoading || importedHistoryLoading) return undefined;
    void refreshKey;

    const account = chartAccounts.find((row) => row.id === accountId);
    if (account && usingImportedHistory && importedHistory) {
      return buildAccountHistoryFromGeneralLedger(account, importedHistory.rows, range);
    }

    return computeAccountQuickReport(accountId, range, chartAccounts, expenses, sales);
  }, [
    accountId,
    range,
    chartAccounts,
    expenses,
    sales,
    refreshKey,
    accountsLoading,
    expensesLoading,
    importedHistoryLoading,
    usingImportedHistory,
    importedHistory,
  ]);

  const dateLabel = useMemo(
    () => formatAccountQuickReportDateLabel(period, range),
    [period, range],
  );

  const handlePeriodChange = (next: ReportRangePeriod) => {
    setPeriod(next);
    if (next === "Custom dates") return;
    const resolved = resolveReportRange(next, fromDate, toDate, anchor);
    setFromDate(resolved.from);
    setToDate(resolved.to);
  };

  const handleFromDateChange = (date: Date) => {
    const nextFrom = startOfDay(date);
    const nextTo = anchor;
    setFromDate(nextFrom);
    setToDate(nextTo);
    setPeriod(inferSincePeriod(nextFrom, nextTo, anchor));
  };

  const handleToDateChange = (date: Date) => {
    const nextTo = startOfDay(date);
    setToDate(nextTo);
    setPeriod("Custom dates");
    if (nextTo.getTime() < fromDate.getTime()) {
      setFromDate(nextTo);
    }
  };

  useEffect(() => {
    setGroupOpen(true);
    setPage(1);
  }, [period, fromDate, toDate, accountId]);

  const transactionCount = report?.rows.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(transactionCount / PAGE_SIZE));
  const rangeStart = transactionCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, transactionCount);
  // Show the latest transaction first while keeping each row's running balance.
  const displayRows = useMemo(() => {
    if (!report) return [];
    return [...report.rows].reverse();
  }, [report]);
  const paginatedRows = useMemo(
    () => displayRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [displayRows, page],
  );

  useEffect(() => {
    setPage((current) => (current > totalPages ? totalPages : current));
  }, [totalPages]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
    toast({ title: "Report refreshed", description: dateLabel });
  }, [dateLabel, toast]);

  const handleEmail = useCallback(() => {
    if (!report) return;
    const isBank = report.registerStyle === "bank";
    const lines = isBank
      ? report.rows.map(
          (row) =>
            `${row.date}\t${row.transactionType}\t${row.number}\t${row.payeeAccount}\t${row.memo}\t${row.classLocation}\t${row.foreignCurrencyExchangeRate}\t${row.tax}\t${row.payment}\t${row.deposit}\t${row.balance}`,
        )
      : report.rows.map(
          (row) =>
            `${row.date}\t${row.transactionType}\t${row.number}\t${row.payeeAccount}\t${row.memo}\t${row.classLocation}\t${row.foreignCurrencyExchangeRate}\t${row.tax}\t${row.debit}\t${row.credit}\t${row.balance}`,
        );
    const subject = encodeURIComponent(`Account History — ${report.accountName}`);
    const body = encodeURIComponent(
      `Account History\n${report.accountName}\n${dateLabel}\n\n${lines.join("\n")}\n\nENDING BALANCE\t${report.endingBalance}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    toast({ title: "Opening email", description: "Your email client should open with the report." });
  }, [dateLabel, report, toast]);

  const handleExport = useCallback(() => {
    if (!report) return;
    const isBank = report.registerStyle === "bank";
    if (isBank) {
      downloadCsv(`${report.accountName.replace(/\s+/g, "-")}-account-history.csv`, [
        ["Date", "Ref no.", "Type", "Payee / account", "Memo", "Class / Location", "Foreign currency / exchange rate", "Tax", "Payment (PHP)", "Deposit (PHP)", "Balance (PHP)"],
        ["", "", "Beginning balance", "", "", "", "", "", "", "", String(report.beginningBalance)],
        ...report.rows.map((row) => [
          row.date,
          row.number,
          row.transactionType,
          row.payeeAccount,
          row.memo,
          row.classLocation,
          row.foreignCurrencyExchangeRate,
          row.tax,
          row.payment ? String(row.payment) : "",
          row.deposit ? String(row.deposit) : "",
          String(row.balance),
        ]),
        ["", "", "", "", "Ending balance", "", "", "", "", "", String(report.endingBalance)],
      ]);
    } else {
      downloadCsv(`${report.accountName.replace(/\s+/g, "-")}-account-history.csv`, [
        ["Date", "Ref no.", "Type", "Payee / account", "Memo", "Class / Location", "Foreign currency / exchange rate", "Tax", "Debit (PHP)", "Credit (PHP)", "Balance (PHP)"],
        ["", "", "Beginning balance", "", "", "", "", "", "", "", String(report.beginningBalance)],
        ...report.rows.map((row) => [
          row.date,
          row.number,
          row.transactionType,
          row.payeeAccount,
          row.memo,
          row.classLocation,
          row.foreignCurrencyExchangeRate,
          row.tax,
          row.debit ? String(row.debit) : "",
          row.credit ? String(row.credit) : "",
          String(row.balance),
        ]),
        ["", "", "", "", "Ending balance", "", "", "", "", "", String(report.endingBalance)],
      ]);
    }
    toast({ title: "Export downloaded", description: "CSV file saved to your downloads folder." });
  }, [report, toast]);

  if (accountsLoading || expensesLoading || importedHistoryLoading) {
    return (
      <div className="space-y-4">
        <Link
          href={CHART_OF_ACCOUNTS_PATH}
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to chart of accounts
        </Link>
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Loading account history…
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <Link
          href={CHART_OF_ACCOUNTS_PATH}
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to chart of accounts
        </Link>
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Account not found.
        </div>
      </div>
    );
  }

  const isBankRegister = report.registerStyle === "bank";
  const tableColumns = isBankRegister ? BANK_REGISTER_COLUMNS : REGISTER_COLUMNS;
  const reportTitle = isBankRegister ? "Bank Account History" : "Account History";
  const accountHeader = report.accountNumber
    ? `${report.accountNumber} ${report.accountName}`
    : report.accountName;

  const renderRegisterRow = (
    row: (typeof report.rows)[number],
    index: number,
    mode: "bank" | "register",
  ) => (
    <tr
      key={row.id}
      className={cn(
        "border-b hover:bg-muted/20 text-xs",
        index % 2 === 0 ? "bg-background" : "bg-muted/10",
      )}
    >
      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{row.date}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="font-medium">{row.transactionType}</div>
        {row.number ? (
          <div className="text-muted-foreground tabular-nums">{row.number}</div>
        ) : null}
      </td>
      <td className="px-3 py-2 max-w-[220px]">
        {row.name ? (
          <div className="truncate font-medium" title={row.name}>
            {row.name}
          </div>
        ) : null}
        {row.distributionAccount ? (
          <div
            className="truncate text-muted-foreground"
            title={row.distributionAccount}
          >
            {row.distributionAccount}
          </div>
        ) : null}
        {!row.name && !row.distributionAccount ? "—" : null}
      </td>
      <td className="px-3 py-2 max-w-[180px] truncate" title={row.memo}>
        {row.memo || "—"}
      </td>
      <td className="px-3 py-2 max-w-[140px] truncate" title={row.classLocation}>
        {row.classLocation || "—"}
      </td>
      <td
        className="px-3 py-2 text-center tabular-nums whitespace-nowrap"
        title={row.foreignCurrencyExchangeRate}
      >
        {row.foreignCurrencyExchangeRate || "—"}
      </td>
      <td
        className="px-3 py-2 text-center tabular-nums whitespace-nowrap"
        title={row.tax}
      >
        {row.tax || "—"}
      </td>
      {mode === "bank" ? (
        <>
          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
            {formatAmountCell(row.payment)}
          </td>
          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
            {formatAmountCell(row.deposit)}
          </td>
        </>
      ) : (
        <>
          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
            {formatAmountCell(row.debit)}
          </td>
          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
            {formatAmountCell(row.credit)}
          </td>
        </>
      )}
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
        {formatPHP(row.balance)}
      </td>
    </tr>
  );

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={CHART_OF_ACCOUNTS_PATH}
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Chart of accounts
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            type="button"
            onClick={() =>
              toast({
                title: "Customise",
                description: "Column and grouping options will be available in a future update.",
              })
            }
          >
            <Settings2 className="h-3.5 w-3.5" />
            Customise
          </Button>
          <Button
            size="sm"
            className="h-8 bg-emerald-700 hover:bg-emerald-800"
            type="button"
            onClick={() =>
              toast({
                title: "Report saved",
                description: `Saved "${report.accountName}" for ${dateLabel}.`,
              })
            }
          >
            Save As
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card px-5 py-4 print:border-0 print:px-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Chart of accounts
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{reportTitle}</h1>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{accountHeader}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {usingImportedHistory
                ? "Imported from QuickBooks General Ledger — matches QuickBooks exactly."
                : "Built from imported sales and expenses — transactions post to this account from your ledger."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-6 text-right">
            {isBankRegister && report.bankBalance !== undefined ? (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Bank balance</p>
                <p className="text-lg font-semibold tabular-nums">{formatPHP(report.bankBalance)}</p>
              </div>
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Ending balance</p>
              <p className="text-2xl font-bold tabular-nums">{formatPHP(report.endingBalance)}</p>
            </div>
          </div>
        </div>
      </div>

      <ReportToolbar
        onRefresh={handleRefresh}
        onEmail={handleEmail}
        onExport={handleExport}
        onPrint={printReport}
        filters={
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-3 gap-y-3">
            <ReportPeriodSelect
              value={period}
              onChange={handlePeriodChange}
              periods={ACCOUNT_QUICK_REPORT_PERIODS}
              className="w-11rem min-w-11rem shrink-0"
            />
            <ReportDateField
              label="From"
              value={fromDate}
              onChange={handleFromDateChange}
            />
            {!isSinceReportPeriod(period) && period !== "All Dates" ? (
              <ReportDateField
                label="To"
                value={toDate}
                onChange={handleToDateChange}
                onDatePicked={() => setPeriod("Custom dates")}
              />
            ) : null}
          </div>
        }
      />

      <ReportChrome reportTitle={reportTitle} dateLabel={dateLabel} footerBasis="Accrual">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {tableColumns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap",
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left",
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-muted/40 border-b">
                <td colSpan={tableColumns.length} className="p-0">
                  <button
                    type="button"
                    onClick={() => setGroupOpen((open) => !open)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold hover:bg-muted/60 transition-colors"
                  >
                    {groupOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{report.accountName}</span>
                    <span className="text-muted-foreground font-normal">
                      ({transactionCount} transaction{transactionCount === 1 ? "" : "s"})
                    </span>
                  </button>
                </td>
              </tr>

              {groupOpen ? (
                <>
                  {report.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={tableColumns.length}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No transactions for this period. Import expenses and sales from QuickBooks
                        to see line-by-line history here.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, index) =>
                      renderRegisterRow(
                        row,
                        (page - 1) * PAGE_SIZE + index,
                        isBankRegister ? "bank" : "register",
                      ),
                    )
                  )}

                  {page >= totalPages ? (
                    <tr className="border-b bg-muted/10 text-xs">
                      <td className="px-3 py-2 whitespace-nowrap">—</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">Beginning balance</span>
                      </td>
                      <td className="px-3 py-2" colSpan={5} />
                      <td className="px-3 py-2 text-right tabular-nums">—</td>
                      <td className="px-3 py-2 text-right tabular-nums">—</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatPHP(report.beginningBalance)}
                      </td>
                    </tr>
                  ) : null}
                </>
              ) : null}

              <tr className="border-t-2 bg-muted/30 font-semibold text-xs">
                <td colSpan={7} className="px-4 py-2.5 text-sm uppercase tracking-wide">
                  Ending balance
                </td>
                {isBankRegister ? (
                  <>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {formatAmountCell(report.totalPayments)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {formatAmountCell(report.totalDeposits)}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {formatAmountCell(report.totalDebits)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {formatAmountCell(report.totalCredits)}
                    </td>
                  </>
                )}
                <td className="px-3 py-2.5 text-right tabular-nums text-base font-bold whitespace-nowrap">
                  {formatPHP(report.endingBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {transactionCount > PAGE_SIZE ? (
          <div className="flex flex-col gap-3 border-t bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <p className="text-xs text-muted-foreground">
              {`${rangeStart}–${rangeEnd} of ${transactionCount} transaction${transactionCount === 1 ? "" : "s"}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="px-1 text-xs tabular-nums text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </ReportChrome>
    </div>
  );
}
