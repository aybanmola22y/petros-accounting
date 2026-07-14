import {
  formatManagementReportCoverPeriod,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";
import { EMBEDDABLE_REPORTS } from "@/lib/management-report-catalog";

export { EMBEDDABLE_REPORTS };

export const EMBEDDABLE_CHARTS = [
  { id: "revenue-trend", label: "Revenue Trend" },
  { id: "expense-breakdown", label: "Expense breakdown" },
  { id: "cash-flow", label: "Cash flow summary" },
  { id: "profit-margin", label: "Profit margin" },
] as const;

export type PreliminaryPageSnapshot = {
  id: string;
  name: string;
  content: string;
};

export type ReportChartBlockSnapshot = {
  id: string;
  kind: "report" | "chart";
  selectionId: string;
  title: string;
  period: ReportRangePeriod;
};

export type ManagementReportBuilderSnapshot = {
  reportName: string;
  coverTitle: string;
  subtitle: string;
  reportPeriodText: string;
  reportPeriod?: ReportRangePeriod;
  rangeFrom?: Date;
  rangeTo?: Date;
  preparedBy: string;
  preparedOn: Date;
  disclaimer: string;
  showLogo: boolean;
  tocTitle: string;
  preliminaryPages: PreliminaryPageSnapshot[];
  reportChartBlocks: ReportChartBlockSnapshot[];
  endNotesTitle: string;
  endNotesIncludeSubAccounts: boolean;
  endNotesContent: string;
  /** Defaults to true when omitted. Set false to drop the End Notes page from the document. */
  includeEndNotes?: boolean;
};

export type DocumentPageKind = "cover" | "toc" | "preliminary" | "report" | "chart" | "endnotes";

export type TocEntry = {
  title: string;
  page: number;
};

export type DocumentPage = {
  id: string;
  kind: DocumentPageKind;
  label: string;
  pageNumber: number;
  preliminaryPage?: PreliminaryPageSnapshot;
  reportBlock?: ReportChartBlockSnapshot;
};

export type DocumentPageWithToc = DocumentPage & { tocEntries?: TocEntry[] };

function selectionLabel(block: ReportChartBlockSnapshot): string {
  if (block.kind === "report") {
    return EMBEDDABLE_REPORTS.find((r) => r.id === block.selectionId)?.label ?? "Report";
  }
  return EMBEDDABLE_CHARTS.find((c) => c.id === block.selectionId)?.label ?? "Chart";
}

export const MANAGEMENT_REPORT_COMPANY = "Petrosphere Inc.";

function blockId(prefix: string, stableKey?: string) {
  if (stableKey) return `${prefix}-${stableKey}`;
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildManagementReportSnapshot(
  report: {
    id: string;
    name: string;
    description: string;
    createdBy: string;
  },
  period: ReportRangePeriod,
  preparedBy = "PetroBook",
  customFrom?: Date,
  customTo?: Date,
): ManagementReportBuilderSnapshot {
  const today = new Date();
  const rangeFrom = customFrom ?? new Date(today.getFullYear(), 0, 1);
  const rangeTo = customTo ?? today;

  const base: ManagementReportBuilderSnapshot = {
    reportName: report.name,
    coverTitle: "Management Report",
    subtitle: MANAGEMENT_REPORT_COMPANY,
    reportPeriodText: formatManagementReportCoverPeriod(period, rangeFrom, rangeTo),
    reportPeriod: period,
    rangeFrom,
    rangeTo,
    preparedBy: report.createdBy === "PetroBook" ? preparedBy : report.createdBy,
    preparedOn: new Date(),
    disclaimer: "For management review only",
    showLogo: true,
    tocTitle: "Table of contents",
    preliminaryPages: [],
    reportChartBlocks: [],
    endNotesTitle: "End Notes",
    endNotesIncludeSubAccounts: false,
    endNotesContent: "",
  };

  switch (report.id) {
    case "company-overview":
      return {
        ...base,
        includeEndNotes: false,
        reportChartBlocks: [
          {
            id: blockId("report", "company-overview-pl"),
            kind: "report",
            selectionId: "profit-and-loss",
            title: "Profit and Loss",
            period,
          },
          {
            id: blockId("report", "company-overview-bs"),
            kind: "report",
            selectionId: "balance-sheet",
            title: "Balance Sheet",
            period,
          },
        ],
      };
    case "sales-performance":
      return {
        ...base,
        includeEndNotes: false,
        reportChartBlocks: [
          {
            id: blockId("report"),
            kind: "report",
            selectionId: "profit-and-loss",
            title: "Profit and Loss",
            period,
          },
          {
            id: blockId("report"),
            kind: "report",
            selectionId: "ar-aging-detail",
            title: "A/R Ageing Detail",
            period,
          },
          {
            id: blockId("report"),
            kind: "report",
            selectionId: "sales-by-customer-summary",
            title: "Sales by Customer Summary",
            period,
          },
        ],
      };
    case "expenses-performance":
      return {
        ...base,
        includeEndNotes: false,
        reportChartBlocks: [
          {
            id: blockId("report", "expenses-performance-pl"),
            kind: "report",
            selectionId: "profit-and-loss",
            title: "Profit & Loss",
            period,
          },
          {
            id: blockId("report", "expenses-performance-ap"),
            kind: "report",
            selectionId: "ap-aging-detail",
            title: "A/P Ageing Detail",
            period,
          },
          {
            id: blockId("report", "expenses-performance-supplier"),
            kind: "report",
            selectionId: "expenses-by-supplier-summary",
            title: "Expenses by Supplier Summary",
            period,
          },
        ],
      };
    default:
      return {
        ...base,
        coverTitle: report.name,
        preliminaryPages: [
          {
            id: blockId("prelim"),
            name: "Overview",
            content: report.description,
          },
        ],
        reportChartBlocks: [
          {
            id: blockId("report"),
            kind: "report",
            selectionId: "profit-and-loss",
            title: report.name,
            period,
          },
        ],
      };
  }
}

export function blockDisplayTitle(block: ReportChartBlockSnapshot): string {
  return block.title.trim() || selectionLabel(block);
}

export function buildPagesWithToc(snapshot: ManagementReportBuilderSnapshot): DocumentPageWithToc[] {
  const contentPages: Omit<DocumentPage, "pageNumber">[] = [
    ...snapshot.preliminaryPages.map((preliminaryPage) => ({
      id: preliminaryPage.id,
      kind: "preliminary" as const,
      label: preliminaryPage.name.trim() || "Preliminary page",
      preliminaryPage,
    })),
    ...snapshot.reportChartBlocks.map((block) => ({
      id: block.id,
      kind: block.kind,
      label: blockDisplayTitle(block),
      reportBlock: block,
    })),
    ...(snapshot.includeEndNotes === false
      ? []
      : [
          {
            id: "endnotes",
            kind: "endnotes" as const,
            label: snapshot.endNotesTitle.trim() || "End Notes",
          },
        ]),
  ];

  const tocEntries: TocEntry[] = contentPages.map((page, index) => ({
    title: page.label,
    page: index + 3,
  }));

  return [
    {
      id: "cover",
      kind: "cover",
      label: "Cover page",
      pageNumber: 1,
    },
    {
      id: "toc",
      kind: "toc",
      label: snapshot.tocTitle.trim() || "Table of contents",
      pageNumber: 2,
      tocEntries,
    },
    ...contentPages.map((page, index) => ({
      ...page,
      pageNumber: index + 3,
    })),
  ];
}
