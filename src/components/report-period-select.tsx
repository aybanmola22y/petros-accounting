"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getReportPeriodLabel,
  MANAGEMENT_REPORT_PERIODS,
  REPORT_RANGE_PERIODS,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";

type ReportPeriodSelectProps = {
  value: ReportRangePeriod;
  onChange: (period: ReportRangePeriod) => void;
  className?: string;
  showLabel?: boolean;
  labelClassName?: string;
  periods?: readonly ReportRangePeriod[];
};

export function ReportPeriodSelect({
  value,
  onChange,
  className,
  showLabel = true,
  labelClassName,
  periods = REPORT_RANGE_PERIODS,
}: ReportPeriodSelectProps) {
  return (
    <div className={className}>
      {showLabel ? (
        <Label className={labelClassName ?? "text-xs font-normal text-muted-foreground"}>
          Report period
        </Label>
      ) : null}
      <Select value={value} onValueChange={(v) => onChange(v as ReportRangePeriod)}>
        <SelectTrigger
          className={
            showLabel ? "mt-1.5 h-9 w-full bg-background shadow-sm" : "h-9 w-full bg-background shadow-sm"
          }
        >
          <SelectValue>{getReportPeriodLabel(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          position="popper"
          className="max-h-[min(320px,70vh)] min-w-var(--radix-select-trigger-width)"
        >
          {periods.map((p) => (
            <SelectItem key={p} value={p}>
              {getReportPeriodLabel(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Management reports list / builder — QuickBooks period presets only. */
export function ManagementReportPeriodSelect(
  props: Omit<ReportPeriodSelectProps, "periods">,
) {
  return <ReportPeriodSelect {...props} periods={MANAGEMENT_REPORT_PERIODS} />;
}
