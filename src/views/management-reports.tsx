"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Copy,
  Download,
  Eye,
  Mail,
  Pencil,
  Plus,
  Printer,
} from "lucide-react";
import { ManagementReportBuilderPreviewDialog } from "@/components/management-report-builder-preview-dialog";
import { ManagementReportLogo } from "@/components/management-report-logo";
import { ReportDateField } from "@/components/report-date-field";
import { ManagementReportPeriodSelect } from "@/components/report-period-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useCustomersAndLeadsBootstrap } from "@/hooks/use-customers-and-leads-bootstrap";
import { useMockChartAccounts } from "@/hooks/use-mock-chart-accounts";
import { useMockExpenses } from "@/hooks/use-mock-expenses";
import { useMockSales } from "@/hooks/use-mock-sales";
import {
  BUILTIN_MANAGEMENT_REPORTS,
  type ManagementReport,
} from "@/lib/management-reports-data";
import { readCustomManagementReports } from "@/lib/management-reports-storage";
import { buildManagementReportSnapshot } from "@/lib/management-report-document-pages";
import {
  getReportPeriodLabel,
  isCustomReportPeriod,
  resolveReportRange,
  startOfDay,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";
import { cn } from "@/lib/utils";

/** Five proportional columns so metadata spreads across the full row, not clustered on the right. */
const REPORT_LIST_GRID =
  "lg:grid lg:grid-cols-[minmax(16rem,1.5fr)_1fr_1fr_1.1fr_1fr] lg:items-center lg:gap-x-10";

function slugId(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type ReportRowActionsProps = {
  report: ManagementReport;
  onPreview: () => void;
  onEdit: () => void;
  onSend: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
  onDuplicate: () => void;
};

function ReportPreviewSplitButton({
  report,
  onPreview,
  onEdit,
  onSend,
  onExportPdf,
  onPrint,
  onDuplicate,
}: ReportRowActionsProps) {
  return (
    <div className="inline-flex shrink-0">
      <Button
        variant="default"
        size="sm"
        className="h-9 gap-1.5 rounded-r-none border-r border-primary-foreground/20 px-3"
        onClick={onPreview}
      >
        <Eye className="h-4 w-4" />
        Preview
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="h-9 rounded-l-none px-2"
            aria-label={`More actions for ${report.name}`}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onPreview}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem disabled={report.isBuiltIn} onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSend}>
            <Mail className="mr-2 h-4 w-4" />
            Send
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ManagementReports() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  useMockSales();
  useMockExpenses();
  useMockChartAccounts();
  useCustomersAndLeadsBootstrap();
  const [reports, setReports] = useState<ManagementReport[]>(BUILTIN_MANAGEMENT_REPORTS);
  const today = startOfDay(new Date());
  const defaultRangeFrom = new Date(today.getFullYear(), 0, 1);
  const [periods, setPeriods] = useState<Record<string, ReportRangePeriod>>(() =>
    Object.fromEntries(BUILTIN_MANAGEMENT_REPORTS.map((r) => [r.id, "This year"])),
  );
  const [periodRanges, setPeriodRanges] = useState<
    Record<string, { from: Date; to: Date }>
  >(() =>
    Object.fromEntries(
      BUILTIN_MANAGEMENT_REPORTS.map((r) => [
        r.id,
        resolveReportRange("This year", defaultRangeFrom, today),
      ]),
    ),
  );
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);
  const [printOnOpen, setPrintOnOpen] = useState(false);
  const [editReport, setEditReport] = useState<ManagementReport | null>(null);
  const [newReportName, setNewReportName] = useState("");

  useEffect(() => {
    const custom = readCustomManagementReports();
    if (custom.length === 0) return;
    setReports((prev) => {
      const ids = new Set(prev.map((r) => r.id));
      const merged = [...prev, ...custom.filter((r) => !ids.has(r.id))];
      return merged;
    });
    setPeriods((prev) => {
      const next = { ...prev };
      for (const r of custom) {
        if (!next[r.id]) next[r.id] = "This year";
      }
      return next;
    });
    setPeriodRanges((prev) => {
      const next = { ...prev };
      for (const r of custom) {
        if (!next[r.id]) {
          next[r.id] = resolveReportRange("This year", defaultRangeFrom, today);
        }
      }
      return next;
    });
  }, []);

  const previewReport = useMemo(
    () => reports.find((r) => r.id === previewReportId) ?? null,
    [reports, previewReportId],
  );

  const previewPeriod = previewReport ? periods[previewReport.id] ?? "This year" : "This year";
  const previewRange = previewReport
    ? periodRanges[previewReport.id] ?? resolveReportRange(previewPeriod, defaultRangeFrom, today)
    : resolveReportRange("This year", defaultRangeFrom, today);

  const previewSnapshot = useMemo(() => {
    if (!previewReport) return null;
    return buildManagementReportSnapshot(
      previewReport,
      previewPeriod,
      user?.name ?? "PetroBook",
      previewRange.from,
      previewRange.to,
    );
  }, [previewPeriod, previewRange.from, previewRange.to, previewReport, user?.name]);

  const handlePeriodChange = useCallback(
    (reportId: string, next: ReportRangePeriod) => {
      setPeriods((prev) => ({ ...prev, [reportId]: next }));
      if (isCustomReportPeriod(next)) return;
      setPeriodRanges((prev) => {
        const current = prev[reportId] ?? resolveReportRange(next, defaultRangeFrom, today);
        const resolved = resolveReportRange(next, current.from, current.to);
        return { ...prev, [reportId]: resolved };
      });
    },
    [defaultRangeFrom, today],
  );

  const handleCustomRangeChange = useCallback(
    (reportId: string, patch: { from?: Date; to?: Date }) => {
      setPeriods((prev) => ({ ...prev, [reportId]: "Custom dates" }));
      setPeriodRanges((prev) => {
        const current = prev[reportId] ?? resolveReportRange("This year", defaultRangeFrom, today);
        const from = patch.from ?? current.from;
        const to = patch.to ?? current.to;
        return {
          ...prev,
          [reportId]: resolveReportRange("Custom dates", from, to),
        };
      });
    },
    [defaultRangeFrom, today],
  );

  const openPreview = useCallback((reportId: string) => {
    setPrintOnOpen(false);
    setPreviewReportId(reportId);
  }, []);

  const handleSendEmail = useCallback(
    (report: ManagementReport) => {
      const period = periods[report.id] ?? "This year";
      const periodLabel = getReportPeriodLabel(period);
      const subject = encodeURIComponent(`${report.name} — ${periodLabel}`);
      const body = encodeURIComponent(
        `${report.name}\n${report.description}\n\nReport period: ${periodLabel}\nCreated by: ${report.createdBy}`,
      );
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      toast({
        title: "Opening email",
        description: "Your email client should open with the report summary.",
      });
    },
    [periods, toast],
  );

  const handleExportPdf = useCallback(
    (report: ManagementReport) => {
      setPrintOnOpen(true);
      setPreviewReportId(report.id);
      toast({
        title: "Export PDF",
        description: "Choose Save as PDF in the print dialog.",
      });
    },
    [toast],
  );

  const handlePrint = useCallback(
    (report: ManagementReport) => {
      setPrintOnOpen(true);
      setPreviewReportId(report.id);
    },
    [],
  );

  const handleDuplicate = useCallback(
    (report: ManagementReport) => {
      const copyName = `${report.name} (copy)`;
      const id = `${slugId(copyName)}-${Date.now()}`;
      const copy: ManagementReport = {
        ...report,
        id,
        name: copyName,
        isBuiltIn: false,
        createdBy: user?.name ?? "You",
        lastModified: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
      setReports((prev) => [...prev, copy]);
      const sourcePeriod = periods[report.id] ?? "This year";
      setPeriods((prev) => ({ ...prev, [id]: sourcePeriod }));
      setPeriodRanges((prev) => ({
        ...prev,
        [id]:
          prev[report.id] ?? resolveReportRange(sourcePeriod, defaultRangeFrom, today),
      }));
      toast({ title: "Report duplicated", description: copyName });
    },
    [defaultRangeFrom, periods, today, user?.name, toast],
  );

  const handleSaveEdit = useCallback(() => {
    if (!editReport) return;
    const name = newReportName.trim();
    if (!name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setReports((prev) =>
      prev.map((r) =>
        r.id === editReport.id
          ? {
              ...r,
              name,
              lastModified: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            }
          : r,
      ),
    );
    setEditReport(null);
    setNewReportName("");
    toast({ title: "Report updated", description: name });
  }, [editReport, newReportName, toast]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Reports
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Management Reports</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Curated dashboards for leadership reviews. Pick a period and preview any report.
          </p>
        </div>
        <Button
          className="shrink-0 gap-2 shadow-sm"
          onClick={() => router.push("/reports/management/new")}
        >
          <Plus className="h-4 w-4" />
          Management Report
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Available reports", value: String(reports.length) },
          { label: "Categories", value: String(new Set(reports.map((r) => r.category)).size) },
          { label: "Default period", value: "This year" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-card px-4 py-3 shadow-sm"
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="w-full space-y-2">
          <div
            className={cn(
              "hidden px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground lg:grid",
              REPORT_LIST_GRID,
            )}
          >
            <span>Name</span>
            <span className="lg:pl-1">Created by</span>
            <span>Last modified</span>
            <span>Report period</span>
            <span className="text-right lg:pr-1">Action</span>
          </div>

          {reports.map((report) => (
            <article
              key={report.id}
              className={cn(
                "group space-y-3 rounded-xl border bg-card p-4 shadow-sm transition-all",
                "hover:border-primary/25 hover:shadow-md lg:space-y-0",
                REPORT_LIST_GRID,
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <ManagementReportLogo report={report} />
                <div className="min-w-0 space-y-1">
                  <h3 className="font-semibold leading-snug text-foreground">
                    {report.name}
                  </h3>
                  {report.isBuiltIn ? (
                    <Badge
                      variant="outline"
                      className="w-fit border-sky-200 bg-sky-50 px-1.5 py-0 font-semibold uppercase tracking-wide text-[10px] text-sky-800"
                    >
                      PetroBook report
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="w-fit font-normal text-xs">
                      Custom
                    </Badge>
                  )}
                  <p className="text-sm leading-snug text-muted-foreground">
                    {report.description}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-4 border-t border-border/50 pt-3 text-sm lg:hidden">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Created by
                  </dt>
                  <dd className="mt-0.5 text-foreground">{report.createdBy}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Last modified
                  </dt>
                  <dd className="mt-0.5 tabular-nums text-foreground">{report.lastModified}</dd>
                </div>
              </dl>

              <p className="hidden text-sm text-foreground lg:block lg:pl-1">
                {report.createdBy}
              </p>
              <p className="hidden text-sm tabular-nums text-foreground lg:block">
                {report.lastModified}
              </p>

              <div className="flex items-center gap-2 border-t border-border/50 pt-3 lg:contents lg:border-0 lg:pt-0">
                <div className="min-w-0 flex-1 space-y-2 lg:col-start-4 lg:w-full">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground lg:sr-only">
                    Report period
                  </span>
                  <ManagementReportPeriodSelect
                    showLabel={false}
                    value={periods[report.id] ?? "This year"}
                    onChange={(value) => handlePeriodChange(report.id, value)}
                    className="w-full"
                  />
                  {isCustomReportPeriod(periods[report.id] ?? "This year") ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <ReportDateField
                        label="From"
                        value={
                          periodRanges[report.id]?.from ??
                          resolveReportRange("This year", defaultRangeFrom, today).from
                        }
                        onChange={(date) =>
                          handleCustomRangeChange(report.id, { from: startOfDay(date) })
                        }
                        onDatePicked={() => handlePeriodChange(report.id, "Custom dates")}
                      />
                      <ReportDateField
                        label="To"
                        value={
                          periodRanges[report.id]?.to ??
                          resolveReportRange("This year", defaultRangeFrom, today).to
                        }
                        onChange={(date) =>
                          handleCustomRangeChange(report.id, { to: startOfDay(date) })
                        }
                        onDatePicked={() => handlePeriodChange(report.id, "Custom dates")}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 lg:col-start-5 lg:flex lg:w-full lg:justify-end lg:pr-1">
                  <ReportPreviewSplitButton
                    report={report}
                    onPreview={() => openPreview(report.id)}
                    onEdit={() => {
                      setNewReportName(report.name);
                      setEditReport(report);
                    }}
                    onSend={() => handleSendEmail(report)}
                    onExportPdf={() => handleExportPdf(report)}
                    onPrint={() => handlePrint(report)}
                    onDuplicate={() => handleDuplicate(report)}
                  />
                </div>
              </div>
            </article>
          ))}
      </div>

      {previewSnapshot ? (
        <ManagementReportBuilderPreviewDialog
          open={previewReportId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewReportId(null);
              setPrintOnOpen(false);
            }
          }}
          snapshot={previewSnapshot}
          printOnOpen={printOnOpen}
          onPrintOnOpenComplete={() => setPrintOnOpen(false)}
        />
      ) : null}

      <Dialog
        open={editReport !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditReport(null);
            setNewReportName("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit report</DialogTitle>
            <DialogDescription>Rename your custom management report.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-report-name">Report name</Label>
            <Input
              id="edit-report-name"
              value={newReportName}
              onChange={(e) => setNewReportName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditReport(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
