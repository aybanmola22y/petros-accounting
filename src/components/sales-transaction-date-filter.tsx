"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
  SALES_TRANSACTION_DATE_FILTER_OPTIONS,
  salesTransactionListDateRange,
  type SalesTransactionDateFilter,
} from "@/lib/sales-transaction-list-date-filters";
import { cn } from "@/lib/utils";

type SalesTransactionDateFilterProps = {
  value: SalesTransactionDateFilter;
  customFrom: Date;
  customTo: Date;
  onApply: (filter: SalesTransactionDateFilter, from: Date, to: Date) => void;
  className?: string;
};

export function SalesTransactionDateFilterControl({
  value,
  customFrom,
  customTo,
  onApply,
  className,
}: SalesTransactionDateFilterProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(customFrom);
  const [draftTo, setDraftTo] = useState(customTo);

  useEffect(() => {
    if (!customOpen) return;
    setDraftFrom(customFrom);
    setDraftTo(customTo);
  }, [customOpen, customFrom, customTo]);

  function handlePresetChange(next: SalesTransactionDateFilter) {
    if (next === "Custom dates") {
      onApply("Custom dates", customFrom, customTo);
      setCustomOpen(true);
      return;
    }

    const range = salesTransactionListDateRange(next);
    if (range) {
      onApply(next, range.from, range.to);
      return;
    }

    onApply(next, customFrom, customTo);
  }

  function handleCustomApply() {
    onApply("Custom dates", draftFrom, draftTo);
    setCustomOpen(false);
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm text-muted-foreground">Date</span>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={(v) => handlePresetChange(v as SalesTransactionDateFilter)}>
          <SelectTrigger className="h-9 w-[160px] bg-background shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[min(360px,70vh)]">
            {SALES_TRANSACTION_DATE_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {value === "Custom dates" ? (
          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-9 bg-background">
                Edit range
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(720px,calc(100vw-2rem))] p-0">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="text-sm font-semibold">Custom dates</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => setCustomOpen(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
                <ReportDateField
                  label="From"
                  value={draftFrom}
                  onChange={setDraftFrom}
                  className="min-w-[9.5rem]"
                />
                <ReportDateField
                  label="To"
                  value={draftTo}
                  onChange={setDraftTo}
                  className="min-w-[9.5rem]"
                />
              </div>

              <div className="flex justify-end border-t px-4 py-3">
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={handleCustomApply}
                >
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}
