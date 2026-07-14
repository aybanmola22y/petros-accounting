"use client";

import { Label } from "@/components/ui/label";
import { ReportDatePicker } from "@/components/report-date-picker";
import { cn } from "@/lib/utils";

type ReportDateFieldProps = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  onDatePicked?: () => void;
  className?: string;
};

export function ReportDateField({
  label,
  value,
  onChange,
  onDatePicked,
  className,
}: ReportDateFieldProps) {
  return (
    <div className={cn("shrink-0", className)}>
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      <div className="mt-1.5">
        <ReportDatePicker
          value={value}
          onChange={onChange}
          onDatePicked={onDatePicked}
        />
      </div>
    </div>
  );
}
