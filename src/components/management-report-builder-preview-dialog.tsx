"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  Plus,
  Printer,
} from "lucide-react";
import { ManagementReportBlockContent } from "@/components/management-report-block-content";
import { ManagementReportCoverPage } from "@/components/management-report-cover-page";
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
  blockDisplayTitle,
  buildPagesWithToc,
  type DocumentPageWithToc,
  type ManagementReportBuilderSnapshot,
  type TocEntry,
} from "@/lib/management-report-document-pages";
import { formatManagementReportCoverPeriod } from "@/lib/report-date-utils";
import { printReport } from "@/lib/print-report";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCustomersAndLeadsBootstrap } from "@/hooks/use-customers-and-leads-bootstrap";
import { useMockChartAccounts } from "@/hooks/use-mock-chart-accounts";
import { useMockExpenses } from "@/hooks/use-mock-expenses";
import { useMockSales } from "@/hooks/use-mock-sales";

type ManagementReportBuilderPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: ManagementReportBuilderSnapshot;
  printOnOpen?: boolean;
  onPrintOnOpenComplete?: () => void;
};

const DocumentPageView = memo(function DocumentPageView({
  page,
  snapshot,
}: {
  page: DocumentPageWithToc;
  snapshot: ManagementReportBuilderSnapshot;
}) {
  if (page.kind === "cover") {
    return (
      <ManagementReportCoverPage
        coverTitle={snapshot.coverTitle}
        subtitle={snapshot.subtitle}
        reportPeriodText={snapshot.reportPeriodText}
        preparedBy={snapshot.preparedBy}
        preparedOn={snapshot.preparedOn}
        disclaimer={snapshot.disclaimer}
        showLogo={snapshot.showLogo}
        className="shadow-none ring-0"
      />
    );
  }

  if (page.kind === "toc") {
    const entries = page.tocEntries ?? [];
    return (
      <div className="flex h-full flex-col bg-white px-10 py-12 font-sans">
        <h2 className="text-center text-2xl font-normal text-foreground">
          {snapshot.tocTitle.trim() || "Table of contents"}
        </h2>
        <div className="my-6 h-px w-full bg-border" />
        {entries.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No table of contents entries found.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <TocRow key={`${entry.title}-${entry.page}`} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (page.kind === "preliminary" && page.preliminaryPage) {
    return (
      <div className="flex h-full flex-col bg-white px-10 py-10 font-sans">
        <h2 className="text-xl font-semibold text-foreground">{page.preliminaryPage.name}</h2>
        <div className="mt-6 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {page.preliminaryPage.content.trim() || (
            <span className="text-muted-foreground">Preliminary page content</span>
          )}
        </div>
      </div>
    );
  }

  if ((page.kind === "report" || page.kind === "chart") && page.reportBlock) {
    const block = page.reportBlock;
    const title = blockDisplayTitle(block);
    return (
      <div className="flex flex-col bg-white px-5 py-6 font-sans sm:px-6">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatManagementReportCoverPeriod(
            block.period,
            snapshot.rangeFrom ?? new Date(new Date().getFullYear(), 0, 1),
            snapshot.rangeTo ?? new Date(),
          )}
        </p>
        <div className="mt-4 overflow-visible">
          <ManagementReportBlockContent
            selectionId={block.selectionId}
            rangeFrom={snapshot.rangeFrom}
            rangeTo={snapshot.rangeTo}
            period={block.period}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white px-10 py-10 font-sans">
      <h2 className="text-xl font-semibold text-foreground">
        {snapshot.endNotesTitle.trim() || "End Notes"}
      </h2>
      {snapshot.endNotesIncludeSubAccounts ? (
        <p className="mt-2 text-xs text-muted-foreground">Includes breakdown of sub-accounts</p>
      ) : null}
      <div className="mt-6 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {snapshot.endNotesContent.trim() || (
          <span className="text-muted-foreground">End Notes Content</span>
        )}
      </div>
    </div>
  );
});

function TocRow({ entry }: { entry: TocEntry }) {
  return (
    <li className="flex items-end gap-2 text-sm text-foreground">
      <span className="shrink-0">{entry.title}</span>
      <span className="min-w-4 flex-1 border-b border-dotted border-muted-foreground/40" />
      <span className="shrink-0 tabular-nums">{entry.page}</span>
    </li>
  );
}

function PageThumbnail({ page }: { page: DocumentPageWithToc }) {
  if (page.kind === "cover") {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <div className="h-[28%] bg-[#1e3a5f]" />
        <div className="flex flex-1 flex-col justify-end gap-0.5 p-1">
          <div className="h-0.5 w-6 rounded bg-muted-foreground/25" />
          <div className="h-0.5 w-8 rounded bg-muted-foreground/30" />
        </div>
        <div className="h-1 bg-[#cce8f4]" />
      </div>
    );
  }

  if (page.kind === "toc") {
    return (
      <div className="flex h-full flex-col bg-white p-1.5">
        <div className="mb-1 h-1 w-6 rounded bg-muted-foreground/25" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="mb-0.5 flex items-center gap-0.5">
            <div className="h-0.5 w-1/2 rounded bg-muted-foreground/20" />
            <div className="min-w-1 flex-1 border-b border-dotted border-muted-foreground/30" />
          </div>
        ))}
      </div>
    );
  }

  if (page.kind === "chart") {
    return (
      <div className="flex h-full flex-col bg-white p-1.5">
        <div className="mb-1 h-1 w-2/3 rounded bg-muted-foreground/25" />
        <div className="flex flex-1 items-end justify-center rounded-sm bg-primary/10 pb-0.5">
          <div className="flex h-4 items-end gap-0.5">
            {[6, 10, 8, 12].map((h) => (
              <div key={h} className="w-1 rounded-t bg-primary/50" style={{ height: h }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (page.kind === "report") {
    return (
      <div className="flex h-full flex-col bg-white p-1.5">
        <div className="mb-1 h-1 w-2/3 rounded bg-muted-foreground/25" />
        <div className="flex-1 space-y-0.5 rounded-sm border border-border/60 p-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-0.5 w-full rounded bg-muted-foreground/15" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white p-1.5">
      <div className="mb-1 h-1 w-2/3 rounded bg-muted-foreground/25" />
      <div className="flex-1 space-y-0.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-0.5 w-full rounded bg-muted-foreground/12" />
        ))}
      </div>
    </div>
  );
}

export function ManagementReportBuilderPreviewDialog({
  open,
  onOpenChange,
  snapshot,
  printOnOpen = false,
  onPrintOnOpenComplete,
}: ManagementReportBuilderPreviewDialogProps) {
  const { toast } = useToast();
  useMockSales();
  useMockExpenses();
  useMockChartAccounts();
  useCustomersAndLeadsBootstrap();
  const pages = useMemo(() => buildPagesWithToc(snapshot), [snapshot]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  /** Heavy report pages (e.g. 400+ AR rows) only mount for print — not while scrolling preview. */
  const [printMount, setPrintMount] = useState(false);

  useEffect(() => {
    if (open) {
      setActivePageIndex(0);
      setZoom(100);
      setPrintMount(false);
    }
  }, [open]);

  useEffect(() => {
    const onAfterPrint = () => {
      setPrintMount(false);
      onPrintOnOpenComplete?.();
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [onPrintOnOpenComplete]);

  useEffect(() => {
    if (!printMount) return;
    const timer = window.setTimeout(() => {
      printReport();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [printMount]);

  useEffect(() => {
    if (!open || !printOnOpen) return;
    setPrintMount(true);
  }, [open, printOnOpen]);

  const activePage = pages[activePageIndex] ?? pages[0];
  const usesFixedPageHeight =
    activePage?.kind === "cover" ||
    activePage?.kind === "toc" ||
    activePage?.kind === "preliminary" ||
    activePage?.kind === "endnotes";
  const usesWidePageLayout = !usesFixedPageHeight;
  const pageMaxWidth = usesWidePageLayout ? 1280 : 820;
  const fileName =
    snapshot.reportName.trim() ||
    snapshot.coverTitle.trim() ||
    "management-report";

  const requestPrint = useCallback(() => {
    setPrintMount(true);
  }, []);

  const handlePrint = () => {
    toast({ title: "Print", description: "Use your browser print dialog to print or save as PDF." });
    requestPrint();
  };

  const handleSavePdf = () => {
    toast({
      title: "Save as PDF",
      description: "Choose “Save as PDF” in the print dialog to download your report.",
    });
    requestPrint();
  };

  const zoomFactor = zoom / 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(96vh,960px)] max-h-[96vh] w-[min(99vw,1720px)] max-w-[1720px] flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
        <DialogHeader className="space-y-1 border-b px-6 py-4 text-left print:hidden">
          <DialogTitle className="text-xl font-normal">Print or save as PDF</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            To print, right-click the preview and select Print. Or, click the Print icon if you see
            one below.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col bg-[#525659] print:bg-white print:overflow-visible">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-black/20 bg-[#323639] px-3 text-white print:hidden">
            <span className="truncate text-xs text-white/90">{fileName}.pdf</span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Previous page"
                disabled={activePageIndex <= 0}
                onClick={() => setActivePageIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-14 text-center text-xs tabular-nums text-white/90">
                {activePageIndex + 1} / {pages.length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Next page"
                disabled={activePageIndex >= pages.length - 1}
                onClick={() => setActivePageIndex((i) => Math.min(pages.length - 1, i + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="mx-2 hidden h-5 w-px bg-white/20 sm:block" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white sm:inline-flex"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(70, z - 10))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="hidden min-w-10 text-center text-xs tabular-nums text-white/80 sm:inline">
                {zoom}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white sm:inline-flex"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(150, z + 10))}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Print"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Download"
                onClick={handleSavePdf}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            <aside className="hidden w-40 shrink-0 overflow-y-auto border-r border-black/20 bg-[#323639] p-2.5 sm:block print:hidden">
              <div className="space-y-3">
                {pages.map((page, index) => {
                  const active = index === activePageIndex;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setActivePageIndex(index)}
                      className={cn(
                        "w-full text-left transition-colors",
                        active ? "ring-2 ring-primary ring-offset-1 ring-offset-[#323639]" : "",
                      )}
                    >
                      <div
                        className="overflow-hidden rounded-sm bg-white shadow-sm"
                        style={{ aspectRatio: "8.5 / 11" }}
                      >
                        <PageThumbnail page={page} />
                      </div>
                      <span className="mt-1 block truncate text-center text-[10px] leading-tight text-white/75">
                        {index + 1}. {page.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Screen: one page at a time — no CSS transform (that lagged on 400+ row tables). */}
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-3 sm:p-5 print:hidden [scrollbar-gutter:stable]">
              <div
                className="w-full origin-top bg-white shadow-2xl"
                style={{
                  maxWidth: `${pageMaxWidth}px`,
                  ...(usesFixedPageHeight
                    ? { aspectRatio: "8.5 / 11" }
                    : { minHeight: "1056px" }),
                  // `zoom` keeps layout + scroll in sync; transform.scale did not.
                  zoom: zoomFactor,
                }}
              >
                {activePage ? (
                  <DocumentPageView page={activePage} snapshot={snapshot} />
                ) : null}
              </div>
            </div>

            {/* Print copies mount only when printing — avoids a second 462-row AR tree while scrolling. */}
            {printMount ? (
              <div className="hidden print:block print:w-full print:bg-white">
                {pages.map((page) => (
                  <div
                    key={`print-${page.id}`}
                    className="management-report-print-page mx-auto w-full max-w-[1280px] bg-white"
                  >
                    <DocumentPageView page={page} snapshot={snapshot} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t px-6 py-4 sm:justify-end print:hidden">
          <Button type="button" variant="outline" onClick={handleSavePdf}>
            Save as PDF
          </Button>
          <Button type="button" onClick={handlePrint}>
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
