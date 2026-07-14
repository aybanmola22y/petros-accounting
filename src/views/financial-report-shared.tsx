"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { formatReportDateTime } from "@/lib/report-date-utils";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Mail,
  Printer,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ReportLine = {
  id: string;
  label: string;
  amount?: number;
  /** Multiple amount columns (compare, months, etc.) */
  amounts?: number[];
  children?: ReportLine[];
  /** QuickBooks-style section label (e.g. INCOME) — no amount. */
  isSectionHeader?: boolean;
  /** Indented account row under a section header. */
  isAccountLine?: boolean;
  isSectionTotal?: boolean;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  defaultOpen?: boolean;
};

export type ReportAmountColumn = {
  id: string;
  label: string;
  kind?: "data" | "compare";
  format?: "currency" | "percent";
};

/** Fixed width keeps every row's amount columns vertically aligned. */
const AMOUNT_COLUMN_WIDTH = "8.75rem";

function reportGridTemplate(columnCount: number): string {
  if (columnCount <= 1) {
    return `minmax(14rem, 2fr) ${AMOUNT_COLUMN_WIDTH}`;
  }
  return `minmax(14rem, 2fr) repeat(${columnCount}, ${AMOUNT_COLUMN_WIDTH})`;
}

function reportGridStyle(columnCount: number): CSSProperties {
  return { gridTemplateColumns: reportGridTemplate(columnCount) };
}

function lineAmountValues(line: ReportLine, columnCount: number): (number | undefined)[] {
  if (line.amounts?.length) {
    const padded: (number | undefined)[] = [...line.amounts];
    while (padded.length < columnCount) padded.push(undefined);
    return padded.slice(0, columnCount);
  }
  if (line.amount !== undefined) {
    return [line.amount, ...Array.from({ length: columnCount - 1 }, () => undefined)];
  }
  return Array.from({ length: columnCount }, () => undefined);
}

const amountCellClass =
  "px-3 py-3 text-sm text-right tabular-nums whitespace-nowrap font-medium border-b border-l border-border/40";

const labelCellClass =
  "px-4 py-3 text-sm border-b border-border/50 min-h-[44px] flex items-center min-w-0";

function ReportLabelCell({
  line,
  depth,
  rowIndex,
  isTotal,
  open,
  collapsible,
}: {
  line: ReportLine;
  depth: number;
  rowIndex: number;
  isTotal: boolean;
  open?: boolean;
  collapsible?: boolean;
}) {
  const stripe = rowIndex % 2 === 0 ? "bg-background" : "bg-muted/20";
  const isSectionHeader = Boolean(line.isSectionHeader);
  const isAccountLine = Boolean(line.isAccountLine);
  const isSectionTotal = Boolean(line.isSectionTotal);

  let paddingLeft = "16px";
  if (line.isSubtotal || line.isGrandTotal) {
    paddingLeft = "2.5rem";
  } else if (isAccountLine) {
    paddingLeft = "2.5rem";
  } else if (isSectionHeader || isSectionTotal) {
    paddingLeft = "1rem";
  } else if (!line.isSubtotal) {
    paddingLeft = `${16 + depth * 16}px`;
  }

  return (
    <div
      className={cn(
        labelCellClass,
        stripe,
        isTotal && "font-semibold bg-primary/0.04",
        (line.isSubtotal || line.isGrandTotal) && "border-t-2 border-border",
        isSectionTotal && "border-t border-border font-semibold",
        isSectionHeader &&
          "py-2 text-xs font-semibold uppercase tracking-wider text-primary bg-transparent",
        collapsible && "group-hover:bg-muted/40 transition-colors",
      )}
      style={{ paddingLeft }}
    >
      {collapsible && (
        open ? (
          <ChevronDown className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        )
      )}
      <span
        className={cn(
          "truncate",
          depth === 0 && collapsible && "font-semibold text-foreground",
          isSectionHeader && "text-primary",
          (isSectionTotal || line.isSubtotal || line.isGrandTotal) && "font-semibold",
        )}
      >
        {line.label}
      </span>
    </div>
  );
}

function formatAmountValue(value: number, format?: ReportAmountColumn["format"]): string {
  if (format === "percent") {
    return `${value.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
  }
  return formatPHP(value);
}

function ReportAmountCell({
  value,
  rowIndex,
  isTotal,
  isSubtotalOrGrand,
  isSectionHeader,
  isSectionTotal,
  interactive,
  format,
}: {
  value: number | undefined;
  rowIndex: number;
  isTotal: boolean;
  isSubtotalOrGrand: boolean;
  isSectionHeader?: boolean;
  isSectionTotal?: boolean;
  interactive?: boolean;
  format?: ReportAmountColumn["format"];
}) {
  const stripe = rowIndex % 2 === 0 ? "bg-background" : "bg-muted/20";
  return (
    <div
      className={cn(
        amountCellClass,
        stripe,
        isTotal && "font-semibold bg-primary/0.04",
        isSubtotalOrGrand && "border-t-2 border-border",
        isSectionTotal && "border-t border-border font-semibold",
        isSectionHeader && "border-b-0",
        interactive && "group-hover:bg-muted/40 transition-colors",
      )}
    >
      {!isSectionHeader && value !== undefined ? formatAmountValue(value, format) : ""}
    </div>
  );
}

export function formatPHP(amount: number): string {
  const abs = Math.abs(amount).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-₱${abs}` : `₱${abs}`;
}

export function ReportRow({
  line,
  depth = 0,
  rowIndex,
  columnCount = 1,
  amountColumns = [],
}: {
  line: ReportLine;
  depth?: number;
  rowIndex: number;
  columnCount?: number;
  amountColumns?: ReportAmountColumn[];
}) {
  const hasChildren = line.children !== undefined;
  const [open, setOpen] = useState(line.defaultOpen ?? false);
  const isTotal = Boolean(line.isSectionTotal || line.isSubtotal || line.isGrandTotal);
  const isSubtotalOrGrand = Boolean(line.isSubtotal || line.isGrandTotal);
  const values = lineAmountValues(line, columnCount);

  if (!hasChildren) {
    return (
      <div className="contents">
        <ReportLabelCell
          line={line}
          depth={depth}
          rowIndex={rowIndex}
          isTotal={isTotal}
        />
        {values.map((value, i) => (
          <ReportAmountCell
            key={i}
            value={value}
            rowIndex={rowIndex}
            isTotal={isTotal}
            isSubtotalOrGrand={isSubtotalOrGrand}
            isSectionHeader={line.isSectionHeader}
            isSectionTotal={line.isSectionTotal}
            format={amountColumns[i]?.format}
          />
        ))}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="contents">
      <CollapsibleTrigger asChild>
        <button type="button" className="contents group">
          <ReportLabelCell
            line={line}
            depth={depth}
            rowIndex={rowIndex}
            isTotal={isTotal}
            open={open}
            collapsible
          />
          {values.map((value, i) => (
            <ReportAmountCell
              key={i}
              value={value}
              rowIndex={rowIndex}
              isTotal={isTotal}
              isSubtotalOrGrand={isSubtotalOrGrand}
              isSectionHeader={line.isSectionHeader}
              isSectionTotal={line.isSectionTotal}
              interactive
              format={amountColumns[i]?.format}
            />
          ))}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="contents">
        {line.children!.map((child, i) => (
          <ReportRow
            key={child.id}
            line={child}
            depth={depth + 1}
            rowIndex={rowIndex + i + 1}
            columnCount={columnCount}
            amountColumns={amountColumns}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

type ReportActionButtonsProps = {
  onRefresh?: () => void;
  onExport?: () => void;
  onEmail?: () => void;
  onPrint?: () => void;
};

export function ReportActionButtons({
  onRefresh,
  onExport,
  onEmail,
  onPrint,
}: ReportActionButtonsProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshClick = () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    onRefresh();
    window.setTimeout(() => setIsRefreshing(false), 700);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 print:hidden">
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          type="button"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      )}
      {onExport && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onExport}
          type="button"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      )}
      {onEmail && (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Email report"
          onClick={onEmail}
          type="button"
        >
          <Mail className="h-3.5 w-3.5" />
        </Button>
      )}
      {onPrint && (
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Print"
          onClick={onPrint}
          type="button"
        >
          <Printer className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

type ReportToolbarProps = ReportActionButtonsProps & {
  filters?: React.ReactNode;
};

/** Filters and actions sit above the printable report card. */
export function ReportToolbar({
  filters,
  onRefresh,
  onExport,
  onEmail,
  onPrint,
}: ReportToolbarProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 print:hidden">
      {filters ? (
        <div className="min-w-0 flex-1 overflow-visible">{filters}</div>
      ) : (
        <div />
      )}
      <ReportActionButtons
        onRefresh={onRefresh}
        onExport={onExport}
        onEmail={onEmail}
        onPrint={onPrint}
      />
    </div>
  );
}

function ReportPrintFooter({ basis }: { basis: string }) {
  const [printedAt, setPrintedAt] = useState(() => new Date());

  useEffect(() => {
    const sync = () => setPrintedAt(new Date());
    window.addEventListener("beforeprint", sync);
    return () => window.removeEventListener("beforeprint", sync);
  }, []);

  return (
    <div className="report-print-footer border-t bg-muted/20 px-5 py-4 text-center text-xs text-muted-foreground print:bg-white">
      <p>Generated · {basis} basis</p>
      <p className="mt-1 tabular-nums">{formatReportDateTime(printedAt)}</p>
    </div>
  );
}

type ReportChromeProps = {
  reportTitle: string;
  dateLabel: string;
  /** Cash or Accrual — shown on the first footer line. */
  footerBasis?: string;
  children: React.ReactNode;
};

export function ReportChrome({
  reportTitle,
  dateLabel,
  footerBasis = "Accrual",
  children,
}: ReportChromeProps) {
  return (
    <div className="report-print-card rounded-xl border bg-card shadow-sm overflow-hidden print:overflow-visible print:rounded-none print:border-0 print:bg-white print:shadow-none">
      <div className="report-print-header border-b bg-muted/25 px-5 py-4 print:border-b print:bg-white">
        <div className="space-y-0.5 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Petrosphere Inc.
          </p>
          <h2 className="text-lg font-semibold tracking-tight">{reportTitle}</h2>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
      </div>

      {children}

      <ReportPrintFooter basis={footerBasis} />
    </div>
  );
}

export { printReport } from "@/lib/print-report";

type FinancialReportShellProps = {
  reportTitle: string;
  dateLabel: string;
  footerBasis?: string;
  lines: ReportLine[];
  amountColumns?: ReportAmountColumn[];
};

export function FinancialReportShell({
  reportTitle,
  dateLabel,
  footerBasis,
  lines,
  amountColumns,
}: FinancialReportShellProps) {
  const columns =
    amountColumns && amountColumns.length > 0
      ? amountColumns
      : [{ id: "amount", label: "Amount" }];
  const columnCount = columns.length;
  const gridStyle = reportGridStyle(columnCount);

  return (
    <ReportChrome
      reportTitle={reportTitle}
      dateLabel={dateLabel}
      footerBasis={footerBasis}
    >
      <div className="report-print-table overflow-x-auto print:overflow-visible">
        <div className="grid w-full min-w-max" style={gridStyle}>
          <div className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground bg-muted/30 border-b">
            Account
          </div>
          {columns.map((col) => (
            <div
              key={col.id}
              className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right whitespace-nowrap bg-muted/30 border-b border-l border-border/40"
            >
              {col.label}
            </div>
          ))}

          {lines.map((line, idx) => (
            <ReportRow
              key={line.id}
              line={line}
              depth={0}
              rowIndex={idx}
              columnCount={columnCount}
              amountColumns={columns}
            />
          ))}
        </div>
      </div>
    </ReportChrome>
  );
}
