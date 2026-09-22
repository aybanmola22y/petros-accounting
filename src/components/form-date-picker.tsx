"use client";

import { useEffect, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type FormDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  id?: string;
  /** Smaller control for dense tables (e.g. invoice line service date). */
  compact?: boolean;
};

function parseFormDate(value: string): Date | null {
  return parseReportDate(value);
}

/**
 * Compact date field with shadcn Calendar (Popover + Calendar).
 * Stores display strings as M/D/YYYY to match invoice forms.
 */
export function FormDatePicker({
  value,
  onChange,
  className,
  inputClassName,
  disabled,
  id,
  compact = false,
}: FormDatePickerProps) {
  const selected = parseFormDate(value) ?? startOfDay(new Date());
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [month, setMonth] = useState(selected);

  useEffect(() => {
    setText(value);
    const parsed = parseFormDate(value);
    if (parsed) setMonth(parsed);
  }, [value]);

  const commit = (date: Date) => {
    const normalized = startOfDay(date);
    const formatted = formatReportDateShort(normalized);
    onChange(formatted);
    setText(formatted);
    setMonth(normalized);
  };

  return (
    <div className={cn("relative flex items-center", compact ? "h-9" : "h-10", className)}>
      <Input
        id={id}
        className={cn(
          "tabular-nums",
          compact ? "h-9 pr-8 text-sm" : "h-10 pr-10",
          inputClassName,
        )}
        value={text}
        disabled={disabled}
        placeholder="M/D/YYYY"
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseFormDate(e.target.value);
          if (parsed) commit(parsed);
        }}
        onBlur={() => {
          const parsed = parseFormDate(text);
          if (parsed) commit(parsed);
          else setText(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className={cn(
              "absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground",
              compact ? "h-7 w-7" : "h-8 w-8",
            )}
            aria-label="Select date"
          >
            <CalendarIcon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end" sideOffset={6}>
          <Calendar
            mode="single"
            selected={parseFormDate(value) ?? undefined}
            month={month}
            onMonthChange={setMonth}
            onSelect={(date) => {
              if (date) {
                commit(date);
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
