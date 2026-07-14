"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FinancialReportControls } from "@/components/financial-report-controls";
import { useImportedBalanceSheetSnapshot } from "@/hooks/use-imported-balance-sheet-summary";
import { useMockChartAccounts } from "@/hooks/use-mock-chart-accounts";
import { useMockExpenses } from "@/hooks/use-mock-expenses";
import { useMockSales } from "@/hooks/use-mock-sales";
import { useToast } from "@/hooks/use-toast";
import {
  formatBalanceSheetAllDatesAsOfLabel,
  isBalanceSheetAllDatesPeriod,
} from "@/lib/balance-sheet-summary/merge-snapshots";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import {
  balanceSheetDateLabel,
  flattenReportLines,
  transformFinancialReportLines,
  type AccountingMethod,
  type CompareToSelection,
  type DisplayColumnsBy,
} from "@/lib/financial-report-utils";
import { computeBalanceSheetLines } from "@/lib/ledger";
import {
  isCustomReportPeriod,
  resolveReportRange,
  startOfDay,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";
import {
  FinancialReportShell,
  ReportToolbar,
  printReport,
} from "@/views/financial-report-shared";

export function BalanceSheetReport() {
  const { toast } = useToast();
  const salesTransactions = useMockSales();
  const expenses = useMockExpenses();
  const chartAccounts = useMockChartAccounts();
  const today = startOfDay(new Date());
  const [period, setPeriod] = useState<ReportRangePeriod>("All Dates");
  const [fromDate, setFromDate] = useState(() => new Date(today.getFullYear(), 0, 1));
  const [toDate, setToDate] = useState(today);
  const [accountingMethod, setAccountingMethod] = useState<AccountingMethod>("Accrual");
  const [displayColumnsBy, setDisplayColumnsBy] = useState<DisplayColumnsBy>("none");
  const [compareTo, setCompareTo] = useState<CompareToSelection>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const { importPackage: balanceSheetImport, isLoading: balanceSheetImportLoading } =
    useImportedBalanceSheetSnapshot();

  useEffect(() => {
    if (!balanceSheetImport?.imported.periodLabel) return;
    if (!isBalanceSheetAllDatesPeriod(balanceSheetImport.imported.periodLabel)) return;
    setPeriod("All Dates");
    setToDate(dashboardLedgerAnchor());
  }, [balanceSheetImport?.imported.periodLabel]);

  const range = useMemo(
    () => resolveReportRange(period, fromDate, toDate),
    [period, fromDate, toDate],
  );

  const baseLines = useMemo(() => {
    if (balanceSheetImportLoading) return [];
    void refreshKey;
    return computeBalanceSheetLines(
      {
        salesTransactions,
        expenses,
        chartAccounts,
        range,
        basis: balanceSheetImport ? "Accrual" : accountingMethod,
      },
      balanceSheetImport,
    );
  }, [
    balanceSheetImportLoading,
    salesTransactions,
    expenses,
    chartAccounts,
    range,
    accountingMethod,
    refreshKey,
    balanceSheetImport,
  ]);

  const { lines, columns } = useMemo(
    () =>
      transformFinancialReportLines(
        baseLines,
        range,
        balanceSheetImport ? "Accrual" : accountingMethod,
        displayColumnsBy,
        compareTo,
      ),
    [baseLines, range, accountingMethod, balanceSheetImport, displayColumnsBy, compareTo],
  );

  const dateLabel = useMemo(() => {
    if (
      balanceSheetImport &&
      isBalanceSheetAllDatesPeriod(balanceSheetImport.imported.periodLabel)
    ) {
      return formatBalanceSheetAllDatesAsOfLabel(dashboardLedgerAnchor());
    }
    return balanceSheetDateLabel(range);
  }, [balanceSheetImport, range]);

  const handlePeriodChange = (next: ReportRangePeriod) => {
    if (balanceSheetImport) return;
    setPeriod(next);
    if (!isCustomReportPeriod(next)) {
      const resolved = resolveReportRange(next, fromDate, toDate);
      setFromDate(resolved.from);
      setToDate(resolved.to);
    }
  };

  const handleFromChange = (date: Date) => {
    if (balanceSheetImport) return;
    setFromDate(startOfDay(date));
    setPeriod("Custom dates");
  };

  const handleToChange = (date: Date) => {
    if (balanceSheetImport) return;
    setToDate(startOfDay(date));
    setPeriod("Custom dates");
  };

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    toast({
      title: "Report refreshed",
      description: dateLabel,
    });
  }, [dateLabel, toast]);

  const handleExport = useCallback(() => {
    const header = ["Account", ...columns.map((c) => c.label)];
    const body = flattenReportLines(lines, columns);
    const csv = [header.join(","), ...body.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-sheet-${range.to.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export started", description: "CSV download should begin shortly." });
  }, [columns, lines, range.to, toast]);

  const handlePrint = useCallback(() => {
    printReport();
  }, []);

  return (
    <div className="space-y-4 print:space-y-0">
      <ReportToolbar
        onRefresh={handleRefresh}
        onExport={handleExport}
        onPrint={handlePrint}
        filters={
          balanceSheetImport ? (
            <p className="text-sm text-muted-foreground">
              Showing imported QuickBooks Balance Sheet ({balanceSheetImport.imported.rows.length}{" "}
              accounts). Totals match the export for that as-of date; activity after the import
              date can adjust amounts. Re-import from QuickBooks Import to refresh.
            </p>
          ) : (
            <FinancialReportControls
              period={period}
              fromDate={fromDate}
              toDate={toDate}
              accountingMethod={accountingMethod}
              displayColumnsBy={displayColumnsBy}
              compareTo={compareTo}
              onPeriodChange={handlePeriodChange}
              onFromDateChange={handleFromChange}
              onToDateChange={handleToChange}
              onAccountingMethodChange={setAccountingMethod}
              onDisplayColumnsByChange={setDisplayColumnsBy}
              onCompareToChange={setCompareTo}
            />
          )
        }
      />
      {balanceSheetImportLoading ? (
        <p className="text-sm text-muted-foreground px-1">Loading balance sheet…</p>
      ) : (
        <FinancialReportShell
          reportTitle="Balance Sheet"
          dateLabel={dateLabel}
          footerBasis={balanceSheetImport ? "Accrual" : accountingMethod}
          lines={lines}
          amountColumns={columns}
        />
      )}
    </div>
  );
}
