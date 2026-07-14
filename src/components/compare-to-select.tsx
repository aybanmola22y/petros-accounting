"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  COMPARE_TO_GROUPS,
  formatCompareToTriggerLabel,
  type CompareToOption,
  type CompareToSelection,
} from "@/lib/financial-report-utils";
import { cn } from "@/lib/utils";

type CompareToSelectProps = {
  value: CompareToSelection;
  onChange: (value: CompareToSelection) => void;
  className?: string;
};

export function CompareToSelect({ value, onChange, className }: CompareToSelectProps) {
  const toggle = (option: CompareToOption, checked: boolean) => {
    if (checked) {
      onChange([...value, option]);
    } else {
      onChange(value.filter((v) => v !== option));
    }
  };

  const triggerLabel = formatCompareToTriggerLabel(value);

  return (
    <div className={cn("flex min-w-9.5rem shrink-0 flex-col gap-1.5", className)}>
      <Label className="text-xs font-normal text-muted-foreground">Compare to</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 w-full min-w-9.5rem justify-between bg-background px-3 font-normal shadow-sm",
              !triggerLabel && "text-muted-foreground",
            )}
          >
            <span className="truncate">{triggerLabel || "Select Period"}</span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0" sideOffset={4}>
          <div className="py-2">
            {COMPARE_TO_GROUPS.map((group, groupIndex) => (
              <div key={group.label}>
                {groupIndex > 0 && <div className="my-2 border-t" />}
                <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                <ul className="space-y-0.5 px-1 pb-1">
                  {group.options.map((opt) => {
                    const checked = value.includes(opt.value);
                    const id = `compare-${opt.value}`;
                    return (
                      <li key={opt.value}>
                        <label
                          htmlFor={id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/60"
                        >
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={(state) =>
                              toggle(opt.value, state === true)
                            }
                          />
                          <span>{opt.label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
