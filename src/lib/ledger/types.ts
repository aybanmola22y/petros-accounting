import type { AccountingMethod } from "@/lib/financial-report-utils";
import type { ReportDateRange } from "@/lib/report-date-utils";
import type { MockChartAccount } from "@/lib/mock-data/chart-of-accounts";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";

export type AccountingBasis = AccountingMethod;

export type LedgerSourceType =
  | "invoice"
  | "payment"
  | "sales-receipt"
  | "expense"
  | "bill"
  | "journal";

/** Double-entry line used for reconciliation and future QuickBooks import matching. */
export type LedgerEntry = {
  id: string;
  date: Date;
  accountId: string;
  debit: number;
  credit: number;
  sourceType: LedgerSourceType;
  sourceId: string;
  description?: string;
};

export type ProfitLossInput = {
  salesTransactions: MockSalesTransaction[];
  expenses: MockExpenseTransaction[];
  chartAccounts: MockChartAccount[];
  range: ReportDateRange;
  basis: AccountingBasis;
};

export type SalesTotalBreakdown = {
  total: number;
  invoiceAmount: number;
  paymentAmount: number;
  salesReceiptAmount: number;
  transactionCount: number;
  basis: AccountingBasis;
};
