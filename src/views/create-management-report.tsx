"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlignLeft,
  BarChart3,
  Bold,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  HelpCircle,
  Italic,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Redo2,
  Trash2,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { ManagementReportBuilderPreviewDialog } from "@/components/management-report-builder-preview-dialog";
import { ManagementReportCoverPage } from "@/components/management-report-cover-page";
import { ReportDateField } from "@/components/report-date-field";
import { ManagementReportPeriodSelect } from "@/components/report-period-select";
import { ReportDatePicker } from "@/components/report-date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { appendCustomManagementReport } from "@/lib/management-reports-storage";
import {
  EMBEDDABLE_CHARTS,
  type ManagementReportBuilderSnapshot,
} from "@/lib/management-report-document-pages";
import { MANAGEMENT_REPORT_CATALOG } from "@/lib/management-report-catalog";
import {
  formatManagementReportCoverPeriod,
  isCustomReportPeriod,
  resolveReportRange,
  startOfDay,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";
import { cn } from "@/lib/utils";
import type { ManagementReport } from "@/lib/management-reports-data";

type BuilderSection = "cover" | "toc" | "preliminary" | "reports" | "endnotes";

const SECTIONS: { id: BuilderSection; label: string }[] = [
  { id: "cover", label: "Cover Page" },
  { id: "toc", label: "Table of Contents" },
  { id: "preliminary", label: "Preliminary Pages" },
  { id: "reports", label: "Reports and Charts" },
  { id: "endnotes", label: "End Notes" },
];

type PreliminaryPage = { id: string; name: string; content: string };

type ReportChartBlock = {
  id: string;
  kind: "report" | "chart";
  selectionId: string;
  title: string;
  period: ReportRangePeriod;
};

function newBlockId() {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function slugId(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ThumbnailPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "aspect-8.5/11 w-full overflow-hidden rounded-md border border-border/80 bg-white shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

const TOC_THUMB_ROWS = [
  { label: 58, page: "1" },
  { label: 48, page: "2" },
  { label: 52, page: "3" },
  { label: 44, page: "5" },
  { label: 50, page: "7" },
  { label: 42, page: "9" },
];

function SectionThumbnail({ section }: { section: BuilderSection }) {
  if (section === "cover") {
    return (
      <ThumbnailPage className="flex flex-col">
        <div className="flex min-h-[24%] flex-col gap-1 bg-[#1e3a5f] px-2.5 pt-3">
          <div className="h-2 w-14 rounded-sm bg-white/45" />
          <div className="h-1.5 w-10 rounded-sm bg-white/30" />
          <div className="h-1.5 w-12 rounded-sm bg-white/22" />
        </div>
        <div className="flex flex-1 flex-col justify-end gap-1 px-2.5 pb-3">
          <div className="h-1.5 w-9 rounded-sm bg-muted-foreground/22" />
          <div className="h-1.5 w-12 rounded-sm bg-muted-foreground/28" />
          <div className="h-1.5 w-10 rounded-sm bg-muted-foreground/20" />
        </div>
        <div className="h-2 shrink-0 bg-[#cce8f4]" />
      </ThumbnailPage>
    );
  }
  if (section === "toc") {
    return (
      <ThumbnailPage className="flex flex-col p-3">
        <div className="mb-2.5 h-2 w-12 rounded-sm bg-muted-foreground/28" />
        <div className="flex flex-1 flex-col justify-center gap-2">
          {TOC_THUMB_ROWS.map((row) => (
            <div key={row.page} className="flex items-center gap-1">
              <div
                className="h-1.5 shrink-0 rounded-sm bg-muted-foreground/25"
                style={{ width: `${row.label}%` }}
              />
              <div className="min-w-2 flex-1 border-b border-dotted border-muted-foreground/35" />
              <span className="w-2.5 shrink-0 text-[9px] font-medium leading-none text-muted-foreground/55">
                {row.page}
              </span>
            </div>
          ))}
        </div>
      </ThumbnailPage>
    );
  }
  if (section === "preliminary") {
    return (
      <ThumbnailPage className="flex flex-col p-3">
        <div className="mb-2 h-2 w-12 rounded-sm bg-muted-foreground/25" />
        <div className="flex flex-1 flex-col gap-1.5">
          {["w-full", "w-[92%]", "w-[95%]", "w-[88%]", "w-full", "w-[90%]"].map((w, i) => (
            <div key={i} className={cn("h-1.5 rounded-sm bg-muted-foreground/18", w)} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 border-t border-muted-foreground/20 pt-2">
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-sm bg-muted-foreground/20" />
            <div className="h-1.5 w-4/5 rounded-sm bg-muted-foreground/15" />
          </div>
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-sm bg-muted-foreground/20" />
            <div className="h-1.5 w-4/5 rounded-sm bg-muted-foreground/15" />
          </div>
        </div>
      </ThumbnailPage>
    );
  }
  if (section === "reports") {
    return (
      <ThumbnailPage className="p-2.5">
        <div className="flex h-full flex-col gap-2">
          <div className="h-2 w-2/3 rounded-sm bg-muted-foreground/25" />
          <div className="flex-1 space-y-1 rounded-sm border border-border/60 p-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-1">
                <div className="h-1.5 w-[28%] rounded-sm bg-muted-foreground/22" />
                <div className="h-1.5 flex-1 rounded-sm bg-muted-foreground/15" />
                <div className="h-1.5 w-[18%] rounded-sm bg-muted-foreground/15" />
              </div>
            ))}
          </div>
          <div className="flex h-[30%] items-center justify-center rounded-sm bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary/75" strokeWidth={2} />
          </div>
        </div>
      </ThumbnailPage>
    );
  }
  return (
    <ThumbnailPage className="flex flex-col p-3">
      <div className="mx-auto mb-2 h-2 w-10 rounded-sm bg-muted-foreground/28" />
      <div className="space-y-1.5">
        <div className="h-1.5 w-full rounded-sm bg-muted-foreground/18" />
        <div className="h-1.5 w-[92%] rounded-sm bg-muted-foreground/18" />
        <div className="h-1.5 w-[88%] rounded-sm bg-muted-foreground/18" />
      </div>
      <div className="my-2 h-px w-full bg-muted-foreground/25" />
      <div className="flex flex-1 flex-col justify-center gap-1.5">
        {[28, 72, 32, 68, 36].map((labelW) => (
          <div key={labelW} className="flex items-center gap-1.5">
            <div
              className="h-1.5 shrink-0 rounded-sm bg-muted-foreground/25"
              style={{ width: `${labelW}%` }}
            />
            <div className="h-1.5 min-w-0 flex-1 rounded-sm bg-muted-foreground/15" />
          </div>
        ))}
      </div>
    </ThumbnailPage>
  );
}

function RichTextToolbar() {
  const tools = [
    { icon: Undo2, label: "Undo" },
    { icon: Redo2, label: "Redo" },
    { icon: Bold, label: "Bold" },
    { icon: Italic, label: "Italic" },
    { icon: Underline, label: "Underline" },
    { icon: AlignLeft, label: "Align" },
    { icon: MoreHorizontal, label: "More" },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1 py-1">
      <Select defaultValue="normal">
        <SelectTrigger className="h-8 w-5.5rem border-0 bg-transparent text-xs shadow-none">
          <SelectValue placeholder="Normal" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="heading">Heading</SelectItem>
        </SelectContent>
      </Select>
      {tools.map(({ icon: Icon, label }) => (
        <Button
          key={label}
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          aria-label={label}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
      <Select defaultValue="font">
        <SelectTrigger className="h-8 w-10 border-0 bg-transparent text-xs shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="font">Aa</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = "min-h-[280px]",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-input bg-background">
      <RichTextToolbar />
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "resize-y rounded-none border-0 shadow-none focus-visible:ring-0",
          minHeight,
        )}
      />
    </div>
  );
}

function BondPaperFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-full max-h-[min(58vh,780px)] overflow-hidden rounded-sm border border-border bg-white shadow-md",
        className,
      )}
      style={{ aspectRatio: "8.5 / 11" }}
    >
      {children}
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function CreateManagementReport() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeSection, setActiveSection] = useState<BuilderSection>("cover");
  const [reportName, setReportName] = useState("");
  const [period, setPeriod] = useState<ReportRangePeriod>("This year");
  const [rangeFrom, setRangeFrom] = useState(() => {
    const today = startOfDay(new Date());
    return new Date(today.getFullYear(), 0, 1);
  });
  const [rangeTo, setRangeTo] = useState(() => startOfDay(new Date()));
  const [template, setTemplate] = useState("classic");
  const [showLogo, setShowLogo] = useState(true);
  const [coverTitle, setCoverTitle] = useState("Management Report");
  const [subtitle, setSubtitle] = useState("Petrosphere Inc.");
  const [reportPeriodText, setReportPeriodText] = useState(() =>
    formatManagementReportCoverPeriod(
      "This year",
      new Date(new Date().getFullYear(), 0, 1),
      startOfDay(new Date()),
    ),
  );
  const [preparedOn, setPreparedOn] = useState(() => startOfDay(new Date()));
  const [preparedBy, setPreparedBy] = useState("");
  const [disclaimer, setDisclaimer] = useState("");
  const [tocTitle, setTocTitle] = useState("Table of contents");
  const [preliminaryPages, setPreliminaryPages] = useState<PreliminaryPage[]>(() => [
    { id: newBlockId(), name: "Page 1", content: "" },
  ]);
  const [reportChartBlocks, setReportChartBlocks] = useState<ReportChartBlock[]>(() => [
    {
      id: newBlockId(),
      kind: "report",
      selectionId: "",
      title: "",
      period: "This year",
    },
  ]);
  const [endNotesTitle, setEndNotesTitle] = useState("");
  const [endNotesIncludeSubAccounts, setEndNotesIncludeSubAccounts] = useState(false);
  const [endNotesContent, setEndNotesContent] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (user?.name) setPreparedBy(user.name);
  }, [user?.name]);

  useEffect(() => {
    setReportPeriodText(formatManagementReportCoverPeriod(period, rangeFrom, rangeTo));
  }, [period, rangeFrom, rangeTo]);

  const handleGlobalPeriodChange = (next: ReportRangePeriod) => {
    setPeriod(next);
    if (!isCustomReportPeriod(next)) {
      const resolved = resolveReportRange(next, rangeFrom, rangeTo);
      setRangeFrom(resolved.from);
      setRangeTo(resolved.to);
    }
    setReportChartBlocks((blocks) =>
      blocks.map((block) => ({ ...block, period: next })),
    );
  };

  const handleRangeFromChange = (date: Date) => {
    setRangeFrom(startOfDay(date));
    setPeriod("Custom dates");
  };

  const handleRangeToChange = (date: Date) => {
    setRangeTo(startOfDay(date));
    setPeriod("Custom dates");
  };

  const displayReportName = reportName.trim() || "Management report name";
  const activeLabel = SECTIONS.find((s) => s.id === activeSection)?.label ?? "Section";

  const builderSnapshot = useMemo<ManagementReportBuilderSnapshot>(
    () => ({
      reportName,
      coverTitle,
      subtitle,
      reportPeriodText,
      reportPeriod: period,
      rangeFrom,
      rangeTo,
      preparedBy,
      preparedOn,
      disclaimer,
      showLogo,
      tocTitle,
      preliminaryPages,
      reportChartBlocks,
      endNotesTitle,
      endNotesIncludeSubAccounts,
      endNotesContent,
    }),
    [
      reportName,
      coverTitle,
      subtitle,
      reportPeriodText,
      period,
      rangeFrom,
      rangeTo,
      preparedBy,
      preparedOn,
      disclaimer,
      showLogo,
      tocTitle,
      preliminaryPages,
      reportChartBlocks,
      endNotesTitle,
      endNotesIncludeSubAccounts,
      endNotesContent,
    ],
  );

  const saveReport = useCallback(
    (closeAfter: boolean) => {
      const name = reportName.trim() || coverTitle.trim() || "Management Report";
      const id = `${slugId(name)}-${Date.now()}`;
      const report: ManagementReport = {
        id,
        name,
        description: "Custom management report",
        category: "Custom",
        createdBy: user?.name ?? "You",
        lastModified: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        isBuiltIn: false,
      };
      appendCustomManagementReport(report);
      toast({
        title: "Report saved",
        description: closeAfter ? `${name} was added to your library.` : `${name} was saved.`,
      });
      if (closeAfter) {
        router.push("/reports/management");
      }
    },
    [coverTitle, reportName, router, toast, user?.name],
  );

  const coverForm = (
    <div className="w-full space-y-4">
      <div className="flex items-end gap-3">
        <FormField label="Template" htmlFor="template" className="min-w-0 flex-1">
          <Select value={template} onValueChange={setTemplate}>
            <SelectTrigger id="template" className="h-10 w-full">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="classic">Classic — navy header</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Logo" className="w-19 shrink-0">
          <button
            type="button"
            onClick={() => setShowLogo((v) => !v)}
            aria-pressed={showLogo}
            aria-label={showLogo ? "Logo shown on cover" : "Logo hidden on cover"}
            className={cn(
              "relative flex h-10 w-full items-center justify-center rounded-md border bg-muted/30 transition-colors",
              showLogo ? "border-primary/50 ring-1 ring-primary/25" : "border-border hover:bg-muted/50",
            )}
          >
            <Layers className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            {showLogo ? (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            ) : null}
          </button>
        </FormField>
      </div>

      <FormField label="Cover title" htmlFor="cover-title" hint="100 characters max">
        <Input
          id="cover-title"
          value={coverTitle}
          onChange={(e) => setCoverTitle(e.target.value)}
          maxLength={100}
          className="h-10"
        />
      </FormField>

      <FormField label="Subtitle" htmlFor="subtitle">
        <Input
          id="subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Petrosphere Inc."
          className="h-10"
        />
      </FormField>

      <FormField label="Report period" htmlFor="report-period-text">
        <Input
          id="report-period-text"
          value={reportPeriodText}
          onChange={(e) => setReportPeriodText(e.target.value)}
          className="h-10"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Prepared on">
          <ReportDatePicker value={preparedOn} onChange={setPreparedOn} className="w-full" />
        </FormField>
        <FormField label="Prepared by" htmlFor="prepared-by">
          <Input
            id="prepared-by"
            value={preparedBy}
            onChange={(e) => setPreparedBy(e.target.value)}
            className="h-10"
          />
        </FormField>
      </div>

      <FormField label="Disclaimer" htmlFor="disclaimer" hint="90 characters max">
        <Textarea
          id="disclaimer"
          value={disclaimer}
          onChange={(e) => setDisclaimer(e.target.value)}
          placeholder="For management review only"
          maxLength={90}
          rows={2}
          className="resize-none"
        />
      </FormField>
    </div>
  );

  const updatePreliminaryPage = (id: string, patch: Partial<PreliminaryPage>) => {
    setPreliminaryPages((pages) => pages.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const movePreliminaryPage = (id: string, direction: "up" | "down") => {
    setPreliminaryPages((pages) => {
      const index = pages.findIndex((p) => p.id === id);
      if (index < 0) return pages;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= pages.length) return pages;
      const next = [...pages];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removePreliminaryPage = (id: string) => {
    setPreliminaryPages((pages) => {
      if (pages.length <= 1) return pages;
      return pages.filter((p) => p.id !== id);
    });
  };

  const addReportChartBlock = (kind: ReportChartBlock["kind"]) => {
    setReportChartBlocks((blocks) => [
      ...blocks,
      { id: newBlockId(), kind, selectionId: "", title: "", period },
    ]);
  };

  const updateReportChartBlock = (id: string, patch: Partial<ReportChartBlock>) => {
    setReportChartBlocks((blocks) => blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const reportsAddMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" className="h-9 gap-1 px-4">
          Add
          <ChevronDown className="h-4 w-4 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => addReportChartBlock("report")}>Report</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => addReportChartBlock("chart")}>Chart</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const tocForm = (
    <div className="w-full space-y-6">
      <FormField label="Title" htmlFor="toc-title">
        <Input
          id="toc-title"
          value={tocTitle}
          onChange={(e) => setTocTitle(e.target.value)}
          className="h-10"
        />
      </FormField>
      <div className="w-full space-y-2">
        <Label className="text-sm font-medium text-foreground">Preview</Label>
        <BondPaperFrame className="flex flex-col p-8 md:p-10">
          <h3 className="text-center text-lg font-normal text-foreground">
            {tocTitle.trim() || "Table of contents"}
          </h3>
          <div className="my-4 h-px w-full bg-border" />
          <p className="text-center text-sm text-muted-foreground">
            No table of contents entries found.
          </p>
        </BondPaperFrame>
      </div>
    </div>
  );

  const preliminaryForm = (
    <div className="w-full space-y-6">
      {preliminaryPages.map((page, index) => (
        <div key={page.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={page.name}
              onChange={(e) => updatePreliminaryPage(page.id, { name: e.target.value })}
              className="h-10 max-w-xs font-medium"
              aria-label={`Page ${index + 1} name`}
            />
            <div className="ml-auto flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                aria-label="Delete page"
                disabled={preliminaryPages.length <= 1}
                onClick={() => removePreliminaryPage(page.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                aria-label="Move page up"
                disabled={index === 0}
                onClick={() => movePreliminaryPage(page.id, "up")}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                aria-label="Move page down"
                disabled={index === preliminaryPages.length - 1}
                onClick={() => movePreliminaryPage(page.id, "down")}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <RichTextEditor
            value={page.content}
            onChange={(content) => updatePreliminaryPage(page.id, { content })}
            placeholder="Start typing..."
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        className="h-10 gap-2 text-primary hover:text-primary"
        onClick={() =>
          setPreliminaryPages((pages) => [
            ...pages,
            { id: newBlockId(), name: `Page ${pages.length + 1}`, content: "" },
          ])
        }
      >
        <Plus className="h-4 w-4" />
        Add New Page
      </Button>
    </div>
  );

  const reportsForm = (() => {
    const blocks = reportChartBlocks;

    return (
    <div className="w-full">
      {blocks.length === 0 ? (
        <div className="flex min-h-[min(420px,50vh)] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <p className="max-w-md text-sm text-muted-foreground">
            Add a report or chart to include it in your management report.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" onClick={() => addReportChartBlock("report")}>
              Add report
            </Button>
            <Button type="button" variant="outline" onClick={() => addReportChartBlock("chart")}>
              Add chart
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {blocks.map((block) => {
            const isReport = block.kind === "report";
            const catalog = isReport ? MANAGEMENT_REPORT_CATALOG : EMBEDDABLE_CHARTS;
            const selectedLabel = isReport
              ? MANAGEMENT_REPORT_CATALOG.find((item) => item.id === block.selectionId)?.label
              : EMBEDDABLE_CHARTS.find((item) => item.id === block.selectionId)?.label;

            return (
              <div
                key={block.id}
                className="space-y-4 rounded-md border border-border/70 bg-[#f4f5f7] p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="cursor-grab text-muted-foreground/70 active:cursor-grabbing"
                    aria-label={`Reorder ${isReport ? "report" : "chart"}`}
                  >
                    <GripVertical className="h-5 w-5" />
                  </button>
                  <span className="text-sm font-medium text-foreground">
                    {isReport ? "Report" : "Chart"}
                  </span>
                  <Badge
                    variant="default"
                    className="rounded px-2 py-0 text-[10px] font-bold uppercase tracking-wide"
                  >
                    {isReport ? "Report" : "Chart"}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-9 w-9 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${isReport ? "report" : "chart"}`}
                    onClick={() =>
                      setReportChartBlocks((blocks) => blocks.filter((b) => b.id !== block.id))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <FormField label={isReport ? "Report" : "Chart"}>
                  <Select
                    value={block.selectionId || undefined}
                    onValueChange={(selectionId) => {
                      const label = isReport
                        ? (MANAGEMENT_REPORT_CATALOG.find((item) => item.id === selectionId)
                            ?.label ?? "")
                        : (EMBEDDABLE_CHARTS.find((item) => item.id === selectionId)?.label ?? "");
                      updateReportChartBlock(block.id, {
                        selectionId,
                        title: block.title.trim() || label,
                      });
                    }}
                  >
                    <SelectTrigger className="h-10 w-full border-input bg-white">
                      <SelectValue placeholder={isReport ? "Select report" : "Select chart"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(24rem,70vh)]">
                      {catalog.map((item) => (
                        <SelectItem
                          key={item.id}
                          value={item.id}
                          endAdornment={
                            isReport && "categoryLabel" in item ? (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {item.categoryLabel}
                              </span>
                            ) : undefined
                          }
                        >
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label={isReport ? "Report title" : "Chart title"}
                    htmlFor={`title-${block.id}`}
                    hint="100 characters max"
                  >
                    <Input
                      id={`title-${block.id}`}
                      value={block.title}
                      onChange={(e) => updateReportChartBlock(block.id, { title: e.target.value })}
                      placeholder={
                        selectedLabel
                          ? selectedLabel
                          : isReport
                            ? "Enter report title"
                            : "Enter chart title"
                      }
                      maxLength={100}
                      className="h-10 border-input bg-white"
                    />
                  </FormField>
                  <FormField label={isReport ? "Report period" : "Chart period"}>
                    <ManagementReportPeriodSelect
                      showLabel={false}
                      value={block.period}
                      onChange={(p) => updateReportChartBlock(block.id, { period: p })}
                      className="w-full"
                    />
                  </FormField>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    );
  })();

  const endNotesForm = (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <FormField label="Page title" htmlFor="endnotes-title" className="min-w-0 flex-1 sm:max-w-md">
          <Input
            id="endnotes-title"
            value={endNotesTitle}
            onChange={(e) => setEndNotesTitle(e.target.value)}
            placeholder="Enter page title"
            className="h-10"
          />
        </FormField>
        <div className="flex items-center gap-2 pb-1 sm:pb-0">
          <Checkbox
            id="endnotes-subaccounts"
            checked={endNotesIncludeSubAccounts}
            onCheckedChange={(checked) => setEndNotesIncludeSubAccounts(checked === true)}
          />
          <Label htmlFor="endnotes-subaccounts" className="text-sm font-normal leading-snug">
            Include breakdown of sub-accounts
          </Label>
        </div>
      </div>
      <RichTextEditor
        value={endNotesContent}
        onChange={setEndNotesContent}
        placeholder="Start typing..."
        minHeight="min-h-[360px]"
      />
    </div>
  );

  const editorPanel =
    activeSection === "cover"
      ? coverForm
      : activeSection === "toc"
        ? tocForm
        : activeSection === "preliminary"
          ? preliminaryForm
          : activeSection === "reports"
            ? reportsForm
            : endNotesForm;

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-white">
      {/* Header — QuickBooks-style row layout, PetroBook styling */}
      <header className="shrink-0 border-b bg-white px-4 pt-3 pb-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[1.35rem] font-normal text-foreground">Create Management Report</h1>
          <div className="flex shrink-0 flex-wrap items-end justify-end gap-2">
            <ManagementReportPeriodSelect
              showLabel={false}
              value={period}
              onChange={handleGlobalPeriodChange}
              className="w-44 shrink-0"
            />
            <ReportDateField
              label="From"
              value={rangeFrom}
              onChange={handleRangeFromChange}
              onDatePicked={() => setPeriod("Custom dates")}
            />
            <ReportDateField
              label="To"
              value={rangeTo}
              onChange={handleRangeToChange}
              onDatePicked={() => setPeriod("Custom dates")}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden h-9 text-muted-foreground sm:inline-flex"
            >
              <MessageSquare className="mr-1 h-4 w-4" />
              Give feedback
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Help">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link href="/reports/management" aria-label="Close">
                <X className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
        <Input
          value={reportName}
          onChange={(e) => setReportName(e.target.value)}
          placeholder="Management report name"
          className="mt-3 h-10 max-w-xl border-2 border-primary/35 bg-background shadow-none focus-visible:border-primary focus-visible:ring-primary/20"
        />
      </header>

      {/* Grid: sections | form | cover preview (preview column only on Cover page) */}
      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1",
          activeSection === "cover"
            ? "lg:grid-cols-[15rem_minmax(0,1fr)_32rem]"
            : "lg:grid-cols-[15rem_minmax(0,1fr)]",
        )}
      >
        <aside className="hidden min-h-0 flex-col overflow-hidden border-r bg-muted/30 lg:flex">
          <div className="h-full min-h-0 overflow-y-auto overscroll-y-contain px-3.5 py-4">
            <div className="space-y-4">
              {SECTIONS.map((section) => {
                const active = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full rounded-md p-1.5 text-left transition-colors",
                      active
                        ? "bg-white ring-2 ring-primary ring-offset-0"
                        : "hover:bg-white/80",
                    )}
                  >
                    <SectionThumbnail section={section.id} />
                    <span
                      className={cn(
                        "mt-2.5 block px-0.5 text-sm leading-snug",
                        active ? "font-medium text-primary" : "text-muted-foreground",
                      )}
                    >
                      {section.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col border-r bg-white">
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 lg:hidden">
            {SECTIONS.map((section) => (
              <Button
                key={section.id}
                type="button"
                variant={activeSection === section.id ? "default" : "outline"}
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </Button>
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">{activeLabel}</h2>
            {activeSection === "reports" ? reportsAddMenu : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{editorPanel}</div>
        </section>

        {activeSection === "cover" ? (
          <aside className="relative hidden min-h-0 flex-col bg-[#e8eaed] lg:flex lg:border-l">
            <div className="flex h-full min-h-0 items-start justify-center overflow-y-auto p-3">
              <div
                className="w-full shadow-[0_1px_6px_rgba(0,0,0,0.18)]"
                style={{ aspectRatio: "8.5 / 11" }}
              >
                <ManagementReportCoverPage
                  coverTitle={coverTitle}
                  subtitle={subtitle}
                  reportPeriodText={reportPeriodText}
                  preparedBy={preparedBy}
                  preparedOn={preparedOn}
                  disclaimer={disclaimer}
                  showLogo={showLogo}
                  className="h-full w-full shadow-none ring-1 ring-black/8"
                />
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {activeSection === "cover" ? (
        <div className="shrink-0 border-t bg-[#e8eaed] p-4 lg:hidden">
          <div className="mx-auto max-w-xs" style={{ aspectRatio: "8.5 / 11" }}>
            <ManagementReportCoverPage
              coverTitle={coverTitle}
              subtitle={subtitle}
              reportPeriodText={reportPeriodText}
              preparedBy={preparedBy}
              preparedOn={preparedOn}
              disclaimer={disclaimer}
              showLogo={showLogo}
              className="shadow-md ring-1 ring-black/8"
            />
          </div>
        </div>
      ) : null}

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-white px-4 py-2.5">
        <Button type="button" variant="outline" className="h-10" asChild>
          <Link href="/reports/management">Cancel</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setPreviewOpen(true)}
          >
            Preview report
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center font-medium text-primary hover:underline"
              >
                More options
                <ChevronDown className="ml-0.5 h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem onClick={() => toast({ title: "Duplicate template" })}>
                Duplicate from template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast({ title: "Reset cover page" })}>
                Reset cover page
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 min-w-22 border-primary text-primary hover:bg-primary/5"
            onClick={() => saveReport(false)}
          >
            Save
          </Button>
          <div className="inline-flex h-9 items-stretch overflow-hidden rounded-md shadow-sm">
            <Button
              type="button"
              className="h-full rounded-none rounded-l-md px-5"
              onClick={() => saveReport(true)}
            >
              Save and close
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  className="h-full w-9 shrink-0 rounded-none rounded-r-md border-0 border-l border-primary-foreground/25"
                  aria-label="Save options"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => saveReport(false)}>Save</DropdownMenuItem>
                <DropdownMenuItem onClick={() => saveReport(true)}>Save and close</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </footer>

      <ManagementReportBuilderPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        snapshot={builderSnapshot}
      />
    </div>
  );
}
