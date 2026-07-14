import {
  SALES_DASHBOARD_PERIODS,
  type SalesDashboardPeriod,
} from "@/lib/ledger/sales-dashboard-periods";

export const SALES_TRANSACTIONS_PATH = "/sales/sales-transactions";
export const BANK_DEPOSIT_SEARCH_PARAM = "bankDeposit";

export const SALES_OVERVIEW_PATH = "/sales/overview";
export const SALES_OVERVIEW_PERIOD_PARAM = "period";
export const SALES_OVERVIEW_BASIS_PARAM = "basis";

export function salesTransactionsHref(bankDeposit?: boolean): string {
  const params = new URLSearchParams();
  if (bankDeposit) params.set(BANK_DEPOSIT_SEARCH_PARAM, "1");
  const q = params.toString();
  return q ? `${SALES_TRANSACTIONS_PATH}?${q}` : SALES_TRANSACTIONS_PATH;
}

export function isSalesOverviewPeriod(value: string | null): value is SalesDashboardPeriod {
  return value !== null && (SALES_DASHBOARD_PERIODS as readonly string[]).includes(value);
}

export function salesOverviewHref(options?: {
  period?: SalesDashboardPeriod | string;
  basis?: "Cash" | "Accrual";
}): string {
  const params = new URLSearchParams();
  if (options?.period) params.set(SALES_OVERVIEW_PERIOD_PARAM, options.period);
  if (options?.basis) params.set(SALES_OVERVIEW_BASIS_PARAM, options.basis);
  const q = params.toString();
  return q ? `${SALES_OVERVIEW_PATH}?${q}` : SALES_OVERVIEW_PATH;
}
