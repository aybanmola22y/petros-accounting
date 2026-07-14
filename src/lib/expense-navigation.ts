import {
  CUSTOM_REPORTS_PATH,
  CUSTOM_REPORT_TAB_PARAM,
  customReportHref,
} from "@/lib/custom-report-routes";

export const EXPENSE_TRANSACTIONS_PATH = "/expenses/expense-transactions";
/** @deprecated Open via Reports → Custom Reports */
export const EXPENSE_TRANSACTION_DETAIL_PATH = CUSTOM_REPORTS_PATH;

export const NEW_EXPENSE_SEARCH_PARAM = "newExpense";
export const NEW_CHEQUE_SEARCH_PARAM = "newCheque";
export const EXPENSE_DETAIL_PERIOD_PARAM = "period";
export const EXPENSE_DETAIL_BASIS_PARAM = "basis";

export function expenseTransactionDetailHref(options?: {
  period?: string;
  basis?: "Cash" | "Accrual";
}): string {
  const params = new URLSearchParams();
  params.set(CUSTOM_REPORT_TAB_PARAM, "transaction-detail-by-account");
  if (options?.period) params.set(EXPENSE_DETAIL_PERIOD_PARAM, options.period);
  if (options?.basis) params.set(EXPENSE_DETAIL_BASIS_PARAM, options.basis);
  const q = params.toString();
  return q ? `${CUSTOM_REPORTS_PATH}?${q}` : customReportHref("transaction-detail-by-account");
}

export function expenseTransactionsHref(options?: {
  expense?: boolean;
  cheque?: boolean;
}): string {
  const params = new URLSearchParams();
  if (options?.expense) params.set(NEW_EXPENSE_SEARCH_PARAM, "1");
  if (options?.cheque) params.set(NEW_CHEQUE_SEARCH_PARAM, "1");
  const q = params.toString();
  return q ? `${EXPENSE_TRANSACTIONS_PATH}?${q}` : EXPENSE_TRANSACTIONS_PATH;
}
