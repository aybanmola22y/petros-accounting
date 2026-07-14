export const STANDARD_REPORTS_PATH = "/reports/standard";
export const STANDARD_REPORT_TAB_PARAM = "report";

export type StandardReportTabId = "ar-aging" | "balance-sheet" | "profit-and-loss";

export function standardReportHref(tab: StandardReportTabId): string {
  return `${STANDARD_REPORTS_PATH}?${STANDARD_REPORT_TAB_PARAM}=${tab}`;
}

export function isStandardReportTabId(value: string | null): value is StandardReportTabId {
  return (
    value === "ar-aging" || value === "balance-sheet" || value === "profit-and-loss"
  );
}
