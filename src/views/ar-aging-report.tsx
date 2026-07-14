"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { ReportPeriodControls } from "@/components/report-period-controls";
import { useToast } from "@/hooks/use-toast";
import { useMockReceivables } from "@/hooks/use-mock-receivables";
import { useMockSales } from "@/hooks/use-mock-sales";
import { useImportedArAgingDetailSnapshot } from "@/hooks/use-imported-ar-aging-detail";
import { useImportedArAgingSummarySnapshot } from "@/hooks/use-imported-ar-aging-summary";
import {
  resolveArAgingSummaryRows,
  rowTotal,
  sumBucket,
  type CustomerAgingRow,
} from "@/lib/ar-aging-from-receivables";
import { isArAgingSnapshotAsOf } from "@/lib/ar-aging-snapshot-utils";
import {
  formatReportDateLong,
  isCustomReportPeriod,
  resolveAsOfDate,
  startOfDay,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";
import {
  ReportChrome,
  ReportToolbar,
  formatPHP,
  printReport,
} from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

const COLUMN_HEADERS = [
  { key: "customer", label: "", align: "left" as const },
  { key: "current", label: "Current", align: "right" as const },
  { key: "days1to30", label: "1 - 30", align: "right" as const },
  { key: "days31to60", label: "31 - 60", align: "right" as const },
  { key: "days61to90", label: "61 - 90", align: "right" as const },
  { key: "days91plus", label: "91 and over", align: "right" as const },
  { key: "total", label: "Total", align: "right" as const, sortable: true },
];

function AmountCell({ value, className }: { value: number; className?: string }) {
  if (value === 0) {
    return <span className={cn("text-muted-foreground/40 tabular-nums", className)}>—</span>;
  }
  return <span className={cn("tabular-nums", className)}>{formatPHP(value)}</span>;
}

export function ArAgingReport() {
  const { toast } = useToast();
  const salesTransactions = useMockSales();
  const { customers, invoices } = useMockReceivables();
  const importedSummary = useImportedArAgingSummarySnapshot();
  const importedDetail = useImportedArAgingDetailSnapshot();
  const [period, setPeriod] = useState<ReportRangePeriod>("Today");
  const [customAsOf, setCustomAsOf] = useState(() => startOfDay(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const asOfDate = useMemo(
    () => resolveAsOfDate(period, customAsOf),
    [period, customAsOf],
  );

  const rows: CustomerAgingRow[] = useMemo(
    () =>
      resolveArAgingSummaryRows({
        asOf: asOfDate,
        importedSummaryAsOf: importedSummary?.asOf,
        importedSummaryRows: importedSummary?.rows,
        importedDetailAsOf: importedDetail?.asOf,
        importedDetailLines: importedDetail?.lines,
        invoices,
        customers,
        salesTransactions,
      }),
    [
      importedSummary,
      importedDetail,
      invoices,
      customers,
      asOfDate,
      salesTransactions,
      refreshKey,
    ],
  );

  const usingImportedSnapshot =
    Boolean(importedSummary?.rows.length && isArAgingSnapshotAsOf(importedSummary.asOf, asOfDate)) ||
    Boolean(importedDetail?.lines.length && isArAgingSnapshotAsOf(importedDetail.asOf, asOfDate));

  const totals = useMemo(
    () => ({
      current: sumBucket(rows, "current"),
      days1to30: sumBucket(rows, "days1to30"),
      days31to60: sumBucket(rows, "days31to60"),
      days61to90: sumBucket(rows, "days61to90"),
      days91plus: sumBucket(rows, "days91plus"),
    }),
    [rows],
  );
  const grandTotal = rowTotal(totals);

  const dateLabel = `As of ${formatReportDateLong(asOfDate)}`;

  const handlePeriodChange = (next: ReportRangePeriod) => {
    setPeriod(next);
    if (!isCustomReportPeriod(next)) {
      setCustomAsOf(resolveAsOfDate(next, customAsOf));
    }
  };

  const handleAsOfChange = (date: Date) => {
    setCustomAsOf(startOfDay(date));
    setPeriod("Custom dates");
  };

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    toast({
      title: "Report refreshed",
      description: `A/R aging as of ${formatReportDateLong(asOfDate)}.`,
    });
  }, [asOfDate, toast]);

  const handleExport = useCallback(() => {
    const header = ["Customer", "Current", "1-30", "31-60", "61-90", "91+", "Total"];
    const lines = rows.map((r) => {
      const t = rowTotal(r.buckets);
      return [
        r.customer,
        r.buckets.current,
        r.buckets.days1to30,
        r.buckets.days31to60,
        r.buckets.days61to90,
        r.buckets.days91plus,
        t,
      ].join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ar-aging-${asOfDate.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export started", description: "CSV download should begin shortly." });
  }, [rows, asOfDate, toast]);

  const handlePrint = useCallback(() => {
    printReport();
  }, []);

  return (
    <div className="space-y-4 print:space-y-0">
      <ReportToolbar
        onRefresh={handleRefresh}
        onExport={handleExport}
        onPrint={handlePrint}
        filters={
          <ReportPeriodControls
            period={period}
            asOfDate={asOfDate}
            onPeriodChange={handlePeriodChange}
            onAsOfDateChange={handleAsOfChange}
          />
        }
      />
      <ReportChrome
        reportTitle="A/R Aging Summary Report"
        dateLabel={dateLabel}
        footerBasis="Accrual"
      >
      {hasMounted && !usingImportedSnapshot ? (
        <p className="border-b px-5 py-2 text-xs text-muted-foreground print:hidden">
          Showing live aging from sales as of {formatReportDateLong(asOfDate)}. For an exact
          QuickBooks match, re-import{" "}
          <strong>A/R Ageing Summary</strong> (Reports → Who owes you) as of the same date under
          QuickBooks Import.
        </p>
      ) : null}
      <div className="report-print-table overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {COLUMN_HEADERS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "py-3 px-5 whitespace-nowrap",
                    col.align === "right" ? "text-right" : "text-left",
                    col.key === "customer" && "min-w-[180px]",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      col.align === "right" && "justify-end w-full",
                    )}
                  >
                    {col.label || "Customer"}
                    {col.sortable && (
                      <ArrowUpDown className="w-3 h-3 opacity-40 print:hidden" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                  No open receivables for this date.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const total = rowTotal(row.buckets);
                const stripe = index % 2 === 0 ? "bg-background" : "bg-muted/20";
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/30 transition-colors",
                      stripe,
                    )}
                  >
                    <td className="py-3 px-5 font-medium">{row.customer}</td>
                    <td className="py-3 px-5 text-right">
                      <AmountCell value={row.buckets.current} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <AmountCell value={row.buckets.days1to30} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <AmountCell value={row.buckets.days31to60} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <AmountCell value={row.buckets.days61to90} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <AmountCell value={row.buckets.days91plus} />
                    </td>
                    <td className="py-3 px-5 text-right font-semibold tabular-nums">
                      <AmountCell value={total} />
                    </td>
                  </tr>
                );
              })
            )}
            <tr className="border-t-2 border-border bg-primary/0.04 font-semibold">
              <td className="py-3 px-5">Total</td>
              <td className="py-3 px-5 text-right tabular-nums">{formatPHP(totals.current)}</td>
              <td className="py-3 px-5 text-right tabular-nums">{formatPHP(totals.days1to30)}</td>
              <td className="py-3 px-5 text-right tabular-nums">{formatPHP(totals.days31to60)}</td>
              <td className="py-3 px-5 text-right tabular-nums">{formatPHP(totals.days61to90)}</td>
              <td className="py-3 px-5 text-right tabular-nums">{formatPHP(totals.days91plus)}</td>
              <td className="py-3 px-5 text-right tabular-nums">{formatPHP(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      </ReportChrome>
    </div>
  );
}
