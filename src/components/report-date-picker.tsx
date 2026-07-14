"use client";

import { useEffect, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatReportDateShort,
  parseReportDate,
  startOfDay,
} from "@/lib/report-date-utils";
import { cn } from "@/lib/utils";

type ReportDatePickerProps = {
  value: Date;
  onChange: (date: Date) => void;
  /** Called after a date is chosen (e.g. switch report period to Custom). */
  onDatePicked?: () => void;
  className?: string;
  inputClassName?: string;
};

/**
 * Report date field + shadcn Date Picker (Popover + Calendar).
 * @see https://ui.shadcn.com/docs/components/date-picker
 */
export function ReportDatePicker({
  value,
  onChange,
  onDatePicked,
  className,
  inputClassName,
}: ReportDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => formatReportDateShort(value));
  const [month, setMonth] = useState(value);

  useEffect(() => {
    setText(formatReportDateShort(value));
    setMonth(value);
  }, [value]);

  const commitDate = (date: Date) => {
    const normalized = startOfDay(date);
    onChange(normalized);
    setText(formatReportDateShort(normalized));
    setMonth(normalized);
    onDatePicked?.();
  };

  return (
    <InputGroup
      className={cn(
        "h-9 shrink-0 overflow-visible bg-background shadow-sm",
        inputClassName ?? "w-9.75rem min-w-9.75rem",
        className,
      )}
    >
      <InputGroupInput
        value={text}
        placeholder="MM/DD/YYYY"
        className="min-w-0 flex-1 pl-3 pr-1 text-sm tabular-nums"
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseReportDate(e.target.value);
          if (parsed) commitDate(parsed);
        }}
        onBlur={() => {
          const parsed = parseReportDate(text);
          if (parsed) commitDate(parsed);
          else setText(formatReportDateShort(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <InputGroupAddon align="inline-end" className="shrink-0 pr-1.5 pl-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <InputGroupButton
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              aria-label="Select date"
            >
              <CalendarIcon className="size-4 shrink-0" />
              <span className="sr-only">Select date</span>
            </InputGroupButton>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            align="end"
            sideOffset={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Calendar
              mode="single"
              selected={value}
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                if (date) {
                  commitDate(date);
                  setOpen(false);
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  );
}
