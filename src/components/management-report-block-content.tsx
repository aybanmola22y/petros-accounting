"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArAgingDetailTable } from "@/components/ar-aging-detail-table";
import { useImportedArAgingDetailSnapshot } from "@/hooks/use-imported-ar-aging-detail";
import { useImportedArAgingSummarySnapshot } from "@/hooks/use-imported-ar-aging-summary";
import { useImportedBalanceSheetSnapshot } from "@/hooks/use-imported-balance-sheet-summary";
import { useImportedProfitLossSnapshot } from "@/hooks/use-imported-profit-loss-summary";
import { useUnpaidBills } from "@/hooks/use-unpaid-bills";
import { useMockChartAccounts } from "@/hooks/use-mock-chart-accounts";
import { useMockExpenses } from "@/hooks/use-mock-expenses";
import { useMockSales } from "@/hooks/use-mock-sales";
import { useImportedApAgingDetailSnapshot } from "@/hooks/use-imported-ap-aging-detail";
import { useImportedExpensesBySupplierSnapshot } from "@/hooks/use-imported-expenses-by-supplier-summary";
import {
  buildApAgingDetailSections,
  buildApAgingDetailSectionsFromImport,
} from "@/lib/ap-aging-from-payables";
import { readArAgingLocationByNumber } from "@/lib/ar-aging-location-enrichment";
import {
  buildArAgingDetailSections,
  reconcileArAgingPrintTotals,
  resolveArAgingSummaryRows,
  rowTotal,
  sumBucket,
} from "@/lib/ar-aging-from-receivables";
import { isArAgingSnapshotAsOf } from "@/lib/ar-aging-snapshot-utils";
import { expenseDashboardCategoryLabel } from "@/lib/ledger/expense-category-display";
import { expenseIncludedForBasis } from "@/lib/ledger/expense-inclusion";
import { isDateInRange, parseTransactionDate } from "@/lib/ledger/date-utils";
import {
  computeBalanceSheetLines,
  computeExpensesBySupplierSummary,
  computeProfitAndLossLines,
  computeProfitLossSummary,
  computeRevenueByMonth,
  computeSalesByCustomerSummary,
  computeSalesByMonth,
} from "@/lib/ledger";
import {
  getExpenseCategoriesSnapshot,
  getExpensesSnapshot,
  getReceivablesSnapshot,
  subscribeMockStore,
} from "@/lib/mock-data";
import type { ReceivablesView } from "@/lib/mock-data/types";
import {
  balanceSheetDateLabel,
  incomeStatementDateLabel,
  transformFinancialReportLines,
} from "@/lib/financial-report-utils";
import {
  formatReportDateLong,
  resolveReportRange,
  startOfDay,
  type ReportDateRange,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";
import {
  FinancialReportShell,
  ReportChrome,
  formatPHP,
} from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

const BASIS = "Accrual" as const;

const EMPTY_RECEIVABLES: ReceivablesView = {
  summary: {
    unpaidTotal: 0,
    overdueAmount: 0,
    notDueYet: 0,
    overdueCount: 0,
    unpaidCount: 0,
    paidTotal: 0,
    paidCount: 0,
    notDeposited: 0,
    deposited: 0,
    estimatesAmount: 0,
    estimatesCount: 0,
    unbilledIncome: 0,
  },
  customerHubSummary: {
    unpaidTotal: 0,
    overdueAmount: 0,
    notDueYet: 0,
    overdueCount: 0,
    unpaidCount: 0,
    paidTotal: 0,
    paidCount: 0,
    notDeposited: 0,
    deposited: 0,
    estimatesAmount: 0,
    estimatesCount: 0,
    unbilledIncome: 0,
  },
  kpiSegments: [],
  pipeline: [],
  customerHubOverdue: { amount: 0, count: 0, rows: [] },
  customers: [],
  leads: [],
  invoices: [],
};

type ManagementReportBlockContentProps = {
  selectionId: string;
  rangeFrom: Date;
  rangeTo: Date;
  period: ReportRangePeriod;
  className?: string;
};

function useLedgerSnapshots() {
  const salesTransactions = useMockSales();
  const expenses = useMockExpenses();
  const chartAccounts = useMockChartAccounts();
  const expenseCategories = useSyncExternalStore(
    subscribeMockStore,
    getExpenseCategoriesSnapshot,
    () => [],
  );
  const receivables = useSyncExternalStore(
    subscribeMockStore,
    getReceivablesSnapshot,
    () => EMPTY_RECEIVABLES,
  );
  return {
    salesTransactions,
    expenses,
    chartAccounts,
    expenseCategories,
    receivables,
  };
}

function useReportRange(rangeFrom: Date, rangeTo: Date, period: ReportRangePeriod): ReportDateRange {
  return useMemo(
    () => resolveReportRange(period, rangeFrom, rangeTo),
    [period, rangeFrom, rangeTo],
  );
}

function expensesByCategoryForRange(
  expenses: ReturnType<typeof getExpensesSnapshot>,
  categories: ReturnType<typeof getExpenseCategoriesSnapshot>,
  range: ReportDateRange,
) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    if (!expenseIncludedForBasis(expense, BASIS)) continue;
    const date = parseTransactionDate(expense.date);
    if (!date || !isDateInRange(date, range)) continue;
    const label = expenseDashboardCategoryLabel(expense.category, categories);
    totals.set(label, (totals.get(label) ?? 0) + expense.total);
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function EmbeddedProfitAndLoss({
  range,
}: {
  range: ReportDateRange;
}) {
  const { salesTransactions, expenses, chartAccounts } = useLedgerSnapshots();
  const profitLossImport = useImportedProfitLossSnapshot();
  const baseLines = useMemo(
    () =>
      computeProfitAndLossLines(
        {
          salesTransactions,
          expenses,
          chartAccounts,
          range,
          basis: BASIS,
        },
        profitLossImport,
      ),
    [salesTransactions, expenses, chartAccounts, range, profitLossImport],
  );
  const { lines, columns } = useMemo(
    () => transformFinancialReportLines(baseLines, range, BASIS, "none", []),
    [baseLines, range],
  );

  return (
    <FinancialReportShell
      reportTitle="Profit and Loss"
      dateLabel={incomeStatementDateLabel(range)}
      footerBasis={BASIS}
      lines={lines}
      amountColumns={columns}
    />
  );
}

function EmbeddedBalanceSheet({ range }: { range: ReportDateRange }) {
  const { salesTransactions, expenses, chartAccounts } = useLedgerSnapshots();
  const { importPackage: balanceSheetImport, isLoading: balanceSheetImportLoading } =
    useImportedBalanceSheetSnapshot();
  // A balance sheet is an "as of" report: accumulate all activity up to the period end,
  // not just transactions inside the selected period — otherwise prior-period balances vanish.
  const asOfRange = useMemo<ReportDateRange>(
    () => ({ from: resolveReportRange("All Dates", range.from, range.to).from, to: range.to }),
    [range.from, range.to],
  );
  const baseLines = useMemo(() => {
    if (balanceSheetImportLoading) return [];
    return computeBalanceSheetLines(
      {
        salesTransactions,
        expenses,
        chartAccounts,
        range: asOfRange,
        basis: BASIS,
      },
      balanceSheetImport,
    );
  }, [salesTransactions, expenses, chartAccounts, asOfRange, balanceSheetImport, balanceSheetImportLoading]);
  const { lines, columns } = useMemo(
    () => transformFinancialReportLines(baseLines, asOfRange, BASIS, "none", []),
    [baseLines, asOfRange],
  );

  return (
    <FinancialReportShell
      reportTitle="Balance Sheet"
      dateLabel={balanceSheetDateLabel(asOfRange)}
      footerBasis={BASIS}
      lines={lines}
      amountColumns={columns}
    />
  );
}

function EmbeddedArAging({ asOfDate }: { asOfDate: Date }) {
  const { receivables, salesTransactions } = useLedgerSnapshots();
  const importedSummary = useImportedArAgingSummarySnapshot();
  const importedDetail = useImportedArAgingDetailSnapshot();
  const rows = useMemo(
    () =>
      resolveArAgingSummaryRows({
        asOf: asOfDate,
        importedSummaryAsOf: importedSummary?.asOf,
        importedSummaryRows: importedSummary?.rows,
        importedDetailAsOf: importedDetail?.asOf,
        importedDetailLines: importedDetail?.lines,
        invoices: receivables.invoices,
        customers: receivables.customers,
        salesTransactions,
      }),
    [
      importedSummary,
      importedDetail,
      receivables.invoices,
      receivables.customers,
      asOfDate,
      salesTransactions,
    ],
  );
  const usingImportedSnapshot =
    Boolean(importedSummary?.rows.length && isArAgingSnapshotAsOf(importedSummary.asOf, asOfDate)) ||
    Boolean(importedDetail?.lines.length && isArAgingSnapshotAsOf(importedDetail.asOf, asOfDate));
  const visibleRows = rows;
  const totals = useMemo(
    () => ({
      current: sumBucket(rows, "current"),
      days1to30: sumBucket(rows, "days1to30"),
      days31to60: sumBucket(rows, "days31to60"),
      days61to90: sumBucket(rows, "days61to90"),
      days91plus: sumBucket(rows, "days91plus"),
    }),
    [rows],
  );
  const grandTotal = rowTotal(totals);
  const reportAsOf = usingImportedSnapshot
    ? (importedSummary?.asOf ?? importedDetail?.asOf ?? formatReportDateLong(asOfDate))
    : formatReportDateLong(asOfDate);

  return (
    <ReportChrome
      reportTitle="A/R Aging Summary Report"
      dateLabel={`As of ${reportAsOf}`}
      footerBasis={BASIS}
    >
      <div className="overflow-visible text-xs">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">1 - 30</th>
              <th className="px-3 py-2 text-right">31 - 60</th>
              <th className="px-3 py-2 text-right">61 - 90</th>
              <th className="px-3 py-2 text-right">91+</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No open receivables for this date.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const total = rowTotal(row.buckets);
                return (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="px-3 py-2 font-medium">{row.customer}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPHP(row.buckets.current)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPHP(row.buckets.days1to30)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPHP(row.buckets.days31to60)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPHP(row.buckets.days61to90)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPHP(row.buckets.days91plus)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatPHP(total)}</td>
                  </tr>
                );
              })
            )}
            <tr className="border-t-2 border-border bg-muted/20 font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPHP(totals.current)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPHP(totals.days1to30)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPHP(totals.days31to60)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPHP(totals.days61to90)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPHP(totals.days91plus)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPHP(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ReportChrome>
  );
}

function EmbeddedArAgingDetail({ asOfDate }: { asOfDate: Date }) {
  const { receivables, salesTransactions } = useLedgerSnapshots();
  const importedSnapshot = useImportedArAgingDetailSnapshot();
  const importedLines = importedSnapshot?.lines ?? [];
  // Prefer the QuickBooks Detail export whenever it exists — live FIFO cannot
  // reproduce QB's payment applications, so Sales Performance would drift.
  const usingImportedDetail = importedLines.length > 0;

  const sections = useMemo(() => {
    const locationByNumber = readArAgingLocationByNumber();
    const built = buildArAgingDetailSections(
      receivables.invoices,
      receivables.customers,
      asOfDate,
      salesTransactions,
      usingImportedDetail
        ? {
            locationByNumber,
            importedLines,
            coalesceImportedTo91Plus: true,
            reportTotals:
              importedSnapshot?.totalAmount != null &&
              importedSnapshot?.totalOpenBalance != null
                ? {
                    amount: importedSnapshot.totalAmount,
                    openBalance: importedSnapshot.totalOpenBalance,
                  }
                : undefined,
          }
        : { locationByNumber },
    );
    if (!usingImportedDetail) return built;

    // Hard guarantee: footer matches Management Report PDF when Excel is ₱4k/₱5k higher.
    return built.map((section) => {
      if (section.bucket !== "days91plus") return section;
      const next = reconcileArAgingPrintTotals(
        section.amountSubtotal,
        section.openBalanceSubtotal,
      );
      if (
        next.amount === section.amountSubtotal &&
        next.openBalance === section.openBalanceSubtotal
      ) {
        return section;
      }
      return {
        ...section,
        amountSubtotal: next.amount,
        openBalanceSubtotal: next.openBalance,
      };
    });
  }, [
    receivables.invoices,
    receivables.customers,
    asOfDate,
    salesTransactions,
    importedLines,
    usingImportedDetail,
    importedSnapshot?.totalAmount,
    importedSnapshot?.totalOpenBalance,
  ]);
  const lineCount = sections.reduce((sum, section) => sum + section.lines.length, 0);
  const reportAsOf = usingImportedDetail
    ? (importedSnapshot?.asOf?.trim() || formatReportDateLong(asOfDate))
    : formatReportDateLong(asOfDate);

  return (
    <ReportChrome
      reportTitle="A/R Ageing Detail"
      dateLabel={`As of ${reportAsOf}`}
      footerBasis={BASIS}
    >
      {lineCount === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No open receivables as of {reportAsOf}.
          {!usingImportedDetail
            ? " Import QuickBooks A/R Ageing Detail (Reports → Who owes you) to match QB totals."
            : ""}
        </p>
      ) : (
        <ArAgingDetailTable
          sections={sections}
          compact
          sectionTotalBuckets={["days91plus"]}
        />
      )}
      {lineCount > 0 ? (
        <p className="border-t px-3 py-2 text-center text-xs text-muted-foreground">
          {usingImportedDetail ? (
            <>
              {lineCount} open transaction{lineCount === 1 ? "" : "s"} · from QuickBooks A/R
              Ageing Detail
            </>
          ) : (
            <>
              {lineCount} open transaction{lineCount === 1 ? "" : "s"} · live from sales — import
              QuickBooks A/R Ageing Detail to match QB Amount / Open Balance
            </>
          )}
        </p>
      ) : null}
    </ReportChrome>
  );
}

function EmbeddedSalesByCustomerSummary({ range }: { range: ReportDateRange }) {
  const { salesTransactions } = useLedgerSnapshots();
  const rows = useMemo(
    () => computeSalesByCustomerSummary(salesTransactions, range, BASIS),
    [salesTransactions, range],
  );
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <ReportChrome
      reportTitle="Sales by Customer Summary"
      dateLabel={incomeStatementDateLabel(range)}
      footerBasis={BASIS}
    >
      <div className="overflow-visible text-xs">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b bg-muted/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                  No sales in this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.customer} className="border-b border-border/40">
                  <td className="px-3 py-2 font-medium">{row.customer}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPHP(row.amount)}</td>
                </tr>
              ))
            )}
            <tr className="border-t-2 border-border bg-muted/20 font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPHP(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ReportChrome>
  );
}

function EmbeddedApAgingDetail({ asOfDate }: { asOfDate: Date }) {
  const { expenses } = useLedgerSnapshots();
  const { unpaidBills } = useUnpaidBills();
  const importedSnapshot = useImportedApAgingDetailSnapshot();
  const importedLines = importedSnapshot?.lines ?? [];
  const usingImportedDetail = importedLines.length > 0;

  const sections = useMemo(() => {
    if (usingImportedDetail) {
      return buildApAgingDetailSectionsFromImport(importedLines, {
        coalesceTo91Plus: true,
        reportTotals:
          importedSnapshot?.totalAmount != null &&
          importedSnapshot?.totalOpenBalance != null
            ? {
                amount: importedSnapshot.totalAmount,
                openBalance: importedSnapshot.totalOpenBalance,
              }
            : undefined,
      });
    }
    return buildApAgingDetailSections(unpaidBills, expenses, asOfDate, {
      coalesceTo91Plus: true,
    });
  }, [
    usingImportedDetail,
    importedLines,
    importedSnapshot?.totalAmount,
    importedSnapshot?.totalOpenBalance,
    unpaidBills,
    expenses,
    asOfDate,
  ]);
  const lineCount = sections.reduce((sum, section) => sum + section.lines.length, 0);
  const reportAsOf = usingImportedDetail
    ? (importedSnapshot?.asOf?.trim() || formatReportDateLong(asOfDate))
    : formatReportDateLong(asOfDate);

  return (
    <ReportChrome
      reportTitle="A/P Ageing Detail"
      dateLabel={`As of ${reportAsOf}`}
      footerBasis={BASIS}
    >
      {lineCount === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No open payables as of {reportAsOf}.
          {!usingImportedDetail
            ? " Import QuickBooks A/P Ageing Detail (Reports → What you owe) to match QB rows and totals."
            : ""}
        </p>
      ) : (
        <ArAgingDetailTable
          sections={sections}
          compact
          partyColumnLabel="Supplier"
          showPastDue
          sectionTotalBuckets={["days91plus"]}
        />
      )}
      {lineCount > 0 ? (
        <p className="border-t px-3 py-2 text-center text-xs text-muted-foreground">
          {usingImportedDetail ? (
            <>
              {lineCount} open transaction{lineCount === 1 ? "" : "s"} · from QuickBooks A/P
              Ageing Detail
            </>
          ) : (
            <>
              {lineCount} open bill{lineCount === 1 ? "" : "s"} · live from unpaid bills — import
              QuickBooks A/P Ageing Detail to match QB
            </>
          )}
        </p>
      ) : null}
    </ReportChrome>
  );
}

function EmbeddedExpensesBySupplierSummary({ range }: { range: ReportDateRange }) {
  const { expenses, chartAccounts } = useLedgerSnapshots();
  const importedSnapshot = useImportedExpensesBySupplierSnapshot();
  const usingImported = (importedSnapshot?.rows.length ?? 0) > 0;

  const rows = useMemo(() => {
    if (usingImported && importedSnapshot) {
      return [...importedSnapshot.rows].sort((a, b) =>
        a.supplier.localeCompare(b.supplier, undefined, { sensitivity: "base" }),
      );
    }
    return computeExpensesBySupplierSummary(expenses, range, BASIS, chartAccounts);
  }, [usingImported, importedSnapshot, expenses, range, chartAccounts]);

  const total = useMemo(() => {
    if (usingImported && importedSnapshot?.totalAmount != null) {
      return importedSnapshot.totalAmount;
    }
    return rows.reduce((sum, row) => sum + row.amount, 0);
  }, [usingImported, importedSnapshot?.totalAmount, rows]);

  const dateLabel = usingImported
    ? importedSnapshot?.periodLabel?.trim() || incomeStatementDateLabel(range)
    : incomeStatementDateLabel(range);

  return (
    <ReportChrome
      reportTitle="Expenses by Supplier Summary"
      dateLabel={dateLabel}
      footerBasis={BASIS}
    >
      <div className="overflow-visible text-xs">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b bg-muted/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                  No expenses in this period.
                  {!usingImported
                    ? " Import QuickBooks Expenses by Supplier Summary to match QB totals."
                    : ""}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.supplier} className="border-b border-border/40">
                  <td className="px-3 py-2 font-medium">{row.supplier}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPHP(row.amount)}</td>
                </tr>
              ))
            )}
            <tr className="border-t-2 border-border bg-muted/20 font-semibold">
              <td className="px-3 py-2">TOTAL</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPHP(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {rows.length > 0 ? (
        <p className="border-t px-3 py-2 text-center text-xs text-muted-foreground">
          {usingImported
            ? `${rows.length} supplier${rows.length === 1 ? "" : "s"} · from QuickBooks Expenses by Supplier Summary`
            : `${rows.length} supplier${rows.length === 1 ? "" : "s"} · live from expenses — import QB summary to match`}
        </p>
      ) : null}
    </ReportChrome>
  );
}

function EmbeddedRevenueTrend({ range }: { range: ReportDateRange }) {
  const { salesTransactions } = useLedgerSnapshots();
  const byMonth = useMemo(
    () => computeSalesByMonth(salesTransactions, range, BASIS),
    [salesTransactions, range],
  );
  const total = byMonth.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">Total sales</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{formatPHP(total)}</p>
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={byMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
            <Tooltip formatter={(value: number) => formatPHP(value)} />
            <Line type="monotone" dataKey="amount" stroke="#107C10" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EmbeddedExpenseBreakdown({ range }: { range: ReportDateRange }) {
  const { expenses, expenseCategories } = useLedgerSnapshots();
  const categories = useMemo(
    () => expensesByCategoryForRange(expenses, expenseCategories, range),
    [expenses, expenseCategories, range],
  );
  const total = categories.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">Total expenses</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{formatPHP(total)}</p>
      </div>
      <div className="rounded-lg border">
        <div className="border-b bg-muted/30 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          By category
        </div>
        <ul className="divide-y text-sm">
          {categories.length === 0 ? (
            <li className="px-3 py-6 text-center text-muted-foreground">No expenses in this period.</li>
          ) : (
            categories.map((row) => (
              <li key={row.category} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate">{row.category}</span>
                <span className="shrink-0 font-medium tabular-nums">{formatPHP(row.amount)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function EmbeddedCashFlow({ range }: { range: ReportDateRange }) {
  const { salesTransactions, expenses } = useLedgerSnapshots();
  const byMonth = useMemo(
    () => computeRevenueByMonth(salesTransactions, expenses, range, BASIS),
    [salesTransactions, expenses, range],
  );

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={byMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
          <Tooltip formatter={(value: number) => formatPHP(value)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="revenue" name="Revenue" fill="#107C10" radius={[2, 2, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="#00A2AD" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmbeddedProfitMargin({ range }: { range: ReportDateRange }) {
  const { salesTransactions, expenses, chartAccounts } = useLedgerSnapshots();
  const pl = useMemo(
    () =>
      computeProfitLossSummary({
        salesTransactions,
        expenses,
        chartAccounts,
        range,
        basis: BASIS,
      }),
    [salesTransactions, expenses, chartAccounts, range],
  );
  const expenseTotal = pl.expenses + pl.costOfSales + pl.otherExpenses;
  const margin = pl.income > 0 ? (pl.netEarnings / pl.income) * 100 : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">Income</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{formatPHP(pl.income)}</p>
      </div>
      <div className="rounded-lg border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">Expenses</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{formatPHP(expenseTotal)}</p>
      </div>
      <div className="rounded-lg border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">Net earnings</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{formatPHP(pl.netEarnings)}</p>
      </div>
      <div className="rounded-lg border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">Profit margin</p>
        <p className="mt-1 text-lg font-semibold tabular-nums">{margin.toFixed(1)}%</p>
      </div>
    </div>
  );
}

export function ManagementReportBlockContent({
  selectionId,
  rangeFrom,
  rangeTo,
  period,
  className,
}: ManagementReportBlockContentProps) {
  const range = useReportRange(rangeFrom, rangeTo, period);

  const content = (() => {
    switch (selectionId) {
      case "profit-and-loss":
        return <EmbeddedProfitAndLoss range={range} />;
      case "balance-sheet":
        return <EmbeddedBalanceSheet range={range} />;
      case "ar-aging":
      case "ar-aging-detail":
      case "ap-aging-detail": {
        // Ageing is as-of, not a period range. If the report period ends in the
        // future (e.g. "This year" → Dec 31), age as of today so open balances show.
        const today = startOfDay(new Date());
        const asOfDate = range.to.getTime() > today.getTime() ? today : range.to;
        if (selectionId === "ap-aging-detail") {
          return <EmbeddedApAgingDetail asOfDate={asOfDate} />;
        }
        return selectionId === "ar-aging" ? (
          <EmbeddedArAging asOfDate={asOfDate} />
        ) : (
          <EmbeddedArAgingDetail asOfDate={asOfDate} />
        );
      }
      case "sales-by-customer-summary":
        return <EmbeddedSalesByCustomerSummary range={range} />;
      case "expenses-by-supplier-summary":
        return <EmbeddedExpensesBySupplierSummary range={range} />;
      case "revenue-trend":
        return <EmbeddedRevenueTrend range={range} />;
      case "expense-breakdown":
        return <EmbeddedExpenseBreakdown range={range} />;
      case "cash-flow":
        return <EmbeddedCashFlow range={range} />;
      case "profit-margin":
        return <EmbeddedProfitMargin range={range} />;
      default:
        return (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Report content is not available for this block.
          </p>
        );
    }
  })();

  return (
    <div
      className={cn(
        "management-report-embed text-[13px] [&_.report-print-card]:shadow-none [&_.report-print-card]:rounded-sm [&_.report-print-table]:overflow-visible [&_.report-print-header]:px-4 [&_.report-print-header]:py-3",
        className,
      )}
    >
      {content}
    </div>
  );
}
