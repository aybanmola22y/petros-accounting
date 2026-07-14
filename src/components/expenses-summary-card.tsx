"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Info, MoreVertical } from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
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
import { useMockExpenses } from "@/hooks/use-mock-expenses";
import { useMockExpenseCategories } from "@/hooks/use-mock-expense-categories";
import { expenseTransactionDetailHref } from "@/lib/expense-navigation";
import { computeExpenseDashboardSlice, EXPENSE_DASHBOARD_PERIODS, type ExpenseDashboardPeriod } from "@/lib/ledger";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

export type ExpenseCategorySlice = {
  category: string;
  amount: number;
  changePercent: number;
};

const SLICE_COLORS = ["#0078D4", "#00A2AD", "#5C2D91", "#F7630C", "#C50F1F"];

const PERIOD_OPTIONS = EXPENSE_DASHBOARD_PERIODS.map((value) => ({
  value,
  label: value,
}));

function formatPHPWhole(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-PH", {
    maximumFractionDigits: 0,
  });
  return amount < 0 ? `-₱${formatted}` : `₱${formatted}`;
}

function formatCategoryAmount(amount: number): string {
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function truncateCategory(label: string, max = 20): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max).trim()}…`;
}

type ExpensesSummaryCardProps = {
  viewAllHref?: string;
  className?: string;
};

export function ExpensesSummaryCard({
  viewAllHref,
  className,
}: ExpensesSummaryCardProps) {
  const expenses = useMockExpenses();
  const expenseCategories = useMockExpenseCategories();
  const [period, setPeriod] = useState<ExpenseDashboardPeriod>("This month");
  const detailHref =
    viewAllHref ??
    expenseTransactionDetailHref({ period, basis: "Accrual" });
  const { total, trendPercent, periodLabel, trendLabel, categories } = useMemo(
    () => computeExpenseDashboardSlice(expenses, period, "Accrual", expenseCategories),
    [expenses, expenseCategories, period],
  );
  const categorizedTotal = categories.reduce((sum, c) => sum + c.amount, 0);
  const coveragePct =
    total > 0 ? Math.min(100, Math.round((categorizedTotal / total) * 100)) : 0;

  const isPositiveTrend = trendPercent >= 0;

  return (
    <section
      className={cn(
        "rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Expenses
        </h2>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as ExpenseDashboardPeriod)}
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
        <p className="text-sm text-muted-foreground">{periodLabel}</p>

        <div className="flex flex-wrap items-center gap-3">
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {formatPHPWhole(total)}
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Info className="h-3.5 w-3.5" />
            {coveragePct}%
          </span>
        </div>

        <p className="flex flex-wrap items-center gap-x-1 text-sm leading-none">
          <ArrowUpRight
            className={cn(
              "h-4 w-4 shrink-0",
              isPositiveTrend ? "text-amber-600" : "text-emerald-700",
              !isPositiveTrend && "rotate-180",
            )}
          />
          <span
            className={cn(
              "font-medium",
              isPositiveTrend ? "text-amber-600" : "text-emerald-700",
            )}
          >
            {isPositiveTrend ? "Up" : "Down"} {Math.abs(trendPercent)}%
          </span>
          <span className="text-muted-foreground">{trendLabel}</span>
        </p>

        <div className="grid gap-6 sm:grid-cols-[minmax(140px,1fr)_1.2fr] items-center min-h-[200px]">
          <div className="h-[180px] w-full mx-auto max-w-[200px]">
            {categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    dataKey="amount"
                    nameKey="category"
                    strokeWidth={0}
                  >
                    {categories.map((_, index) => (
                      <Cell
                        key={`slice-${index}`}
                        fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatPHP(value)}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No expense data
              </div>
            )}
          </div>

          <ul className="space-y-3 min-w-0">
            {categories.map((cat, index) => (
              <li key={`${cat.category}-${index}`} className="flex items-start gap-2.5 text-sm min-w-0">
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="text-muted-foreground truncate"
                      title={cat.category}
                    >
                      {truncateCategory(cat.category)}:{" "}
                      <span className="text-foreground tabular-nums">
                        {formatCategoryAmount(cat.amount)}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-amber-600">
                      <ArrowUpRight className="h-3 w-3" />
                      {cat.changePercent}%
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t pt-4 mt-auto">
          <Button variant="link" className="h-auto p-0 text-primary font-medium" asChild>
            <Link href={detailHref}>View all spending</Link>
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
