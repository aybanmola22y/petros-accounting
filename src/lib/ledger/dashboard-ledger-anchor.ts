import { startOfDay } from "@/lib/report-date-utils";

/** Current date for dashboard widgets and reports (live clock). */
export function dashboardLedgerAnchor(): Date {
  return startOfDay(new Date());
}
