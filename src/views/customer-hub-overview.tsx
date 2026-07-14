"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileSignature,
  FileText,
  FolderKanban,
  MessageSquare,
  Plus,
  Receipt,
  Star,
  Target,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMockReceivables } from "@/hooks/use-mock-receivables";
import { useMockSales } from "@/hooks/use-mock-sales";
import { computeCustomerHubOverdue } from "@/lib/ledger/compute-invoice-summary";
import { customersListHref } from "@/lib/customer-navigation";
import { invoicesHref } from "@/lib/invoice-navigation";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

type PipelineStep = {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
  href?: string;
  alert?: { text: string; variant: "warning" | "muted" };
};

const PIPELINE_CONFIG: Omit<PipelineStep, "value" | "alert">[] = [
  { id: "opportunities", label: "Opportunities", icon: Target },
  { id: "estimates", label: "Estimates", icon: FileText, href: "/sales/overview" },
  { id: "contracts", label: "Contracts", icon: FileSignature },
  { id: "projects", label: "Active projects", icon: FolderKanban },
  { id: "invoices", label: "Unpaid invoices", icon: Receipt, href: "/sales/invoices?status=overdue" },
  { id: "reviews", label: "Reviews", icon: Star },
];

function buildPipelineSteps(
  metrics: { id: string; value: number; overdueCount?: number }[],
  overdueCount: number,
): PipelineStep[] {
  const byId = Object.fromEntries(metrics.map((m) => [m.id, m]));
  return PIPELINE_CONFIG.map((cfg) => ({
    ...cfg,
    value: byId[cfg.id]?.value ?? 0,
    alert:
      cfg.id === "invoices" && overdueCount > 0
        ? { text: `${overdueCount} overdue`, variant: "warning" as const }
        : undefined,
  }));
}

const SHORTCUTS = [
  { label: "New customer", href: customersListHref(true), icon: UserPlus },
  { label: "Import customers", href: "/customers/list", icon: Users },
  { label: "Create invoice", href: invoicesHref(true), icon: FileText },
  { label: "View customers", href: "/customers/list", icon: ClipboardList },
] as const;

function PipelineStepNode({ step }: { step: PipelineStep }) {
  const hasActivity = step.value > 0;
  const content = (
    <>
      <div
        className={cn(
          "relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-card shadow-sm transition-colors",
          hasActivity
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground",
        )}
      >
        <step.icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="mt-3 min-w-0 text-center">
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums tracking-tight leading-none",
            !hasActivity && "text-muted-foreground/80",
          )}
        >
          {step.value}
        </p>
        <p className="mt-1.5 text-xs font-medium text-muted-foreground leading-snug px-1">
          {step.label}
        </p>
        {step.alert && (
          <span
            className={cn(
              "mt-2 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
              step.alert.variant === "warning"
                ? "bg-amber-500/12 text-amber-800 dark:text-amber-200"
                : "bg-muted text-muted-foreground",
            )}
          >
            {step.alert.text}
          </span>
        )}
      </div>
    </>
  );

  const wrapperClass = cn(
    "flex flex-col items-center",
    step.href && "group cursor-pointer rounded-xl p-2 -m-2 hover:bg-muted/40 transition-colors",
  );

  if (step.href) {
    return (
      <Link href={step.href} className={wrapperClass}>
        {content}
      </Link>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}

function CustomerPipeline() {
  const { customerHubSummary, pipeline } = useMockReceivables();
  const steps = buildPipelineSteps(pipeline, customerHubSummary.overdueCount);
  const activeCount = steps.filter((s) => s.value > 0).length;
  const pipelineProgress =
    customerHubSummary.unpaidCount > 0
      ? Math.min(
          0.92,
          0.45 + customerHubSummary.overdueCount / customerHubSummary.unpaidCount / 2,
        )
      : 0.2;

  return (
    <section className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="border-b bg-muted/20 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">Customer pipeline</h2>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Track work from first opportunity through billing and feedback.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground">
            Today
          </span>
          <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {activeCount} stage{activeCount === 1 ? "" : "s"} with activity
          </span>
        </div>
      </div>

      {/* Desktop: connected stepper */}
      <div className="hidden md:block px-6 pt-8 pb-6">
        <div className="relative mx-6 mb-10">
          <div className="absolute left-[4%] right-[4%] top-5 h-1 rounded-full bg-muted" />
          <div
            className="absolute left-[4%] top-5 h-1 rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary/70 transition-all"
            style={{ width: `${pipelineProgress * 92}%` }}
          />
        </div>
        <div className="grid grid-cols-6 gap-2">
          {steps.map((step) => (
            <PipelineStepNode key={step.id} step={step} />
          ))}
        </div>
      </div>

      {/* Mobile: vertical timeline */}
      <div className="md:hidden divide-y">
        {steps.map((step, i) => {
          const hasActivity = step.value > 0;
          const row = (
            <div className="flex items-start gap-4 px-5 py-4">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card",
                    hasActivity
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <step.icon className="h-4 w-4" />
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "mt-1 w-0.5 flex-1 min-h-[24px] rounded-full",
                      hasActivity ? "bg-primary/30" : "bg-border",
                    )}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-xl font-semibold tabular-nums">{step.value}</p>
                </div>
                {step.alert && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{step.alert.text}</p>
                )}
              </div>
            </div>
          );
          return step.href ? (
            <Link key={step.id} href={step.href} className="block hover:bg-muted/30 transition-colors">
              {row}
            </Link>
          ) : (
            <div key={step.id}>{row}</div>
          );
        })}
      </div>

      <div className="border-t bg-muted/10 px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{customerHubSummary.unpaidCount}</span> open receivables
          need attention ({formatPHP(customerHubSummary.unpaidTotal)})
        </span>
        <Button variant="link" className="h-auto p-0 text-xs" asChild>
          <Link href="/sales/invoices?status=overdue">Review invoices</Link>
        </Button>
      </div>
    </section>
  );
}

function SurveyCard({
  tag,
  title,
  children,
}: {
  tag: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-1 flex-col p-5 gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tag}
          </p>
          <h3 className="mt-2 text-base font-semibold leading-snug">{title}</h3>
        </div>
        <div className="flex flex-1 items-center justify-center py-4">{children}</div>
        <Button variant="outline" className="w-full">
          Manage survey settings
        </Button>
      </div>
    </section>
  );
}

export function CustomerHubOverview() {
  const { customerHubOverdue: storeOverdue } = useMockReceivables();
  const salesTransactions = useMockSales();

  const customerHubOverdue = useMemo(
    () =>
      salesTransactions.length > 0
        ? computeCustomerHubOverdue(salesTransactions)
        : storeOverdue,
    [salesTransactions, storeOverdue],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Customers & Leads
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Customer Hub Overview</h1>
          <p className="text-sm text-muted-foreground">Customers at a glance</p>
        </div>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground shrink-0">
          <MessageSquare className="h-4 w-4" />
          Give us feedback
        </Button>
      </div>

      <CustomerPipeline />

      <div className="grid gap-4 lg:grid-cols-3">
        <SurveyCard
          tag="Work requests"
          title="Drive repeat business using the post-invoice survey"
        >
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-center max-w-[200px]">
            <span className="text-muted-foreground">wants to work with you again</span>
          </div>
        </SurveyCard>
        <SurveyCard
          tag="Referrals"
          title="Generate referrals using the post-invoice survey"
        >
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-center max-w-[200px]">
            <span className="text-muted-foreground">You&apos;ve received a new referral</span>
          </div>
        </SurveyCard>
        <SurveyCard
          tag="Reviews & testimonials"
          title="Collect feedback using the post-invoice survey"
        >
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">You&apos;ve received some feedback</p>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn(
                    "h-5 w-5",
                    n <= 4 ? "fill-emerald-500 text-emerald-500" : "text-muted-foreground/30",
                  )}
                />
              ))}
            </div>
          </div>
        </SurveyCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card shadow-sm flex flex-col">
          <div className="border-b px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Overdue invoices
              </h2>
              <span className="shrink-0 rounded-md border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                As of today
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Total of overdue invoices</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatPHP(customerHubOverdue.amount)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {customerHubOverdue.count} overdue invoice
              {customerHubOverdue.count === 1 ? "" : "s"}
            </p>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Client</th>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {customerHubOverdue.rows.map((row) => (
                  <tr key={row.invoiceId} className="border-b border-border/50">
                    <td className="px-4 py-2.5">
                      <button type="button" className="text-primary font-medium hover:underline text-left">
                        {row.client}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.date}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {formatPHP(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-5 py-3">
            <Button variant="link" className="h-auto p-0" asChild>
              <Link href="/sales/invoices">View invoices</Link>
            </Button>
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-sm flex flex-col p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Open estimates
          </h2>
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center gap-3">
            <p className="text-sm text-muted-foreground max-w-xs">
              You have no open estimates. Create an estimate to win more jobs!
            </p>
            <Button variant="outline" asChild>
              <Link href="/sales/overview">Create an estimate</Link>
            </Button>
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tasks
            </h2>
            <Button variant="link" className="h-auto p-0 text-xs">
              All open tasks
              <ChevronRight className="h-3.5 w-3.5 rotate-90" />
            </Button>
          </div>
          <div className="flex flex-col items-center justify-center px-5 py-12 text-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <p className="font-medium">You&apos;re caught up!</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              You don&apos;t have any tasks to do. Check back soon to stay on top of things.
            </p>
          </div>
          <div className="border-t px-5 py-3">
            <Button variant="link" className="h-auto p-0 text-xs">
              Show all
            </Button>
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-sm p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Shortcuts
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {SHORTCUTS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex flex-col items-center gap-2 rounded-lg p-3 hover:bg-muted/50 transition-colors text-center"
              >
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Plus className="h-3 w-3" />
                  </span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
