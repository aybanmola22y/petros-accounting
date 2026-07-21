"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { customersListHref } from "@/lib/customer-navigation";
import { expenseTransactionsHref } from "@/lib/expense-navigation";
import { invoicesHref } from "@/lib/invoice-navigation";
import { salesTransactionsHref } from "@/lib/sales-navigation";
import { cn } from "@/lib/utils";

const cardFallback = (
  <div className="min-h-[280px] animate-pulse rounded-2xl border border-border/80 bg-muted/20" />
);

const ProfitLossSummaryCard = dynamic(
  () =>
    import("@/components/profit-loss-summary-card").then((m) => ({
      default: m.ProfitLossSummaryCard,
    })),
  { ssr: false, loading: () => cardFallback },
);

const ExpensesSummaryCard = dynamic(
  () =>
    import("@/components/expenses-summary-card").then((m) => ({
      default: m.ExpensesSummaryCard,
    })),
  { ssr: false, loading: () => cardFallback },
);

const SalesSummaryCard = dynamic(
  () =>
    import("@/components/sales-summary-card").then((m) => ({
      default: m.SalesSummaryCard,
    })),
  { ssr: false, loading: () => cardFallback },
);

const BankAccountsSummaryCard = dynamic(
  () =>
    import("@/components/bank-accounts-summary-card").then((m) => ({
      default: m.BankAccountsSummaryCard,
    })),
  { ssr: false, loading: () => cardFallback },
);

const CREATE_ACTIONS = [
  { label: "Invoice", href: invoicesHref(true) },
  { label: "Customer", href: customersListHref(true) },
  { label: "Expense", href: expenseTransactionsHref({ expense: true }) },
  { label: "Cheque", href: expenseTransactionsHref({ cheque: true }) },
  { label: "Bank deposit", href: salesTransactionsHref(true) },
] as const;

function daypartLabel(date = new Date()): "Morning" | "Afternoon" | "Evening" {
  const hour = date.getHours();
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function displayName(name: string | undefined | null): string {
  const trimmed = name?.trim();
  return trimmed || "there";
}

function formatDateParts(date = new Date()) {
  return {
    weekday: date.toLocaleDateString("en-PH", { weekday: "short" }).toUpperCase(),
    day: String(date.getDate()).padStart(2, "0"),
    month: date.toLocaleDateString("en-PH", { month: "short" }).toUpperCase(),
    year: String(date.getFullYear()),
  };
}

export function Dashboard() {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const dateParts = useMemo(() => formatDateParts(now), [now]);
  const daypart = useMemo(() => daypartLabel(now), [now]);
  const name = displayName(user?.name);

  return (
    <div className="w-full space-y-6">
      <header className="overflow-hidden rounded-2xl border border-border/80 bg-white">
        <div className="flex flex-col gap-6 px-5 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                Good {daypart}
              </p>
            </div>
            <div className="space-y-1">
              <h1 className="text-[1.85rem] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[2.15rem]">
                {name}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                Live snapshot of profit, spend, sales, and cash for Petrosphere.
              </p>
            </div>
          </div>

          <div
            className={cn(
              "flex shrink-0 items-stretch gap-3 self-start rounded-xl border border-border/70 bg-muted/30 px-4 py-3",
              "lg:self-auto",
            )}
            aria-label={`Today is ${dateParts.weekday} ${dateParts.day} ${dateParts.month} ${dateParts.year}`}
          >
            <div className="flex flex-col justify-center border-r border-border/70 pr-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {dateParts.weekday}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {dateParts.month}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
                {dateParts.day}
              </span>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {dateParts.year}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 bg-muted/20 px-5 py-3.5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Start
            </p>
            <div className="flex flex-wrap gap-2">
              {CREATE_ACTIONS.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md border border-border/80 bg-white px-3",
                    "text-sm font-medium text-foreground transition-colors",
                    "hover:border-foreground/25 hover:bg-muted/40",
                  )}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <ProfitLossSummaryCard />
        <ExpensesSummaryCard />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <SalesSummaryCard />
        <BankAccountsSummaryCard />
      </div>
    </div>
  );
}
