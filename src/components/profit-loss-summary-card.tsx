"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Info, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMockChartAccounts } from "@/hooks/use-mock-chart-accounts";
import { useMockExpenses } from "@/hooks/use-mock-expenses";
import { useMockSales } from "@/hooks/use-mock-sales";
import {
  computeProfitLossDashboardSlice,
  PROFIT_LOSS_DASHBOARD_PERIODS,
  type ProfitLossDashboardPeriod,
} from "@/lib/ledger";
import { standardReportHref } from "@/lib/standard-report-routes";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = PROFIT_LOSS_DASHBOARD_PERIODS.map((value) => ({
  value,
  label: value,
}));

const INCOME_BAR = "#107C10";
const EXPENSES_BAR = "#00A2AD";

function formatPHPWhole(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-PH", {
    maximumFractionDigits: 0,
  });
  return amount < 0 ? `-₱${formatted}` : `₱${formatted}`;
}

function MetricBar({
  amount,
  label,
  maxAmount,
  barClass,
}: {
  amount: number;
  label: string;
  maxAmount: number;
  barClass: string;
}) {
  const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
  return (
    <div className="flex items-center gap-4">
      <div className="w-[128px] shrink-0">
        <p className="text-sm font-semibold tabular-nums leading-none">
          {formatPHPWhole(amount)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
      <div className="flex-1 min-w-0 h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barClass)}
          style={{ width: `${Math.max(pct, amount > 0 ? 6 : 0)}%` }}
        />
      </div>
    </div>
  );
}

type ProfitLossSummaryCardProps = {
  reportHref?: string;
  className?: string;
};

export function ProfitLossSummaryCard({
  reportHref = standardReportHref("profit-and-loss"),
  className,
}: ProfitLossSummaryCardProps) {
  const salesTransactions = useMockSales();
  const expenses = useMockExpenses();
  const chartAccounts = useMockChartAccounts();
  const [period, setPeriod] = useState<ProfitLossDashboardPeriod>("This month");

  const pl = useMemo(
    () =>
      computeProfitLossDashboardSlice(
        salesTransactions,
        expenses,
        chartAccounts,
        period,
        "Accrual",
      ),
    [salesTransactions, expenses, chartAccounts, period],
  );

  const totalExpenses = pl.expenses + pl.costOfSales + pl.otherExpenses;
  const maxBar = Math.max(pl.income, totalExpenses, 1);
  const isPositiveTrend = pl.trendPercent >= 0;

  return (
    <section
      className={cn(
        "rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Profit & Loss
        </h2>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as ProfitLossDashboardPeriod)}
        >
          <SelectTrigger className="h-8 w-full sm:w-[260px] bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-1 flex-col p-5 gap-4">
        <p className="text-sm text-muted-foreground">{pl.periodSubtitle}</p>

        <div className="flex flex-wrap items-center gap-3">
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {formatPHPWhole(pl.netEarnings)}
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Info className="h-3.5 w-3.5" />
            100%
          </span>
        </div>

        <p className="flex flex-wrap items-center gap-x-1 text-sm leading-none">
          <ArrowUpRight
            className={cn(
              "h-4 w-4 shrink-0",
              isPositiveTrend ? "text-emerald-700" : "text-destructive",
              !isPositiveTrend && "rotate-180",
            )}
          />
          <span
            className={cn(
              "font-medium",
              isPositiveTrend ? "text-emerald-700" : "text-destructive",
            )}
          >
            {isPositiveTrend ? "Up" : "Down"} {Math.abs(pl.trendPercent)}%
          </span>
          <span className="text-muted-foreground">{pl.trendLabel}</span>
        </p>

        <div className="space-y-4 py-1">
          <MetricBar
            amount={pl.income}
            label="Income"
            maxAmount={maxBar}
            barClass="bg-[#107C10]"
          />
          <MetricBar
            amount={totalExpenses}
            label="Expenses"
            maxAmount={maxBar}
            barClass="bg-[#00A2AD]"
          />
        </div>

        <div className="flex items-center justify-between border-t pt-4 mt-auto">
          <Button variant="link" className="h-auto p-0 text-primary font-medium" asChild>
            <Link href={reportHref}>See profit and loss report</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Export report</DropdownMenuItem>
              <DropdownMenuItem>Customize widget</DropdownMenuItem>
              <DropdownMenuItem>Hide from dashboard</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  );
}
