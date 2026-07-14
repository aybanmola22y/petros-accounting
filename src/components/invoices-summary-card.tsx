"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMockReceivables } from "@/hooks/use-mock-receivables";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

function CombinedUnpaidBar({
  unpaidTotal,
  overdue,
  notDueYet,
}: {
  unpaidTotal: number;
  overdue: number;
  notDueYet: number;
}) {
  const overduePct = unpaidTotal > 0 ? (overdue / unpaidTotal) * 100 : 0;
  const notDuePct = unpaidTotal > 0 ? (notDueYet / unpaidTotal) * 100 : 0;
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex">
      <div
        className="h-full bg-amber-500 rounded-l-full shrink-0"
        style={{ width: `${Math.max(overduePct, overdue > 0 ? 4 : 0)}%` }}
      />
      <div
        className="h-full bg-muted-foreground/35 shrink-0"
        style={{ width: `${Math.max(notDuePct, notDueYet > 0 ? 4 : 0)}%` }}
      />
    </div>
  );
}

function DepositedBar({ paidTotal, deposited }: { paidTotal: number; deposited: number }) {
  const pct = paidTotal > 0 ? (deposited / paidTotal) * 100 : 0;
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${Math.max(pct, deposited > 0 ? 4 : 0)}%` }}
      />
    </div>
  );
}

function SummaryColumn({ children, bar }: { children: ReactNode; bar: ReactNode }) {
  return (
    <div className="p-5 flex flex-col gap-4">
      {children}
      {bar}
    </div>
  );
}

/** Amount on top, label underneath (e.g. Overdue, Not due yet). */
function StatValue({
  amount,
  label,
  boldAmount,
  align = "start",
}: {
  amount: number;
  label: string;
  boldAmount?: boolean;
  align?: "start" | "end";
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", align === "end" && "items-end text-right")}>
      <p
        className={cn(
          "text-sm tabular-nums leading-none",
          boldAmount ? "font-semibold" : "font-medium",
        )}
      >
        {formatPHP(amount)}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SummaryBody() {
  const { summary: s } = useMockReceivables();
  // Store snapshot is empty on SSR and only hydrated on the client (persisted snapshot),
  // which can cause hydration mismatches if we render real totals immediately.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const summary = mounted ? s : { ...s, unpaidTotal: 0, overdueAmount: 0, notDueYet: 0, paidTotal: 0, deposited: 0, notDeposited: 0 };

  return (
    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
      <SummaryColumn
        bar={
          <CombinedUnpaidBar
            unpaidTotal={summary.unpaidTotal}
            overdue={summary.overdueAmount}
            notDueYet={summary.notDueYet}
          />
        }
      >
        <div>
          <p className="text-lg font-semibold tabular-nums tracking-tight">
            {formatPHP(summary.unpaidTotal)}{" "}
            <span className="font-semibold text-foreground">Unpaid</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Last 365 days</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <StatValue amount={summary.overdueAmount} label="Overdue" boldAmount />
          <StatValue amount={summary.notDueYet} label="Not due yet" align="end" />
        </div>
      </SummaryColumn>

      <SummaryColumn
        bar={<DepositedBar paidTotal={summary.paidTotal} deposited={summary.deposited} />}
      >
        <div>
          <p className="text-lg font-semibold tabular-nums tracking-tight">
            {formatPHP(summary.paidTotal)}{" "}
            <span className="font-semibold text-foreground">Paid</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <StatValue amount={summary.notDeposited} label="Not deposited" />
          <StatValue amount={summary.deposited} label="Deposited" boldAmount align="end" />
        </div>
      </SummaryColumn>
    </div>
  );
}

type InvoicesSummaryCardProps = {
  /** Show collapse control in the card header (Invoices page). */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
};

export function InvoicesSummaryCard({
  collapsible = false,
  defaultCollapsed = false,
  className,
}: InvoicesSummaryCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const showBody = !collapsible || !collapsed;

  return (
    <section
      className={cn(
        "rounded-xl border bg-card shadow-sm overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-lg font-semibold tracking-tight">Invoices</h2>
        {collapsible && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand summary" : "Collapse summary"}
          >
            {collapsed ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronUp className="h-5 w-5" />
            )}
          </Button>
        )}
      </div>
      {showBody && <SummaryBody />}
    </section>
  );
}
