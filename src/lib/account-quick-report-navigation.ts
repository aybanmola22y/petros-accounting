export const CHART_OF_ACCOUNTS_PATH = "/accounting/chart-of-accounts";

export function accountQuickReportHref(accountId: string): string {
  return `${CHART_OF_ACCOUNTS_PATH}/${accountId}/quickreport`;
}
