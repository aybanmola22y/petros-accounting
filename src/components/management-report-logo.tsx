import { cn } from "@/lib/utils";
import type { ManagementReport, ManagementReportCategory } from "@/lib/management-reports-data";

type LogoKey =
  | "company-overview"
  | "sales-performance"
  | "expenses-performance"
  | "custom";

function logoKeyForReport(report: Pick<ManagementReport, "id" | "category">): LogoKey {
  if (report.id === "company-overview") return "company-overview";
  if (report.id === "sales-performance") return "sales-performance";
  if (report.id === "expenses-performance") return "expenses-performance";
  return "custom";
}

const LOGO_TONES: Record<ManagementReportCategory, string> = {
  Executive: "text-slate-600",
  Sales: "text-emerald-700",
  Operations: "text-amber-800",
  Custom: "text-violet-700",
};

function CompanyOverviewMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M7 15.5V12M10.5 15.5V9.5M14 15.5V11M17.5 15.5V8"
        className="stroke-current"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M6.5 18.5h11" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SalesPerformanceMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M7.5 14.5L11 11l2.5 2L16.5 9"
        className="stroke-current"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 9H17.5V11"
        className="stroke-current"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExpensesPerformanceMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12.5" r="4.25" className="stroke-current" strokeWidth="1.5" />
      <path
        d="M12 8.25v4.25l2.75 1.6"
        className="stroke-current"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 18.5h8" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CustomReportMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M8 5.5h8l3 3V18a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6.5 18V7A1.5 1.5 0 0 1 8 5.5Z"
        className="stroke-current"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M15.5 5.5V9H19" className="stroke-current" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 12h7M8.5 15h5" className="stroke-current" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const MARKS: Record<LogoKey, typeof CompanyOverviewMark> = {
  "company-overview": CompanyOverviewMark,
  "sales-performance": SalesPerformanceMark,
  "expenses-performance": ExpensesPerformanceMark,
  custom: CustomReportMark,
};

type ManagementReportLogoProps = {
  report: Pick<ManagementReport, "id" | "category">;
  size?: "sm" | "md";
  className?: string;
};

export function ManagementReportLogo({
  report,
  size = "md",
  className,
}: ManagementReportLogoProps) {
  const key = logoKeyForReport(report);
  const Mark = MARKS[key];
  return (
    <Mark
      className={cn(
        "shrink-0",
        size === "sm" ? "h-9 w-9" : "h-11 w-11",
        LOGO_TONES[report.category],
        className,
      )}
      aria-hidden
    />
  );
}
