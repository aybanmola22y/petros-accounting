/** QuickBooks-style report period presets (Balance Sheet, P&L, AR Aging, etc.). */
export const REPORT_RANGE_PERIODS = [
  "All Dates",
  "Custom dates",
  "Today",
  "This week",
  "This week to date",
  "This fiscal week",
  "This month",
  "This month to date",
  "This quarter",
  "This quarter to date",
  "This fiscal quarter",
  "This fiscal quarter to date",
  "This year",
  "This year to date",
  "This year to last month",
  "This financial year",
  "This financial year to date",
  "This financial year to last month",
  "Last 6 months",
  "Yesterday",
  "Recent",
  "Last week",
  "Last week to date",
  "Last week to today",
  "Last month",
  "Last month to date",
  "Last month to today",
  "Last quarter",
  "Last quarter to date",
  "Last quarter to today",
  "Last fiscal quarter",
  "Last fiscal quarter to date",
  "Last year",
  "Last year to date",
  "Last year to today",
  "Last financial year",
  "Last financial year to date",
  "Last 7 days",
  "Last 30 days",
  "Last 90 days",
  "Last 12 months",
  "Since 30 days ago",
  "Since 60 days ago",
  "Since 90 days ago",
  "Since 365 days ago",
  "Next week",
  "Next 4 weeks",
  "Next month",
  "Next quarter",
  "Next fiscal quarter",
  "Next year",
  "Next financial year",
] as const;

export type ReportRangePeriod = (typeof REPORT_RANGE_PERIODS)[number];

/** QuickBooks management report period menu (subset of {@link REPORT_RANGE_PERIODS}). */
export const MANAGEMENT_REPORT_PERIODS = [
  "All Dates",
  "Custom dates",
  "Today",
  "This week",
  "This week to date",
  "This month",
  "This month to date",
  "This quarter",
  "This quarter to date",
  "This year",
  "This year to date",
  "This year to last month",
  "Yesterday",
  "Recent",
  "Last week",
  "Last week to date",
  "Last month",
  "Last month to date",
  "Last quarter",
  "Last quarter to date",
  "Last year",
  "Last year to date",
  "Since 30 days ago",
  "Since 60 days ago",
  "Since 90 days ago",
  "Since 365 days ago",
  "Next week",
  "Next 4 weeks",
  "Next month",
  "Next quarter",
  "Next year",
] as const satisfies readonly ReportRangePeriod[];

export type ManagementReportPeriod = (typeof MANAGEMENT_REPORT_PERIODS)[number];

/** Display label for period presets (QuickBooks-style). */
export function getReportPeriodLabel(period: ReportRangePeriod): string {
  if (period === "All Dates") return "All dates";
  if (period === "Custom dates") return "Custom";
  return period;
}

/** @deprecated Use ReportRangePeriod */
export type ReportPeriod = ReportRangePeriod;

/** @deprecated Use REPORT_RANGE_PERIODS */
export const REPORT_PERIODS = REPORT_RANGE_PERIODS;

export type ReportDateRange = { from: Date; to: Date };

const ALL_DATES_START = new Date(2000, 0, 1);

export function isCustomReportPeriod(period: ReportRangePeriod): boolean {
  return period === "Custom dates";
}

/** Parse M/D/YY or M/D/YYYY */
export function parseReportDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;
  const month = Number.parseInt(parts[0], 10);
  const day = Number.parseInt(parts[1], 10);
  let year = Number.parseInt(parts[2], 10);
  if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) return null;
  if (year < 100) year += 2000;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatReportDateLong(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Date and time for report footers (print timestamp). */
export function formatReportDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatReportDateShort(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return startOfDay(d);
}

export { addDays };

function startOfWeekSunday(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function endOfWeekSaturday(date: Date): Date {
  const s = startOfWeekSunday(date);
  return addDays(s, 6);
}

function subtractYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() - years);
  return startOfDay(next);
}

export { subtractYears };

function startOfMonth(date: Date, monthOffset = 0): Date {
  return new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
}

function endOfMonth(date: Date, monthOffset = 0): Date {
  return new Date(date.getFullYear(), date.getMonth() + monthOffset + 1, 0);
}

function startOfQuarter(date: Date, quarterOffset = 0): Date {
  const month = Math.floor(date.getMonth() / 3) * 3 + quarterOffset * 3;
  const year = date.getFullYear() + Math.floor(month / 12);
  const normalizedMonth = ((month % 12) + 12) % 12;
  return new Date(year, normalizedMonth, 1);
}

function endOfQuarter(date: Date, quarterOffset = 0): Date {
  const start = startOfQuarter(date, quarterOffset);
  return new Date(start.getFullYear(), start.getMonth() + 3, 0);
}

function startOfYear(date: Date, yearOffset = 0): Date {
  return new Date(date.getFullYear() + yearOffset, 0, 1);
}

function endOfYear(date: Date, yearOffset = 0): Date {
  return new Date(date.getFullYear() + yearOffset, 11, 31);
}

function normalizeRange(from: Date, to: Date): ReportDateRange {
  const a = startOfDay(from);
  const b = startOfDay(to);
  return a.getTime() <= b.getTime() ? { from: a, to: b } : { from: b, to: a };
}

function clampToToday(to: Date, today: Date): Date {
  return to.getTime() > today.getTime() ? today : to;
}

export function resolveReportRange(
  period: ReportRangePeriod,
  customFrom: Date,
  customTo: Date,
  anchor?: Date,
): ReportDateRange {
  const today = startOfDay(anchor ?? new Date());
  const yesterday = addDays(today, -1);

  if (period === "Custom dates") {
    return normalizeRange(customFrom, customTo);
  }

  if (period === "All Dates") {
    return { from: startOfDay(ALL_DATES_START), to: today };
  }

  const thisWeekStart = startOfWeekSunday(today);
  const thisWeekEnd = endOfWeekSaturday(today);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekEnd, -7);
  const thisMonthStart = startOfMonth(today);
  const lastMonthStart = startOfMonth(today, -1);
  const lastMonthEnd = endOfMonth(today, -1);
  const thisQuarterStart = startOfQuarter(today);
  const lastQuarterStart = startOfQuarter(today, -1);
  const lastQuarterEnd = endOfQuarter(today, -1);
  const thisYearStart = startOfYear(today);
  const lastYearStart = startOfYear(today, -1);
  const lastYearEnd = endOfYear(today, -1);
  const fyStart = startOfYear(today);
  const lastFyStart = startOfYear(today, -1);
  const lastFyEnd = endOfYear(today, -1);

  switch (period) {
    case "Today":
      return { from: today, to: today };
    case "Yesterday":
      return { from: yesterday, to: yesterday };
    case "Recent":
      return { from: addDays(today, -7), to: today };

    case "This week":
      return { from: thisWeekStart, to: thisWeekEnd };
    case "This week to date":
      return { from: thisWeekStart, to: today };
    case "This fiscal week":
      return { from: thisWeekStart, to: thisWeekEnd };

    case "This month":
      return { from: thisMonthStart, to: endOfMonth(today) };
    case "This month to date":
      return { from: thisMonthStart, to: today };

    case "This quarter":
      return { from: thisQuarterStart, to: endOfQuarter(today) };
    case "This quarter to date":
      return { from: thisQuarterStart, to: today };
    case "This fiscal quarter":
      return { from: thisQuarterStart, to: endOfQuarter(today) };
    case "This fiscal quarter to date":
      return { from: thisQuarterStart, to: today };

    case "This year":
      return { from: thisYearStart, to: endOfYear(today) };
    case "This year to date":
      return { from: thisYearStart, to: today };
    case "This year to last month":
      return { from: thisYearStart, to: lastMonthEnd };

    case "This financial year":
      return { from: fyStart, to: endOfYear(today) };
    case "This financial year to date":
      return { from: fyStart, to: today };
    case "This financial year to last month":
      return { from: fyStart, to: lastMonthEnd };

    case "Last 6 months":
      return { from: startOfMonth(today, -5), to: today };
    case "Last 7 days":
      return { from: addDays(today, -6), to: today };
    case "Last 30 days":
      return { from: addDays(today, -29), to: today };
    case "Last 90 days":
      return { from: addDays(today, -89), to: today };
    case "Last 12 months":
      // QuickBooks transaction lists: rolling 12 months from today's date (not calendar-month start).
      return { from: subtractYears(today, 1), to: today };
    case "Since 30 days ago":
      return { from: addDays(today, -30), to: today };
    case "Since 60 days ago":
      return { from: addDays(today, -60), to: today };
    case "Since 90 days ago":
      return { from: addDays(today, -90), to: today };
    case "Since 365 days ago":
      return { from: addDays(today, -365), to: today };

    case "Last week":
      return { from: lastWeekStart, to: lastWeekEnd };
    case "Last week to date":
      return { from: lastWeekStart, to: clampToToday(lastWeekEnd, today) };
    case "Last week to today":
      return { from: lastWeekStart, to: today };

    case "Last month":
      return { from: lastMonthStart, to: lastMonthEnd };
    case "Last month to date":
      return { from: lastMonthStart, to: clampToToday(lastMonthEnd, today) };
    case "Last month to today":
      return { from: lastMonthStart, to: today };

    case "Last quarter":
      return { from: lastQuarterStart, to: lastQuarterEnd };
    case "Last quarter to date":
      return { from: lastQuarterStart, to: clampToToday(lastQuarterEnd, today) };
    case "Last quarter to today":
      return { from: lastQuarterStart, to: today };
    case "Last fiscal quarter":
      return { from: lastQuarterStart, to: lastQuarterEnd };
    case "Last fiscal quarter to date":
      return { from: lastQuarterStart, to: clampToToday(lastQuarterEnd, today) };

    case "Last year":
      return { from: lastYearStart, to: lastYearEnd };
    case "Last year to date":
      return { from: lastYearStart, to: clampToToday(lastYearEnd, today) };
    case "Last year to today":
      return { from: lastYearStart, to: today };
    case "Last financial year":
      return { from: lastFyStart, to: lastFyEnd };
    case "Last financial year to date":
      return { from: lastFyStart, to: clampToToday(lastFyEnd, today) };

    case "Next week": {
      const nextWeekStart = addDays(thisWeekStart, 7);
      return { from: nextWeekStart, to: addDays(nextWeekStart, 6) };
    }
    case "Next 4 weeks":
      return { from: addDays(today, 1), to: addDays(today, 28) };
    case "Next month":
      return { from: startOfMonth(today, 1), to: endOfMonth(today, 1) };
    case "Next quarter":
      return { from: startOfQuarter(today, 1), to: endOfQuarter(today, 1) };
    case "Next fiscal quarter":
      return { from: startOfQuarter(today, 1), to: endOfQuarter(today, 1) };
    case "Next year":
      return { from: startOfYear(today, 1), to: endOfYear(today, 1) };
    case "Next financial year":
      return { from: startOfYear(today, 1), to: endOfYear(today, 1) };

    default:
      return normalizeRange(customFrom, customTo);
  }
}

/** Single “as of” date for AR Aging (end of resolved range). */
export function resolveAsOfDate(
  period: ReportRangePeriod,
  customDate: Date,
  customFrom?: Date,
): Date {
  const range = resolveReportRange(
    period,
    customFrom ?? customDate,
    customDate,
  );
  return range.to;
}

export function daysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Month buckets between two dates (inclusive), capped for UI. */
export function monthsInRange(from: Date, to: Date, max = 6): { id: string; label: string }[] {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const months: { id: string; label: string }[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor.getTime() <= end.getTime() && months.length < max) {
    const label = cursor.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    months.push({
      id: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months.length > 0 ? months : [{ id: "current", label: "Total" }];
}

export function quartersInRange(from: Date, to: Date, max = 4): { id: string; label: string }[] {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const quarters: { id: string; label: string }[] = [];
  let year = start.getFullYear();
  let quarter = Math.floor(start.getMonth() / 3);
  const endYear = end.getFullYear();
  const endQuarter = Math.floor(end.getMonth() / 3);

  while (quarters.length < max) {
    const label = `Q${quarter + 1} ${year}`;
    quarters.push({ id: `${year}-q${quarter + 1}`, label });
    if (year === endYear && quarter === endQuarter) break;
    quarter += 1;
    if (quarter > 3) {
      quarter = 0;
      year += 1;
    }
  }
  return quarters.length > 0 ? quarters : [{ id: "current", label: "Total" }];
}

export function yearsInRange(from: Date, to: Date, max = 6): { id: string; label: string }[] {
  const startYear = startOfDay(from).getFullYear();
  const endYear = startOfDay(to).getFullYear();
  const years: { id: string; label: string }[] = [];
  for (let y = startYear; y <= endYear && years.length < max; y++) {
    years.push({ id: String(y), label: String(y) });
  }
  return years.length > 0 ? years : [{ id: "current", label: "Total" }];
}

export function formatReportRangeLabel(range: ReportDateRange): string {
  const { from, to } = range;
  if (from.getTime() === to.getTime()) {
    return `As of ${formatReportDateLong(to)}`;
  }
  return `${formatReportDateLong(from)} – ${formatReportDateLong(to)}`;
}

/** Cover line under company name on management report pages. */
export function formatManagementReportCoverPeriod(
  period: ReportRangePeriod,
  customFrom: Date,
  customTo: Date,
): string {
  const range = resolveReportRange(period, customFrom, customTo);

  if (period === "All Dates") {
    return "For all dates";
  }

  if (period === "Custom dates") {
    return formatReportRangeLabel(range);
  }

  if (range.from.getTime() === range.to.getTime()) {
    return `For the period ended ${formatReportDateLong(range.to)}`;
  }

  return `For the period ${formatReportDateLong(range.from)} – ${formatReportDateLong(range.to)}`;
}
