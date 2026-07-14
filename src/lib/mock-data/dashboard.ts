import type { MockBankAccount } from "./bank-accounts";
import { computeTotalBankBalance, countConnectedBankAccounts } from "./bank-accounts";
import type { MockChartAccount } from "./chart-of-accounts";
import type { MockExpenseTransaction } from "./expenses";
import type { MockExpenseCategory } from "./expense-categories";
import type { MockSalesTransaction } from "./sales";
import type { MockInvoice, ReceivablesSummary } from "./types";
import type { UnpaidBill } from "./unpaid-bills";
import {
  computeExpenseDashboardSlice,
  computeProfitLossDashboardSlice,
  computeRecentTransactions,
  computeRevenueByMonth,
  computeSalesByMonth,
  computeSalesTotal,
} from "@/lib/ledger";
import { resolveReportRange, startOfDay } from "@/lib/report-date-utils";

export type DashboardSummary = {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  cashBalance: number;
  connectedBankAccounts: number;
  unpaidTotal: number;
  overdueAmount: number;
  outstandingInvoices: number;
  overdueInvoices: number;
  unpaidBills: number;
  revenueByMonth: { month: string; revenue: number; expenses: number }[];
  sales: {
    totalAmount: number;
    amountLabel: string;
    byMonth: { month: string; amount: number }[];
  };
  profitLoss: {
    netProfit: number;
    income: number;
    expenses: number;
    trendPercent: number;
    periodSubtitle: string;
    trendLabel: string;
  };
  expensesTotal: number;
  expensesTrendPercent: number;
  expensesPeriodLabel: string;
  expensesByCategory: { category: string; amount: number; changePercent: number }[];
  recentTransactions: {
    id: string | number;
    description: string;
    date: string;
    type: "credit" | "debit";
    amount: number;
  }[];
};

export function buildDashboardSummary(
  receivables: ReceivablesSummary,
  _paidInvoices: MockInvoice[],
  bankAccounts: MockBankAccount[],
  expenses: MockExpenseTransaction[],
  salesTransactions: MockSalesTransaction[],
  chartAccounts: MockChartAccount[],
  unpaidBills: UnpaidBill[],
  expenseCategories: MockExpenseCategory[] = [],
): DashboardSummary {
  const basis = "Accrual" as const;
  const today = startOfDay(new Date());
  const yearRange = resolveReportRange("This year to date", today, today);
  const expenseSlice = computeExpenseDashboardSlice(
    expenses,
    "This financial year to date",
    basis,
    expenseCategories,
  );
  const salesByMonth = computeSalesByMonth(salesTransactions, yearRange, basis);
  const profitLoss = computeProfitLossDashboardSlice(
    salesTransactions,
    expenses,
    chartAccounts,
    "This month",
    basis,
  );

  const revenueByMonth = computeRevenueByMonth(
    salesTransactions,
    expenses,
    yearRange,
    basis,
  );

  return {
    totalRevenue: profitLoss.income,
    totalExpenses: profitLoss.expenses + profitLoss.costOfSales + profitLoss.otherExpenses,
    netIncome: profitLoss.netEarnings,
    cashBalance: computeTotalBankBalance(bankAccounts),
    connectedBankAccounts: countConnectedBankAccounts(bankAccounts),
    unpaidTotal: receivables.unpaidTotal,
    overdueAmount: receivables.overdueAmount,
    outstandingInvoices: receivables.unpaidCount,
    overdueInvoices: receivables.overdueCount,
    unpaidBills: unpaidBills.length,
    revenueByMonth,
    sales: {
      totalAmount: computeSalesTotal(salesTransactions, yearRange, basis),
      amountLabel: "Total Amount (year to date)",
      byMonth: salesByMonth,
    },
    profitLoss: {
      netProfit: profitLoss.netEarnings,
      income: profitLoss.income,
      expenses: profitLoss.expenses + profitLoss.costOfSales + profitLoss.otherExpenses,
      trendPercent: profitLoss.trendPercent,
      periodSubtitle: profitLoss.periodSubtitle,
      trendLabel: profitLoss.trendLabel,
    },
    expensesTotal: expenseSlice.total,
    expensesTrendPercent: expenseSlice.trendPercent,
    expensesPeriodLabel: expenseSlice.periodLabel,
    expensesByCategory: expenseSlice.categories,
    recentTransactions: computeRecentTransactions(salesTransactions, expenses),
  };
}
