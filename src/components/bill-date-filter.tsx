"use client";

import { useEffect, useState } from "react";
import { Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportDateField } from "@/components/report-date-field";
import {
  BILL_DATE_FILTER_OPTIONS,
  billListDateRange,
  type BillDateFilter,
} from "@/lib/mock-data/paid-bills";
import { cn } from "@/lib/utils";

type BillDateFilterProps = {
  value: BillDateFilter;
  customFrom: Date;
  customTo: Date;
  onApply: (filter: BillDateFilter, from: Date, to: Date) => void;
  className?: string;
};

export function BillDateFilter({
  value,
  customFrom,
  customTo,
  onApply,
  className,
}: BillDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [draftFilter, setDraftFilter] = useState<BillDateFilter>(value);
  const [draftFrom, setDraftFrom] = useState(customFrom);
  const [draftTo, setDraftTo] = useState(customTo);

  useEffect(() => {
    if (!open) return;
    setDraftFilter(value);
    setDraftFrom(customFrom);
    setDraftTo(customTo);
  }, [open, value, customFrom, customTo]);

  function handlePresetChange(next: BillDateFilter) {
    setDraftFilter(next);
    if (next === "Custom") return;
    const range = billListDateRange(next, { customFrom: draftFrom, customTo: draftTo });
    if (range) {
      setDraftFrom(range.from);
      setDraftTo(range.to);
    }
  }

  function handleApply() {
    onApply(draftFilter, draftFrom, draftTo);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-9 gap-2 bg-background px-3 font-normal", className)}
        >
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(720px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Bill Date</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
          <div className="min-w-[220px] space-y-1.5">
            <p className="text-xs text-muted-foreground">Preset</p>
            <Select value={draftFilter} onValueChange={(v) => handlePresetChange(v as BillDateFilter)}>
              <SelectTrigger className="h-10 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[min(320px,70vh)]">
                {BILL_DATE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ReportDateField
            label="From"
            value={draftFrom}
            onChange={setDraftFrom}
            onDatePicked={() => setDraftFilter("Custom")}
            className="min-w-[9.5rem]"
          />

          <ReportDateField
            label="To"
            value={draftTo}
            onChange={setDraftTo}
            onDatePicked={() => setDraftFilter("Custom")}
            className="min-w-[9.5rem]"
          />
        </div>

        <div className="flex justify-end border-t px-4 py-3">
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handleApply}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
