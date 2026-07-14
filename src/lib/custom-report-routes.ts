export const CUSTOM_REPORTS_PATH = "/reports/custom";
export const CUSTOM_REPORT_TAB_PARAM = "report";

export type CustomReportTabId = "transaction-detail-by-account";

export const CUSTOM_REPORT_DEFINITIONS = [
  {
    id: "transaction-detail-by-account" as const,
    label: "Transaction Detail by Account",
    shortLabel: "Transaction Detail",
    description: "Expense lines grouped by category account for a date range.",
  },
] as const;

export function customReportHref(tab: CustomReportTabId): string {
  return `${CUSTOM_REPORTS_PATH}?${CUSTOM_REPORT_TAB_PARAM}=${tab}`;
}

export function isCustomReportTabId(value: string | null): value is CustomReportTabId {
  return value === "transaction-detail-by-account";
}
