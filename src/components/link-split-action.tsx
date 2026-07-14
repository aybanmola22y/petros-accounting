"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type LinkSplitActionMenuEntry =
  | { label: string; onClick: () => void }
  | { kind: "separator" };

function isSeparator(item: LinkSplitActionMenuEntry): item is { kind: "separator" } {
  return "kind" in item && item.kind === "separator";
}

type LinkSplitActionProps = {
  label: string;
  onPrimaryClick?: () => void;
  menuItems: LinkSplitActionMenuEntry[];
  className?: string;
  menuClassName?: string;
};

/** QBO-style table action: text link + vertical rule + chevron dropdown. */
export function LinkSplitAction({
  label,
  onPrimaryClick,
  menuItems,
  className,
  menuClassName,
}: LinkSplitActionProps) {
  return (
    <div className={cn("inline-flex items-center", className)}>
      <button
        type="button"
        className="text-sm font-medium text-primary hover:underline"
        onClick={onPrimaryClick}
      >
        {label}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="ml-0.5 inline-flex h-5 items-center border-l border-border/70 pl-1 text-primary hover:text-primary/80"
            aria-label={`${label} options`}
          >
            <ChevronDown className="h-3 w-3 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={cn("min-w-11rem", menuClassName)}>
          {menuItems.map((item, index) => {
            if (isSeparator(item)) {
              return <DropdownMenuSeparator key={`sep-${index}`} />;
            }
            return (
              <DropdownMenuItem key={item.label} onClick={item.onClick}>
                {item.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
