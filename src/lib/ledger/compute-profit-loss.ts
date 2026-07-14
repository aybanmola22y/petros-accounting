import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import type { ReportLine } from "@/views/financial-report-shared";
import {
  expenseAccountIdForCategory,
  isCogsAccount,
  isExpenseAccount,
  isOtherExpenseAccount,
} from "./account-mapping";
import { computeExpenseTotal, computeExpensesByAccount } from "./compute-expenses";
import { computeSalesTotal } from "./compute-sales";
import {
  computeProfitAndLossLinesFromLedger,
  computeProfitLossAccountRows,
} from "./profit-loss-ledger-lines";
import { buildProfitAndLossLinesFromImport } from "@/lib/profit-loss-summary/build-report-lines";
import type { ProfitLossImportPackage } from "@/lib/profit-loss-summary/repository";
import {
  mergeProfitLossWithLedgerDelta,
  profitLossPeriodLabelToRange,
  reportRangesEqual,
} from "@/lib/profit-loss-summary/merge-snapshots";
import {
  priorProfitLossDashboardRange,
  profitLossDashboardPeriodSubtitle,
  profitLossDashboardPeriodToRange,
  profitLossDashboardTrendLabel,
  type ProfitLossDashboardPeriod,
} from "./profit-loss-dashboard-periods";
import { dashboardLedgerAnchor } from "./dashboard-ledger-anchor";
import { startOfDay } from "@/lib/report-date-utils";
import type { AccountingBasis, ProfitLossInput } from "./types";

export type { ProfitLossDashboardPeriod } from "./profit-loss-dashboard-periods";
export { PROFIT_LOSS_DASHBOARD_PERIODS } from "./profit-loss-dashboard-periods";

export type ProfitLossSummary = {
  income: number;
  costOfSales: number;
  grossProfit: number;
  expenses: number;
  otherExpenses: number;
  netEarnings: number;
};

export type ProfitLossDashboardSlice = ProfitLossSummary & {
  trendPercent: number;
  periodSubtitle: string;
  trendLabel: string;
};

/** Dashboard P&L card — ledger-backed with period trend vs prior window. */
export function computeProfitLossDashboardSlice(
  salesTransactions: MockSalesTransaction[],
  expenses: MockExpenseTransaction[],
  chartAccounts: MockChartAccount[],
  period: ProfitLossDashboardPeriod,
  basis: AccountingBasis = "Accrual",
): ProfitLossDashboardSlice {
  const anchor = dashboardLedgerAnchor();
  const range = profitLossDashboardPeriodToRange(period, anchor);
  const priorRange = priorProfitLossDashboardRange(period, range, anchor);
  const input = { salesTransactions, expenses, chartAccounts, basis };
  const current = computeProfitLossSummary({ ...input, range });
  const prior = computeProfitLossSummary({ ...input, range: priorRange });
  const trendPercent =
    prior.netEarnings !== 0
      ? Math.round(
          ((current.netEarnings - prior.netEarnings) / Math.abs(prior.netEarnings)) * 100,
        )
      : 0;

  return {
    ...current,
    trendPercent,
    periodSubtitle: profitLossDashboardPeriodSubtitle(period, range),
    trendLabel: profitLossDashboardTrendLabel(period),
  };
}

export function computeProfitLossSummary(input: ProfitLossInput): ProfitLossSummary {
  const income = computeSalesTotal(
    input.salesTransactions,
    input.range,
    input.basis,
  );
  const expenseByAccount = computeExpensesByAccount(
    input.expenses,
    input.range,
    input.basis,
    (category) => expenseAccountIdForCategory(category, input.chartAccounts),
  );

  let costOfSales = 0;
  let expenses = 0;
  let otherExpenses = 0;

  for (const account of input.chartAccounts) {
    const amount = expenseByAccount.get(account.id) ?? 0;
    if (amount === 0) continue;
    if (isCogsAccount(account)) costOfSales += amount;
    else if (isOtherExpenseAccount(account)) otherExpenses += amount;
    else if (isExpenseAccount(account)) expenses += amount;
  }

  const unmapped = computeExpenseTotal(input.expenses, input.range, input.basis) -
    costOfSales - expenses - otherExpenses;
  if (unmapped > 0) expenses += unmapped;

  const grossProfit = income - costOfSales;
  const netEarnings = grossProfit - expenses - otherExpenses;

  return { income, costOfSales, grossProfit, expenses, otherExpenses, netEarnings };
}

export function computeProfitAndLossLines(
  input: ProfitLossInput,
  importPackage?: ProfitLossImportPackage | null,
): ReportLine[] {
  if (importPackage?.imported.rows.length && input.basis === "Accrual") {
    const importRange = profitLossPeriodLabelToRange(importPackage.imported.periodLabel);

    // Same dates as the QuickBooks export → show the import unchanged.
    if (reportRangesEqual(importRange, input.range)) {
      return buildProfitAndLossLinesFromImport(importPackage.imported);
    }

    // Same start date, later end date → import + local activity after the import `to`.
    if (
      startOfDay(importRange.from).getTime() === startOfDay(input.range.from).getTime() &&
      startOfDay(input.range.to).getTime() > startOfDay(importRange.to).getTime()
    ) {
      const currentRows = computeProfitLossAccountRows(input);
      const ledgerThroughImport = computeProfitLossAccountRows({
        ...input,
        range: importRange,
      });
      const merged = mergeProfitLossWithLedgerDelta(
        importPackage.imported,
        { periodLabel: importPackage.imported.periodLabel, rows: ledgerThroughImport },
        currentRows,
      );
      return buildProfitAndLossLinesFromImport(merged);
    }
  }

  return computeProfitAndLossLinesFromLedger(input);
}

/** True when the Accrual P&L view is driven by a matching QuickBooks import. */
export function isProfitLossUsingImport(
  input: Pick<ProfitLossInput, "range" | "basis">,
  importPackage?: ProfitLossImportPackage | null,
): boolean {
  if (!importPackage?.imported.rows.length || input.basis !== "Accrual") return false;
  const importRange = profitLossPeriodLabelToRange(importPackage.imported.periodLabel);
  if (reportRangesEqual(importRange, input.range)) return true;
  return (
    startOfDay(importRange.from).getTime() === startOfDay(input.range.from).getTime() &&
    startOfDay(input.range.to).getTime() > startOfDay(importRange.to).getTime()
  );
}
