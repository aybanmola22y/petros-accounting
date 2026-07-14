import { AppLogo } from "@/components/app-logo";
import { formatReportDateLong } from "@/lib/report-date-utils";
import { cn } from "@/lib/utils";

export type ManagementReportCoverProps = {
  coverTitle: string;
  subtitle: string;
  reportPeriodText: string;
  preparedBy: string;
  preparedOn: Date;
  disclaimer: string;
  showLogo: boolean;
  className?: string;
};

export function ManagementReportCoverPage({
  coverTitle,
  subtitle,
  reportPeriodText,
  preparedBy,
  preparedOn,
  disclaimer,
  showLogo,
  className,
}: ManagementReportCoverProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden bg-white text-left font-sans",
        className,
      )}
    >
      <header className="flex min-h-[24%] shrink-0 flex-col bg-[#1e3a5f] px-6 pb-7 pt-7 text-white">
        {showLogo ? (
          <div className="mb-4">
            <AppLogo size="sm" variant="onDark" />
          </div>
        ) : null}
        <h2 className="text-[1.35rem] font-normal leading-tight tracking-tight">
          {coverTitle.trim() || "Management Report"}
        </h2>
        <p className="mt-2 text-sm leading-snug text-white">
          {subtitle.trim() || "Petrosphere Inc."}
        </p>
        <p className="mt-1 text-sm leading-snug text-white">
          {reportPeriodText.trim() || "For the period ended December 31, 2026"}
        </p>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col bg-white px-6">
        {disclaimer.trim() ? (
          <p className="pt-6 text-xs italic leading-relaxed text-muted-foreground">
            {disclaimer.trim()}
          </p>
        ) : null}

        <div className="mt-auto pb-6">
          <div className="space-y-4">
            {preparedBy.trim() ? (
              <div>
                <p className="text-[0.7rem] text-muted-foreground">Prepared by</p>
                <p className="mt-1 text-[0.95rem] font-semibold leading-tight text-foreground">
                  {preparedBy.trim()}
                </p>
              </div>
            ) : null}
            <div>
              <p className="text-[0.7rem] text-muted-foreground">Prepared on</p>
              <p className="mt-1 text-[0.95rem] leading-tight text-foreground">
                {formatReportDateLong(preparedOn)}
              </p>
            </div>
          </div>
        </div>

        <div className="h-1.5 w-full shrink-0 bg-[#cce8f4]" aria-hidden />
      </div>
    </div>
  );
}
