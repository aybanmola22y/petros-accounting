"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_RECURRING_LIST_FILTERS,
  RECURRING_LOCATION_FILTER_OPTIONS,
  RECURRING_TEMPLATE_TYPE_OPTIONS,
  RECURRING_TRANSACTION_TYPES,
  type RecurringListFilters,
  type RecurringLocationFilter,
  type RecurringScheduleType,
  type RecurringTransactionType,
} from "@/lib/mock-data/recurring-transactions";

type RecurringTransactionsFilterPopoverProps = {
  appliedFilters: RecurringListFilters;
  onApply: (filters: RecurringListFilters) => void;
};

export function RecurringTransactionsFilterPopover({
  appliedFilters,
  onApply,
}: RecurringTransactionsFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RecurringListFilters>(appliedFilters);

  useEffect(() => {
    if (open) setDraft(appliedFilters);
  }, [open, appliedFilters]);

  function handleReset() {
    setDraft(DEFAULT_RECURRING_LIST_FILTERS);
    onApply(DEFAULT_RECURRING_LIST_FILTERS);
    setOpen(false);
  }

  function handleApply() {
    onApply(draft);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9 px-4">
          Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-22rem p-0 shadow-lg" sideOffset={6}>
        <div className="flex items-start justify-between border-b px-4 py-3">
          <h3 className="text-base font-semibold text-foreground">Recurring Transactions</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close filter"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Template Type</Label>
            <Select
              value={draft.templateType}
              onValueChange={(v) =>
                setDraft((prev) => ({
                  ...prev,
                  templateType: v as RecurringScheduleType | "All",
                }))
              }
            >
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRING_TEMPLATE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Transaction Type</Label>
            <Select
              value={draft.transactionType}
              onValueChange={(v) =>
                setDraft((prev) => ({
                  ...prev,
                  transactionType: v as RecurringTransactionType | "All",
                }))
              }
            >
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[min(280px,60vh)]">
                <SelectItem value="All">All</SelectItem>
                {RECURRING_TRANSACTION_TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-normal text-muted-foreground">Location</Label>
            <Select
              value={draft.location}
              onValueChange={(v) =>
                setDraft((prev) => ({
                  ...prev,
                  location: v as RecurringLocationFilter,
                }))
              }
            >
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[min(280px,60vh)]">
                {RECURRING_LOCATION_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
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
