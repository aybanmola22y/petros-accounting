"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FinancialReportControls } from "@/components/financial-report-controls";
import { useImportedProfitLossSnapshot } from "@/hooks/use-imported-profit-loss-summary";
import { useMockChartAccounts } from "@/hooks/use-mock-chart-accounts";
import { useMockExpenses } from "@/hooks/use-mock-expenses";
import { useMockSales } from "@/hooks/use-mock-sales";
import { useToast } from "@/hooks/use-toast";
import {
  flattenReportLines,
  incomeStatementDateLabel,
  transformFinancialReportLines,
  type AccountingMethod,
  type CompareToSelection,
  type DisplayColumnsBy,
} from "@/lib/financial-report-utils";
import {
  isCustomReportPeriod,
  resolveReportRange,
  startOfDay,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";
import { computeProfitAndLossLines, isProfitLossUsingImport } from "@/lib/ledger";
import {
  profitLossPeriodLabelToRange,
  reportRangesEqual,
} from "@/lib/profit-loss-summary/merge-snapshots";
import {
  FinancialReportShell,
  ReportToolbar,
  printReport,
} from "@/views/financial-report-shared";

export function ProfitAndLossReport() {
  const { toast } = useToast();
  const salesTransactions = useMockSales();
  const expenses = useMockExpenses();
  const chartAccounts = useMockChartAccounts();
  const today = startOfDay(new Date());
  const [period, setPeriod] = useState<ReportRangePeriod>("This year to date");
  const [fromDate, setFromDate] = useState(() => new Date(today.getFullYear(), 0, 1));
  const [toDate, setToDate] = useState(today);
  const [accountingMethod, setAccountingMethod] = useState<AccountingMethod>("Accrual");
  const [displayColumnsBy, setDisplayColumnsBy] = useState<DisplayColumnsBy>("none");
  const [compareTo, setCompareTo] = useState<CompareToSelection>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const profitLossImport = useImportedProfitLossSnapshot();

  const range = useMemo(
    () => resolveReportRange(period, fromDate, toDate),
    [period, fromDate, toDate],
  );

  // QB P&L imports are Accrual — switch onto Accrual when the import covers this range.
  useEffect(() => {
    if (!profitLossImport?.imported.rows.length) return;
    const importRange = profitLossPeriodLabelToRange(profitLossImport.imported.periodLabel);
    if (!reportRangesEqual(importRange, range)) return;
    if (accountingMethod !== "Accrual") {
      setAccountingMethod("Accrual");
    }
  }, [profitLossImport, range, accountingMethod]);

  const usingImport = useMemo(
    () =>
      isProfitLossUsingImport(
        { range, basis: accountingMethod },
        profitLossImport,
      ),
    [range, accountingMethod, profitLossImport],
  );

  const importRangeLabel = profitLossImport?.imported.periodLabel?.trim() || null;

  const baseLines = useMemo(() => {
    void refreshKey;
    return computeProfitAndLossLines(
      {
        salesTransactions,
        expenses,
        chartAccounts,
        range,
        basis: accountingMethod,
      },
      profitLossImport,
    );
  }, [
    salesTransactions,
    expenses,
    chartAccounts,
    range,
    accountingMethod,
    refreshKey,
    profitLossImport,
  ]);

  const { lines, columns } = useMemo(
    () =>
      transformFinancialReportLines(
        baseLines,
        range,
        accountingMethod,
        displayColumnsBy,
        compareTo,
      ),
    [baseLines, range, accountingMethod, displayColumnsBy, compareTo],
  );

  const dateLabel = incomeStatementDateLabel(range);
  const handlePeriodChange = (next: ReportRangePeriod) => {
    setPeriod(next);
    if (!isCustomReportPeriod(next)) {
      const resolved = resolveReportRange(next, fromDate, toDate);
      setFromDate(resolved.from);
      setToDate(resolved.to);
    }
  };

  const handleFromChange = (date: Date) => {
    setFromDate(startOfDay(date));
    setPeriod("Custom dates");
  };

  const handleToChange = (date: Date) => {
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

  const handleEmail = useCallback(() => {
    const header = ["Account", ...columns.map((c) => c.label)].join("\t");
    const rows = flattenReportLines(lines, columns)
      .map((r) => r.join("\t"))
      .join("\n");
    const subject = encodeURIComponent(`Profit and Loss — ${dateLabel}`);
    const body = encodeURIComponent(
      `Profit and Loss Report\n${dateLabel}\n${accountingMethod} basis\n\n${header}\n${rows}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    toast({
      title: "Opening email",
      description: "Your email client should open with the report summary.",
    });
  }, [accountingMethod, columns, dateLabel, lines, toast]);

  const handlePrint = useCallback(() => {
    printReport();
  }, []);

  return (
    <div className="space-y-4 print:space-y-0">
      <ReportToolbar
        onRefresh={handleRefresh}
        onEmail={handleEmail}
        onPrint={handlePrint}
        filters={
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
        }
      />
      {usingImport ? (
        <p className="px-1 text-sm text-muted-foreground print:hidden">
          Showing imported QuickBooks Profit and Loss
          {importRangeLabel ? ` (${importRangeLabel})` : ""}. Re-import from QuickBooks Import
          to refresh.
        </p>
      ) : profitLossImport?.imported.rows.length ? (
        <p className="px-1 text-sm text-muted-foreground print:hidden">
          Live ledger for {dateLabel}. Imported P&L covers{" "}
          {importRangeLabel ??
            incomeStatementDateLabel(
              profitLossPeriodLabelToRange(profitLossImport.imported.periodLabel),
            )}
          — switch to Accrual with those dates, or re-import, for an exact QuickBooks match.
        </p>
      ) : null}
      <FinancialReportShell
        reportTitle="Profit and Loss"
        dateLabel={dateLabel}
        footerBasis={accountingMethod}
        lines={lines}
        amountColumns={columns}
      />
    </div>
  );
}
