"use client";

import { ReportDatePicker } from "@/components/report-date-picker";
import { ReportPeriodSelect } from "@/components/report-period-select";
import { Label } from "@/components/ui/label";
import {
  isCustomReportPeriod,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";

type ReportPeriodControlsProps = {
  period: ReportRangePeriod;
  asOfDate: Date;
  onPeriodChange: (period: ReportRangePeriod) => void;
  onAsOfDateChange: (date: Date) => void;
};

/** AR Aging: report period + as-of date. */
export function ReportPeriodControls({
  period,
  asOfDate,
  onPeriodChange,
  onAsOfDateChange,
}: ReportPeriodControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
      <ReportPeriodSelect
        value={period}
        onChange={onPeriodChange}
        className="w-11rem min-w-11rem shrink-0"
      />

      <div className="shrink-0">
        <Label className="text-xs font-normal text-muted-foreground">as of</Label>
        <div className="mt-1.5">
          <ReportDatePicker
            value={asOfDate}
            onChange={onAsOfDateChange}
            onDatePicked={() => {
              if (!isCustomReportPeriod(period)) {
                onPeriodChange("Custom dates");
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
