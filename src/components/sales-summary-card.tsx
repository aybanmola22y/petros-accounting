"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Info, MoreVertical } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { useMockSales } from "@/hooks/use-mock-sales";
import {
  computeSalesDashboardSlice,
  SALES_DASHBOARD_PERIODS,
  type SalesDashboardPeriod,
} from "@/lib/ledger";
import { salesOverviewHref } from "@/lib/sales-navigation";
import { salesChartYMax } from "@/lib/mock-data";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

const SALES_LINE = "#107C10";

const PERIOD_OPTIONS = SALES_DASHBOARD_PERIODS.map((value) => ({
  value,
  label: value,
}));

function formatPHPWhole(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-PH", {
    maximumFractionDigits: 0,
  });
  return amount < 0 ? `-₱${formatted}` : `₱${formatted}`;
}

function formatAxisK(value: number): string {
  if (value === 0) return "0";
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  return `${value / 1000}K`;
}

function buildYTicks(max: number): number[] {
  const top = salesChartYMax([{ month: "", amount: max }]);
  const step = top / 4;
  return [0, step, step * 2, step * 3, top];
}

type SalesSummaryCardProps = {
  className?: string;
};

export function SalesSummaryCard({
  className,
}: SalesSummaryCardProps) {
  const transactions = useMockSales({ includeLines: false });
  const [period, setPeriod] = useState<SalesDashboardPeriod>("This month");
  const overviewHref = useMemo(
    () => salesOverviewHref({ period, basis: "Accrual" }),
    [period],
  );
  const { totalAmount, amountLabel, byMonth } = useMemo(
    () => computeSalesDashboardSlice(transactions, period, "Accrual"),
    [transactions, period],
  );

  const yMax = salesChartYMax(byMonth);
  const yTicks = buildYTicks(yMax);
  const peakMonth = byMonth.reduce(
    (best, row) => (row.amount > best.amount ? row : best),
    byMonth[0] ?? { month: "", amount: 0 },
  );
  const coveragePct =
    totalAmount > 0 ? Math.min(100, Math.round((peakMonth.amount / totalAmount) * 100)) : 0;

  return (
    <section
      className={cn(
        "rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Sales
        </h2>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as SalesDashboardPeriod)}
        >
          <SelectTrigger className="h-8 w-full sm:w-[260px] bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[min(24rem,70vh)]">
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-1 flex-col p-5 gap-4">
        <p className="text-sm text-muted-foreground">{amountLabel}</p>

        <div className="flex flex-wrap items-center gap-3">
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {formatPHPWhole(totalAmount)}
          </p>
          {totalAmount > 0 && byMonth.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Info className="h-3.5 w-3.5" />
              {coveragePct}%
            </span>
          ) : null}
        </div>

        <p className="flex flex-wrap items-center gap-x-1 text-sm leading-none">
          {peakMonth.amount > 0 ? (
            <>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-700" />
              <span className="font-medium text-emerald-700">
                Peak month {peakMonth.month}
              </span>
              <span className="text-muted-foreground">in selected period</span>
            </>
          ) : (
            <span className="text-muted-foreground">No sales in selected period</span>
          )}
        </p>

        <div className="min-h-[220px] w-full">
          {byMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={byMonth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  interval={0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  ticks={yTicks}
                  domain={[0, yMax]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickFormatter={formatAxisK}
                  width={48}
                />
                <Tooltip
                  formatter={(value: number) => [formatPHP(value), "Amount"]}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke={SALES_LINE}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: SALES_LINE, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: SALES_LINE }}
                  name="Amount"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No sales data for this period
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-4 mt-auto">
          <Button variant="link" className="h-auto p-0 text-primary font-medium" asChild>
            <Link href={overviewHref}>See sales overview</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Export data</DropdownMenuItem>
              <DropdownMenuItem>Customize widget</DropdownMenuItem>
              <DropdownMenuItem>Hide from dashboard</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  );
}
