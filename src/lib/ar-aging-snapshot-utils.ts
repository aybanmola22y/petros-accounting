import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import { parseReportDate, startOfDay } from "@/lib/report-date-utils";

/** True when an imported AR ageing snapshot matches the report as-of day. */
export function isArAgingSnapshotAsOf(
  asOfLabel: string | undefined,
  asOf = dashboardLedgerAnchor(),
): boolean {
  if (!asOfLabel?.trim()) return false;
  const parsed = parseTransactionDate(asOfLabel) ?? parseReportDate(asOfLabel);
  if (!parsed) return false;
  return startOfDay(parsed).getTime() === startOfDay(asOf).getTime();
}

/** @deprecated Use isArAgingSnapshotAsOf */
export function isArAgingSnapshotAsOfToday(
  asOfLabel: string | undefined,
  anchor = dashboardLedgerAnchor(),
): boolean {
  return isArAgingSnapshotAsOf(asOfLabel, anchor);
}
