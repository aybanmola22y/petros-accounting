"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INVOICE_STATUS_FILTER_OPTIONS,
  invoiceStatusFilterLabel,
  type InvoiceStatusFilter,
} from "@/lib/invoice-list-status-filters";
import { cn } from "@/lib/utils";

type InvoiceStatusFilterSelectProps = {
  value: InvoiceStatusFilter;
  onChange: (value: InvoiceStatusFilter) => void;
  className?: string;
};

export function InvoiceStatusFilterSelect({
  value,
  onChange,
  className,
}: InvoiceStatusFilterSelectProps) {
  const groups: { heading?: string; items: Extract<(typeof INVOICE_STATUS_FILTER_OPTIONS)[number], { type: "item" }>[] }[] = [];
  let currentGroup: (typeof groups)[number] = { items: [] };

  for (const option of INVOICE_STATUS_FILTER_OPTIONS) {
    if (option.type === "heading") {
      if (currentGroup.items.length > 0) groups.push(currentGroup);
      currentGroup = { heading: option.label, items: [] };
      continue;
    }
    currentGroup.items.push(option);
  }
  if (currentGroup.items.length > 0) groups.push(currentGroup);

  return (
    <Select value={value} onValueChange={(next) => onChange(next as InvoiceStatusFilter)}>
      <SelectTrigger className={cn("h-9 w-[180px] bg-background", className)}>
        <SelectValue>{invoiceStatusFilterLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[min(360px,70vh)]">
        {groups.map((group, index) => (
          <div key={group.heading ?? `group-${index}`}>
            {index > 0 ? <SelectSeparator /> : null}
            <SelectGroup>
              {group.heading ? (
                <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-foreground">
                  {group.heading}
                </SelectLabel>
              ) : null}
              {group.items.map((item) => (
                <SelectItem key={item.value} value={item.value} className="pl-3">
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}
