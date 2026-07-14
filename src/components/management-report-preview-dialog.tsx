"use client";

import { ManagementReportLogo } from "@/components/management-report-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMockDashboard } from "@/hooks/use-mock-dashboard";
import { formatPHP } from "@/views/financial-report-shared";
import type { ManagementReport } from "@/lib/management-reports-data";

type ManagementReportPreviewDialogProps = {
  report: ManagementReport | null;
  period: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrint?: () => void;
  onExportPdf?: () => void;
};

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PreviewBody({
  report,
  period,
}: {
  report: ManagementReport;
  period: string;
}) {
  const summary = useMockDashboard();

  if (report.id === "company-overview") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Executive snapshot for <span className="font-medium text-foreground">{period}</span>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard label="Total revenue" value={formatPHP(summary.totalRevenue)} />
          <MetricCard label="Net income" value={formatPHP(summary.netIncome)} />
          <MetricCard label="Cash balance" value={formatPHP(summary.cashBalance)} />
          <MetricCard
            label="Outstanding invoices"
            value={String(summary.outstandingInvoices)}
            hint={formatPHP(summary.unpaidTotal)}
          />
        </div>
      </div>
    );
  }

  if (report.id === "sales-performance") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sales trends for <span className="font-medium text-foreground">{period}</span>.
        </p>
        <MetricCard
          label="Total sales"
          value={formatPHP(summary.sales.totalAmount)}
          hint={summary.sales.amountLabel}
        />
        <div className="rounded-lg border">
          <div className="border-b bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sales by month
          </div>
          <ul className="divide-y">
            {summary.sales.byMonth.map((row) => (
              <li
                key={row.month}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span>{row.month}</span>
                <span className="font-medium tabular-nums">{formatPHP(row.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Expense breakdown for <span className="font-medium text-foreground">{period}</span>.
      </p>
      <MetricCard
        label="Total expenses"
        value={formatPHP(summary.expensesTotal)}
        hint={summary.expensesPeriodLabel}
      />
      <div className="rounded-lg border">
        <div className="border-b bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          By category
        </div>
        <ul className="divide-y">
          {summary.expensesByCategory.map((row) => (
            <li
              key={row.category}
              className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
            >
              <span>{row.category}</span>
              <span className="font-medium tabular-nums">{formatPHP(row.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ManagementReportPreviewDialog({
  report,
  period,
  open,
  onOpenChange,
  onPrint,
  onExportPdf,
}: ManagementReportPreviewDialogProps) {
  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3 text-left">
            <ManagementReportLogo report={report} size="sm" />
            <div className="min-w-0 space-y-1">
              <DialogTitle>{report.name}</DialogTitle>
              <DialogDescription>{report.description}</DialogDescription>
              <p className="text-xs text-muted-foreground">
                Report period: {period} · Created by {report.createdBy}
                {report.isBuiltIn ? " · PetroBook report" : ""}
              </p>
            </div>
          </div>
        </DialogHeader>

        <PreviewBody report={report} period={period} />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onExportPdf}>
            Export PDF
          </Button>
          <Button type="button" variant="outline" onClick={onPrint}>
            Print
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
