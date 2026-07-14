"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { InvoiceLineItem } from "@/components/invoice-form-dialog";
import { InvoiceStatusTimeline } from "@/components/invoice-status-timeline";
import type { LinkSplitActionMenuEntry } from "@/components/link-split-action";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { invoiceActivityStatusLabel } from "@/lib/invoice-status";
import type { InvoiceViewRow } from "@/lib/mock-data/adapters";
import type { MockInvoice } from "@/lib/mock-data/types";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

function isSeparator(item: LinkSplitActionMenuEntry): item is { kind: "separator" } {
  return "kind" in item && item.kind === "separator";
}

function ActivitySection({
  title,
  open,
  onOpenChange,
  children,
  muted,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div
        className={cn(
          "border-b bg-card",
          muted && !open && "bg-muted/30",
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-semibold transition-colors",
              open ? "bg-card" : muted ? "hover:bg-muted/40" : "hover:bg-muted/20",
            )}
          >
            <span className="truncate pr-2">{title}</span>
            {open ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-4 pt-1">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function lineLabel(line: InvoiceLineItem): string {
  if (line.productService.trim()) return line.productService.trim();
  if (line.description.trim()) return line.description.trim();
  return "Invoice amount";
}

function lineAmount(line: InvoiceLineItem): number {
  return line.qty * line.rate;
}

type InvoiceActivitySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: InvoiceViewRow | null;
  invoice: MockInvoice | null;
  customerEmail?: string;
  lines: InvoiceLineItem[];
  menuItems: LinkSplitActionMenuEntry[];
  onEdit: () => void;
};

export function InvoiceActivitySheet({
  open,
  onOpenChange,
  row,
  invoice,
  customerEmail,
  lines,
  menuItems,
  onEdit,
}: InvoiceActivitySheetProps) {
  const [customerOpen, setCustomerOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
  const [productsOpen, setProductsOpen] = useState(true);
  const [detailsLineId, setDetailsLineId] = useState<string | null>(null);

  if (!row || !invoice) return null;

  const statusLabel = invoiceActivityStatusLabel(invoice, row);
  const balanceDue = row.balance;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px] [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Invoice {row.number}</SheetTitle>
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div className="min-w-0 pr-2">
            <p className="text-lg font-semibold tracking-tight">Invoice {row.number}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{statusLabel}</p>
          </div>
          <button
            type="button"
            className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 border-b space-y-4">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {formatPHP(balanceDue)}
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Invoice date</p>
                <p className="font-medium mt-0.5">{row.date}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Due date</p>
                <p className="font-medium mt-0.5">{row.dueDate}</p>
              </div>
            </div>
          </div>

          <ActivitySection
            title={row.customer}
            open={customerOpen}
            onOpenChange={setCustomerOpen}
          >
            {customerEmail ? (
              <a
                href={`mailto:${customerEmail}`}
                className="text-sm text-primary hover:underline break-all"
              >
                {customerEmail}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">No email on file</p>
            )}
          </ActivitySection>

          <ActivitySection
            title="Invoice activity"
            open={activityOpen}
            onOpenChange={setActivityOpen}
            muted
          >
            <InvoiceStatusTimeline invoice={invoice} />
          </ActivitySection>

          <ActivitySection
            title="Products and services"
            open={productsOpen}
            onOpenChange={setProductsOpen}
          >
            <ul className="space-y-4">
              {lines.map((line) => {
                const hasDetails = Boolean(line.description.trim() || line.sku.trim());
                const showDetails = detailsLineId === line.id;
                return (
                  <li key={line.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm leading-snug">{lineLabel(line)}</span>
                      <span className="text-sm font-medium tabular-nums shrink-0">
                        {formatPHP(lineAmount(line))}
                      </span>
                    </div>
                    {hasDetails ? (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() =>
                          setDetailsLineId(showDetails ? null : line.id)
                        }
                      >
                        {showDetails ? "Hide details" : "More details"}
                      </button>
                    ) : null}
                    {showDetails ? (
                      <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                        {line.sku.trim() ? <p>SKU: {line.sku}</p> : null}
                        {line.description.trim() ? <p>{line.description}</p> : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </ActivitySection>
        </div>

        <div className="mt-auto border-t bg-muted/20 px-5 py-4 flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-emerald-700 text-emerald-700 hover:bg-emerald-50">
                More actions
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {menuItems.map((item, index) => {
                if (isSeparator(item)) {
                  return <DropdownMenuSeparator key={`sep-${index}`} />;
                }
                return (
                  <DropdownMenuItem
                    key={item.label}
                    onClick={() => {
                      item.onClick();
                      onOpenChange(false);
                    }}
                  >
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            className="flex-1 bg-emerald-700 hover:bg-emerald-800"
            onClick={() => {
              onEdit();
              onOpenChange(false);
            }}
          >
            Edit invoice
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
