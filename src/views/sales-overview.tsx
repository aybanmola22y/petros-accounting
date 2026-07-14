"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  FileText,
  HelpCircle,
  Landmark,
  MoreVertical,
  Plus,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { InvoicesSummaryCard } from "@/components/invoices-summary-card";
import { useMockSales } from "@/hooks/use-mock-sales";
import { customersListHref } from "@/lib/customer-navigation";
import { invoicesHref } from "@/lib/invoice-navigation";
import {
  computeSalesByMonth,
  computeSalesTotal,
  SALES_DASHBOARD_PERIODS,
  resolveSalesDashboardRange,
  type SalesDashboardPeriod,
} from "@/lib/ledger";
import type { AccountingBasis } from "@/lib/ledger/types";
import {
  isSalesOverviewPeriod,
  SALES_OVERVIEW_BASIS_PARAM,
  SALES_OVERVIEW_PATH,
  SALES_OVERVIEW_PERIOD_PARAM,
} from "@/lib/sales-navigation";
import { formatReportRangeLabel, type ReportDateRange } from "@/lib/report-date-utils";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS: { label: string; icon: LucideIcon; href?: string }[] = [
  { label: "Customer", icon: Users, href: customersListHref(true) },
  { label: "Product or service", icon: ShoppingBag },
  { label: "Estimate", icon: FileText },
  { label: "Invoice", icon: Receipt, href: invoicesHref(true) },
  { label: "Recurring invoice", icon: RefreshCw },
  { label: "Receive payment", icon: CircleDollarSign },
  { label: "Sales receipt", icon: Banknote },
  { label: "Bank deposit", icon: Landmark },
  { label: "Create statement", icon: FileText },
];

const PERIOD_OPTIONS = SALES_DASHBOARD_PERIODS.map((value) => ({
  value,
  label: value,
}));

function formatCompactPHP(value: number): string {
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₱${(value / 1_000).toFixed(1)}k`;
  return formatPHP(value);
}

function parseBasis(value: string | null): AccountingBasis | null {
  return value === "Cash" || value === "Accrual" ? value : null;
}

function shiftRangeYears(range: ReportDateRange, years: number): ReportDateRange {
  const shift = (date: Date) =>
    new Date(date.getFullYear() + years, date.getMonth(), date.getDate());
  return { from: shift(range.from), to: shift(range.to) };
}

function QuickActionButton({
  label,
  icon: Icon,
  href,
}: {
  label: string;
  icon: LucideIcon;
  href?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="group flex flex-col items-center gap-2 rounded-xl p-3 transition-colors hover:bg-muted/60"
      onClick={() => {
        if (href) router.push(href);
      }}
    >
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-card shadow-sm group-hover:border-primary/30 group-hover:bg-primary/5">
          <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Plus className="h-3 w-3" />
        </span>
      </div>
      <span className="max-w-[88px] text-center text-xs text-muted-foreground leading-tight">
        {label}
      </span>
    </button>
  );
}

export function SalesOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const salesTransactions = useMockSales();

  const urlPeriod = searchParams.get(SALES_OVERVIEW_PERIOD_PARAM);
  const urlBasis = searchParams.get(SALES_OVERVIEW_BASIS_PARAM);
  const initialPeriod: SalesDashboardPeriod = isSalesOverviewPeriod(urlPeriod)
    ? urlPeriod
    : "This year to date";
  const basis: AccountingBasis = parseBasis(urlBasis) ?? "Accrual";

  const [period, setPeriod] = useState<SalesDashboardPeriod>(initialPeriod);
  const [comparePrior, setComparePrior] = useState(false);

  useEffect(() => {
    if (isSalesOverviewPeriod(urlPeriod) && urlPeriod !== period) {
      setPeriod(urlPeriod);
    }
  }, [urlPeriod, period]);

  const syncUrl = useCallback(
    (nextPeriod: SalesDashboardPeriod) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(SALES_OVERVIEW_PERIOD_PARAM, nextPeriod);
      params.set(SALES_OVERVIEW_BASIS_PARAM, basis);
      router.replace(`${SALES_OVERVIEW_PATH}?${params.toString()}`, { scroll: false });
    },
    [basis, router, searchParams],
  );

  const handlePeriodChange = (next: SalesDashboardPeriod) => {
    setPeriod(next);
    syncUrl(next);
  };

  const range = useMemo(() => resolveSalesDashboardRange(period), [period]);
  const priorRange = useMemo(() => shiftRangeYears(range, -1), [range]);

  const { byMonth, totalAmount, amountLabel } = useMemo(() => {
    const slice = computeSalesByMonth(salesTransactions, range, basis);
    const total = computeSalesTotal(salesTransactions, range, basis);
    return {
      byMonth: slice,
      totalAmount: total,
      amountLabel: period,
    };
  }, [salesTransactions, range, basis, period]);

  const priorByMonth = useMemo(() => {
    const rows = computeSalesByMonth(salesTransactions, priorRange, basis);
    return new Map(rows.map((row) => [row.month, row.amount]));
  }, [salesTransactions, priorRange, basis]);

  const incomeByMonth = byMonth.map((row) => ({
    month: row.month,
    income: row.amount,
    prior: priorByMonth.get(row.month) ?? 0,
  }));

  const priorPeriodTotal = incomeByMonth.reduce((sum, row) => sum + row.prior, 0);
  const incomeDelta = totalAmount - priorPeriodTotal;
  const rangeLabel = formatReportRangeLabel(range);
  const priorRangeLabel = formatReportRangeLabel(priorRange);

  const chartData = incomeByMonth.map((row) => ({
    ...row,
    prior: comparePrior ? row.prior : undefined,
  }));

  const yMax = useMemo(() => {
    const peak = Math.max(
      ...incomeByMonth.map((row) => Math.max(row.income, comparePrior ? row.prior : 0)),
      1,
    );
    const step = peak > 500_000 ? 175_000 : peak > 100_000 ? 50_000 : 25_000;
    return Math.ceil(peak / step) * step;
  }, [incomeByMonth, comparePrior]);

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Sales & Get Paid
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Sales & Get Paid Overview</h1>
      </div>

      <section className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Quick actions</h2>
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Help">
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Customize actions</DropdownMenuItem>
              <DropdownMenuItem>Reorder shortcuts</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Money in
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionButton key={action.label} {...action} />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Income over time
            </h2>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="duration" className="text-sm text-muted-foreground whitespace-nowrap">
                Duration
              </Label>
              <Select value={period} onValueChange={(v) => handlePeriodChange(v as SalesDashboardPeriod)}>
                <SelectTrigger id="duration" className="h-8 w-[260px] bg-background text-xs">
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
            <div className="flex items-center gap-2">
              <Switch
                id="compare"
                checked={comparePrior}
                onCheckedChange={setComparePrior}
              />
              <Label htmlFor="compare" className="text-sm text-muted-foreground cursor-pointer">
                Compare to previous year
              </Label>
            </div>
          </div>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {formatPHP(totalAmount)}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">{amountLabel}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{rangeLabel}</p>
            {priorPeriodTotal > 0 || totalAmount > 0 ? (
              <p
                className={cn(
                  "mt-2 flex items-center gap-1.5 text-sm",
                  incomeDelta >= 0 ? "text-emerald-700" : "text-destructive",
                )}
              >
                <ArrowUpRight
                  className={cn("h-4 w-4 shrink-0", incomeDelta < 0 && "rotate-90")}
                />
                <span>
                  <span className="font-medium tabular-nums">{formatPHP(Math.abs(incomeDelta))}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    {incomeDelta >= 0 ? "more" : "less"} than {priorRangeLabel}
                  </span>
                </span>
              </p>
            ) : null}
          </div>
          <div className="h-[280px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    domain={[0, yMax]}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => formatCompactPHP(Number(v))}
                    width={72}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatPHP(value),
                      name === "income" ? "Income" : "Prior year",
                    ]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      fontSize: "12px",
                    }}
                  />
                  {comparePrior && (
                    <Line
                      type="monotone"
                      dataKey="prior"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      name="prior"
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                    name="income"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No income data for this period
              </div>
            )}
          </div>
        </div>
      </section>

      <InvoicesSummaryCard />
    </div>
  );
}
