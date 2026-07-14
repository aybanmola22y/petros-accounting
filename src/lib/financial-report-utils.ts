import {
  formatReportRangeLabel,
  monthsInRange,
  quartersInRange,
  startOfDay,
  yearsInRange,
  type ReportDateRange,
} from "@/lib/report-date-utils";
import type { ReportLine } from "@/views/financial-report-shared";

export type AccountingMethod = "Cash" | "Accrual";

export const DISPLAY_COLUMNS_OPTIONS = [
  { value: "class", label: "Class" },
  { value: "customer", label: "Customer" },
  { value: "location", label: "Location" },
  { value: "product-service", label: "Product/Service" },
  { value: "supplier", label: "Supplier" },
  { value: "months", label: "Months" },
  { value: "quarters", label: "Quarters" },
  { value: "years", label: "Years" },
] as const;

export type DisplayColumnsByOption = (typeof DISPLAY_COLUMNS_OPTIONS)[number]["value"];
export type DisplayColumnsBy = "none" | DisplayColumnsByOption;

export const COMPARE_TO_GROUPS = [
  {
    label: "Time Periods",
    options: [
      { value: "previous-year", label: "Previous year (PY)" },
      { value: "previous-period", label: "Previous Period (PP)" },
      { value: "custom-period", label: "Custom period (CP)" },
    ],
  },
  {
    label: "Calculations",
    options: [
      { value: "percent-of-row", label: "% of Row" },
      { value: "percent-of-column", label: "% of Column" },
    ],
  },
] as const;

export type CompareToOption = (typeof COMPARE_TO_GROUPS)[number]["options"][number]["value"];
export type CompareToSelection = CompareToOption[];

export type AmountColumnKind = "data" | "compare";
export type AmountColumnFormat = "currency" | "percent";

export type AmountColumn = {
  id: string;
  label: string;
  kind?: AmountColumnKind;
  format?: AmountColumnFormat;
};

const DIMENSION_COLUMNS: Record<
  Exclude<DisplayColumnsByOption, "months" | "quarters" | "years">,
  AmountColumn[]
> = {
  class: [
    { id: "class-admin", label: "Administrative", kind: "data" },
    { id: "class-ops", label: "Operations", kind: "data" },
    { id: "class-other", label: "Unassigned", kind: "data" },
  ],
  customer: [
    { id: "cust-a", label: "ABC Logistics Corp.", kind: "data" },
    { id: "cust-b", label: "Metro Fuel Trading", kind: "data" },
    { id: "cust-other", label: "Other", kind: "data" },
  ],
  location: [
    { id: "loc-hq", label: "Head Office", kind: "data" },
    { id: "loc-north", label: "North Depot", kind: "data" },
    { id: "loc-south", label: "South Depot", kind: "data" },
  ],
  "product-service": [
    { id: "ps-fuel", label: "Fuel Products", kind: "data" },
    { id: "ps-lube", label: "Lubricants", kind: "data" },
    { id: "ps-svc", label: "Services", kind: "data" },
  ],
  supplier: [
    { id: "sup-1", label: "PetroChem Supplies", kind: "data" },
    { id: "sup-2", label: "Global Energy Co.", kind: "data" },
    { id: "sup-other", label: "Other", kind: "data" },
  ],
};

const CASH_FACTOR = 0.985;
const PRIOR_PERIOD_FACTOR = 0.97;
const PRIOR_YEAR_FACTOR = 0.88;
const CUSTOM_PERIOD_FACTOR = 0.95;

const MULTI_COLUMN_DISPLAYS: DisplayColumnsByOption[] = [
  "class",
  "customer",
  "location",
  "product-service",
  "supplier",
  "months",
  "quarters",
  "years",
];

const COMPARE_OPTION_LABELS: Record<CompareToOption, string> = {
  "previous-year": "Previous year (PY)",
  "previous-period": "Previous Period (PP)",
  "custom-period": "Custom period (CP)",
  "percent-of-row": "% of Row",
  "percent-of-column": "% of Column",
};

function cashAdjust(amount: number, method: AccountingMethod): number {
  if (method === "Accrual") return amount;
  return Math.round(amount * CASH_FACTOR * 100) / 100;
}

function splitAcrossBuckets(total: number | undefined, buckets: number): number[] | undefined {
  if (total === undefined) return undefined;
  if (buckets <= 0) return [total];
  const per = Math.round((total / buckets) * 100) / 100;
  const values = Array.from({ length: buckets }, () => per);
  const sum = values.reduce((a, b) => a + b, 0);
  values[buckets - 1] = Math.round((total - sum + per) * 100) / 100;
  return values;
}

function periodColumns(
  range: ReportDateRange,
  displayBy: "months" | "quarters" | "years",
): AmountColumn[] {
  const cols =
    displayBy === "months"
      ? monthsInRange(range.from, range.to)
      : displayBy === "quarters"
        ? quartersInRange(range.from, range.to)
        : yearsInRange(range.from, range.to);
  return cols.map((c) => ({ ...c, kind: "data" as const }));
}

function compareColumnsFromSelection(selection: CompareToSelection): AmountColumn[] {
  return selection.map((opt) => ({
    id: `compare-${opt}`,
    label: COMPARE_OPTION_LABELS[opt],
    kind: "compare" as const,
    format:
      opt === "percent-of-row" || opt === "percent-of-column" ? "percent" : "currency",
  }));
}

export function formatCompareToTriggerLabel(selection: CompareToSelection): string {
  if (selection.length === 0) return "";
  if (selection.length === 1) return COMPARE_OPTION_LABELS[selection[0]!];
  return `${selection.length} selected`;
}

export function buildAmountColumns(
  range: ReportDateRange,
  displayBy: DisplayColumnsBy,
  compareTo: CompareToSelection,
): AmountColumn[] {
  let cols: AmountColumn[];

  if (displayBy === "none") {
    cols = [{ id: "total", label: "Total", kind: "data" }];
  } else if (displayBy === "months" || displayBy === "quarters" || displayBy === "years") {
    cols = periodColumns(range, displayBy);
  } else {
    cols = [...DIMENSION_COLUMNS[displayBy]];
  }

  const compareCols = compareColumnsFromSelection(compareTo);
  cols = [...cols, ...compareCols];
  return cols.length > 0 ? cols : [{ id: "total", label: "Total", kind: "data" }];
}

function sumReportAmounts(lines: ReportLine[]): number {
  let sum = 0;
  for (const line of lines) {
    if (line.amount !== undefined) sum += Math.abs(line.amount);
    if (line.children?.length) sum += sumReportAmounts(line.children);
  }
  return sum || 1;
}

function compareValue(
  base: number,
  opt: CompareToOption,
  reportTotal: number,
): number {
  switch (opt) {
    case "previous-year":
      return Math.round(base * PRIOR_YEAR_FACTOR * 100) / 100;
    case "previous-period":
      return Math.round(base * PRIOR_PERIOD_FACTOR * 100) / 100;
    case "custom-period":
      return Math.round(base * CUSTOM_PERIOD_FACTOR * 100) / 100;
    case "percent-of-row":
    case "percent-of-column":
      return Math.round((Math.abs(base) / reportTotal) * 10000) / 100;
  }
}

type MapLineOptions = {
  method: AccountingMethod;
  columns: AmountColumn[];
  displayBy: DisplayColumnsBy;
  compareTo: CompareToSelection;
  reportTotal: number;
};

function usesSplitColumns(displayBy: DisplayColumnsBy): boolean {
  return displayBy !== "none" && MULTI_COLUMN_DISPLAYS.includes(displayBy);
}

function mapLine(line: ReportLine, opts: MapLineOptions): ReportLine {
  const base = line.amount !== undefined ? cashAdjust(line.amount, opts.method) : undefined;
  const dataCols = opts.columns.filter((c) => c.kind !== "compare");
  const compareCols = opts.columns.filter((c) => c.kind === "compare");

  let amounts: number[] | undefined;
  let amount: number | undefined;

  if (base !== undefined) {
    const dataValues: number[] = [];

    if (usesSplitColumns(opts.displayBy) && dataCols.length > 1) {
      dataValues.push(...(splitAcrossBuckets(base, dataCols.length) ?? []));
    } else if (dataCols.length >= 1) {
      dataValues.push(base);
    }

    const compareValues = compareCols.map((col) => {
      const opt = col.id.replace("compare-", "") as CompareToOption;
      return compareValue(base, opt, opts.reportTotal);
    });

    const combined = [...dataValues, ...compareValues];

    if (combined.length === 1 && compareCols.length === 0) {
      amount = combined[0];
    } else if (combined.length > 0) {
      amounts = combined;
    }
  }

  const children = line.children?.map((c) => mapLine(c, opts));

  return { ...line, amount, amounts, children };
}

export function transformFinancialReportLines(
  lines: ReportLine[],
  range: ReportDateRange,
  method: AccountingMethod,
  displayBy: DisplayColumnsBy,
  compareTo: CompareToSelection,
): { lines: ReportLine[]; columns: AmountColumn[] } {
  const columns = buildAmountColumns(range, displayBy, compareTo);
  const reportTotal = sumReportAmounts(lines);
  const mapped = lines.map((line) =>
    mapLine(line, {
      method,
      columns,
      displayBy,
      compareTo,
      reportTotal,
    }),
  );
  return { lines: mapped, columns };
}

export const transformBalanceSheetLines = transformFinancialReportLines;

export function flattenReportLines(
  lines: ReportLine[],
  columns: AmountColumn[],
  depth = 0,
): string[][] {
  const rows: string[][] = [];
  for (const line of lines) {
    const values =
      line.amounts ??
      (line.amount !== undefined ? [line.amount] : Array(columns.length).fill(""));
    const row = [
      `${"  ".repeat(depth)}${line.label}`,
      ...columns.map((col, i) => {
        const v = values[i];
        if (v === undefined) return "";
        if (col.format === "percent") return `${v}%`;
        return String(v);
      }),
    ];
    rows.push(row);
    if (line.children?.length) {
      rows.push(...flattenReportLines(line.children, columns, depth + 1));
    }
  }
  return rows;
}

export function balanceSheetDateLabel(range: ReportDateRange): string {
  const to = startOfDay(range.to);
  return `As of ${to.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function incomeStatementDateLabel(range: ReportDateRange): string {
  return formatReportRangeLabel(range);
}
