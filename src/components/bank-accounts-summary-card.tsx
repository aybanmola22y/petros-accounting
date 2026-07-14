"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Landmark,
  MoreVertical,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChartAccounts } from "@/hooks/use-chart-accounts";
import { useBankAccountActivity } from "@/hooks/use-bank-account-activity";
import { useToast } from "@/hooks/use-toast";
import { accountQuickReportHref } from "@/lib/account-quick-report-navigation";
import { buildDashboardBankAccountRows } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function formatBankAmount(amount: number, currency = "PHP"): string {
  const formatted = Math.abs(amount).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  return `${sign}${currency}${formatted}`;
}

function formatSyncedLabel(minutes: number): string {
  if (minutes < 1) return "Last updated just now";
  if (minutes === 1) return "Last updated 1 minute ago";
  return `Last updated ${minutes} minutes ago`;
}

function formatBankFeedAge(days: number): string {
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated 1 day ago";
  return `Updated ${days} days ago`;
}

type BankAccountsSummaryCardProps = {
  reconcileHref?: string;
  className?: string;
};

export function BankAccountsSummaryCard({
  reconcileHref = "/accounting/reconcile",
  className,
}: BankAccountsSummaryCardProps) {
  const { accounts: chartAccounts, loading: accountsLoading, refresh } = useChartAccounts();
  const {
    activity,
    loading: activityLoading,
    refresh: refreshActivity,
  } = useBankAccountActivity();
  const { toast } = useToast();
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const loading = accountsLoading || activityLoading;

  // QuickBooks shows every bank account with a book balance — not only those
  // that already have an imported General Ledger register.
  const rows = useMemo(
    () =>
      buildDashboardBankAccountRows(chartAccounts).map((row) => ({
        row,
        activity: activity[row.id],
      })),
    [chartAccounts, activity],
  );

  const minutesSinceRefresh = Math.max(
    0,
    Math.floor((Date.now() - lastRefreshedAt) / 60_000),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refresh(), refreshActivity()]);
      setLastRefreshedAt(Date.now());
      toast({
        title: "Bank accounts updated",
        description: "Balances and transactions refreshed.",
      });
    } catch {
      toast({
        title: "Refresh failed",
        description: "Could not reload bank account data.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh, refreshActivity, toast]);

  return (
    <section
      className={cn(
        "rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col",
        className,
      )}
    >
      <div className="border-b px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Bank Accounts
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatSyncedLabel(minutesSinceRefresh)}</span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Refresh bank accounts"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground sm:pt-0.5">As of today</p>
        </div>
      </div>

      <div className="flex-1 divide-y">
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            Loading bank accounts…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No bank accounts yet. Import your Chart of Accounts from QuickBooks to see balances
            here.
          </div>
        ) : (
          rows.map(({ row }) => (
            <Link
              key={row.id}
              href={accountQuickReportHref(row.id)}
              className="group block px-5 py-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <Landmark className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-snug text-foreground group-hover:underline">
                        {row.label}
                      </p>
                      {row.showBankBalance ? (
                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          <p>Bank balance</p>
                          {row.lastSyncedDays != null ? (
                            <p>{formatBankFeedAge(row.lastSyncedDays)}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 space-y-1 text-right text-sm tabular-nums">
                      {row.showBankBalance && row.bankBalance !== undefined ? (
                        <p className="font-medium text-foreground">
                          {formatBankAmount(row.bankBalance, row.currency)}
                        </p>
                      ) : null}
                      <p
                        className={cn(
                          row.showBankBalance
                            ? "text-xs text-muted-foreground"
                            : "font-medium text-foreground",
                        )}
                      >
                        {row.showBankBalance ? "In QuickBooks " : ""}
                        {formatBankAmount(row.bookBalance, row.currency)}
                      </p>
                    </div>
                  </div>

                  {row.needsAttention ? (
                    <div className="mt-2 flex items-center justify-end gap-3 text-xs">
                      <span className="inline-flex items-center gap-1 font-medium text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Needs attention
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="border-t bg-muted/40 px-5 py-3">
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          <span>Is this banking info helpful?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFeedback("up")}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted",
                feedback === "up" && "border-primary text-primary",
              )}
              aria-label="Yes, helpful"
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setFeedback("down")}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted",
                feedback === "down" && "border-primary text-primary",
              )}
              aria-label="No, not helpful"
            >
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t px-5 py-4">
        <Button variant="link" className="h-auto p-0 text-primary font-medium" asChild>
          <Link href={reconcileHref}>Go to reconcile</Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Connect account</DropdownMenuItem>
            <DropdownMenuItem>Customize widget</DropdownMenuItem>
            <DropdownMenuItem>Hide from dashboard</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>
  );
}
