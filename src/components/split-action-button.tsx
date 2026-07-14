"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SplitActionMenuEntry =
  | { kind?: "item"; label: string; onClick: () => void }
  | { kind: "separator" };

type SplitActionButtonProps = {
  label: string;
  onClick: () => void;
  menuItems?: SplitActionMenuEntry[];
  variant?: "default" | "outline";
  menuAlign?: "start" | "center" | "end";
  className?: string;
};

export function SplitActionButton({
  label,
  onClick,
  menuItems = [],
  variant = "default",
  menuAlign = "end",
  className,
}: SplitActionButtonProps) {
  const isOutline = variant === "outline";
  const showMenu = menuItems.length > 0;

  if (!showMenu) {
    return (
      <Button type="button" variant={variant} className={className} onClick={onClick}>
        {label}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex shadow-sm",
        isOutline && "rounded-md border border-input bg-background",
        className,
      )}
    >
      <Button
        type="button"
        variant={variant}
        className={cn(
          "rounded-r-none",
          isOutline && "border-0 shadow-none",
        )}
        onClick={onClick}
      >
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={variant}
            className={cn(
              "rounded-l-none px-2",
              isOutline
                ? "border-0 border-l border-input shadow-none"
                : "border-l border-primary-foreground/25",
            )}
            aria-label={`${label} options`}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={menuAlign}>
          {menuItems.map((item, index) =>
            item.kind === "separator" ? (
              <DropdownMenuSeparator key={`sep-${index}`} />
            ) : (
              <DropdownMenuItem key={item.label} onClick={item.onClick}>
                {item.label}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
