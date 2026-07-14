"use client";

import { memo, useMemo, type CSSProperties } from "react";
import type { AgingBucketKey, ArAgingDetailSection } from "@/lib/ar-aging-from-receivables";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

type ColumnDef = {
  key: string;
  label: string;
  align: "left" | "right";
};

const BASE_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", align: "left" },
  { key: "type", label: "Transaction Type", align: "left" },
  { key: "number", label: "No.", align: "left" },
  { key: "party", label: "Customer", align: "left" },
  { key: "location", label: "Location", align: "left" },
  { key: "dueDate", label: "Due Date", align: "left" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "openBalance", label: "Open Balance", align: "right" },
];

type ArAgingDetailTableProps = {
  sections: ArAgingDetailSection[];
  compact?: boolean;
  className?: string;
  /** Column label for the counterparty (Customer on A/R, Supplier on A/P). */
  partyColumnLabel?: string;
  /** Show QuickBooks-style Past Due column (A/P Ageing Detail). */
  showPastDue?: boolean;
  /**
   * When set, only these bucket section totals are shown.
   * Line items from every section still appear.
   * TOTAL sums those same bucket(s) so it matches “Total for 91+” when only 91+ is selected.
   */
  sectionTotalBuckets?: readonly AgingBucketKey[];
};

function formatAmount(value: number): string {
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Row style skips off-screen paint work while scrolling long aging lists. */
const ROW_CONTAIN: CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "auto 2rem",
};

export const ArAgingDetailTable = memo(function ArAgingDetailTable({
  sections,
  compact = false,
  className,
  partyColumnLabel = "Customer",
  showPastDue = false,
  sectionTotalBuckets,
}: ArAgingDetailTableProps) {
  const cellPad = compact ? "px-2 py-1" : "px-3 py-2";
  const headPad = compact ? "px-2 py-2" : "px-3 py-2.5";
  const columns = useMemo(() => {
    const mapped = BASE_COLUMNS.map((col) =>
      col.key === "party" ? { ...col, label: partyColumnLabel } : col,
    );
    if (!showPastDue) return mapped;
    const dueIdx = mapped.findIndex((col) => col.key === "dueDate");
    const withPastDue = [...mapped];
    withPastDue.splice(dueIdx + 1, 0, {
      key: "pastDue",
      label: "Past Due",
      align: "right",
    });
    return withPastDue;
  }, [partyColumnLabel, showPastDue]);
  const labelColSpan = showPastDue ? 7 : 6;
  const totalSections = useMemo(
    () =>
      sectionTotalBuckets?.length
        ? sections.filter((section) => sectionTotalBuckets.includes(section.bucket))
        : sections,
    [sections, sectionTotalBuckets],
  );
  const grandAmount = useMemo(
    () => totalSections.reduce((sum, section) => sum + section.amountSubtotal, 0),
    [totalSections],
  );
  const grandOpenBalance = useMemo(
    () => totalSections.reduce((sum, section) => sum + section.openBalanceSubtotal, 0),
    [totalSections],
  );

  if (sections.length === 0) {
    return (
      <p className={cn("px-4 py-8 text-center text-muted-foreground", className)}>
        No open balances for this date.
      </p>
    );
  }

  return (
    <div className={cn("overflow-visible contain-layout", className)}>
      <table className="w-full border-collapse text-left [contain:layout_style]">
        <thead>
          <tr className="border-b bg-muted/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  headPad,
                  "whitespace-nowrap",
                  col.align === "right" ? "text-right" : "text-left",
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-muted/15">
          {sections.map((section) =>
            section.lines.map((line) => (
              <tr
                key={line.id}
                className="border-b border-border/40"
                style={ROW_CONTAIN}
              >
                <td className={cn(cellPad, "whitespace-nowrap")}>{line.date}</td>
                <td className={cellPad}>{line.transactionType}</td>
                <td className={cn(cellPad, "whitespace-nowrap")}>{line.number}</td>
                <td className={cn(cellPad, "max-w-[12rem] truncate")}>{line.customer}</td>
                <td className={cn(cellPad, "max-w-[10rem] truncate text-muted-foreground")}>
                  {line.location || "—"}
                </td>
                <td className={cn(cellPad, "whitespace-nowrap")}>{line.dueDate}</td>
                {showPastDue ? (
                  <td className={cn(cellPad, "text-right tabular-nums")}>
                    {line.pastDueDays != null ? line.pastDueDays : "—"}
                  </td>
                ) : null}
                <td className={cn(cellPad, "text-right tabular-nums")}>
                  {formatAmount(line.amount)}
                </td>
                <td className={cn(cellPad, "text-right font-medium tabular-nums")}>
                  {formatAmount(line.openBalance)}
                </td>
              </tr>
            )),
          )}
          {totalSections.map((section) => (
            <tr key={`${section.bucket}-total`} className="border-b-2 border-border/70 font-semibold">
              <td colSpan={labelColSpan} className={cn(cellPad, compact ? "text-xs" : "text-sm")}>
                Total for {section.label}
              </td>
              <td className={cn(cellPad, "text-right tabular-nums")}>
                {formatPHP(section.amountSubtotal)}
              </td>
              <td className={cn(cellPad, "text-right tabular-nums")}>
                {formatPHP(section.openBalanceSubtotal)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-border font-bold">
            <td colSpan={labelColSpan} className={cn(cellPad, compact ? "text-xs" : "text-sm")}>
              TOTAL
            </td>
            <td className={cn(cellPad, "text-right tabular-nums")}>{formatPHP(grandAmount)}</td>
            <td className={cn(cellPad, "text-right tabular-nums")}>
              {formatPHP(grandOpenBalance)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});
