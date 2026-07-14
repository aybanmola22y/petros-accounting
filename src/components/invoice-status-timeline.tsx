"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  buildInvoiceStatusSteps,
  formatStatusDate,
  resolveInvoiceStatusTimeline,
  type InvoiceStatusStep,
} from "@/lib/invoice-status";
import type { MockInvoice } from "@/lib/mock-data/types";
import { cn } from "@/lib/utils";

type InvoiceStatusTimelineProps = {
  invoice: MockInvoice;
};

function StepNode({ step }: { step: InvoiceStatusStep }) {
  if (step.state === "pending") {
    return (
      <span
        className="relative z-10 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/35 bg-card"
        aria-hidden
      />
    );
  }

  if (step.state === "current") {
    return (
      <span className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
        <span className="absolute h-4 w-4 rounded-full bg-emerald-600/25" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
      </span>
    );
  }

  return (
    <span
      className="relative z-10 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600"
      aria-hidden
    />
  );
}

function ViewedStepLabel({
  step,
  viewHistory,
}: {
  step: InvoiceStatusStep;
  viewHistory?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasHistory = (viewHistory?.length ?? 0) > 0;

  if (step.key !== "viewed" || !hasHistory) {
    return <span className="text-sm leading-snug">{step.label}</span>;
  }

  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center gap-0.5 text-sm leading-snug hover:text-primary"
        onClick={() => setExpanded((v) => !v)}
      >
        {step.label}
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      </button>
      {expanded ? (
        <ul className="mt-1.5 space-y-1 pl-0.5">
          {viewHistory!.map((iso, i) => (
            <li key={`${iso}-${i}`} className="text-xs text-muted-foreground">
              {formatStatusDate(iso, true)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function InvoiceStatusTimeline({ invoice }: InvoiceStatusTimelineProps) {
  const timeline = resolveInvoiceStatusTimeline(invoice);
  const steps = buildInvoiceStatusSteps(timeline, invoice);

  return (
    <ol className="relative space-y-0 pb-1">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isActive = step.state !== "pending";

        return (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast ? (
              <span
                className={cn(
                  "absolute left-[6px] top-3.5 -bottom-0.5 w-px",
                  isActive ? "bg-emerald-600/70" : "bg-muted-foreground/25",
                )}
                aria-hidden
              />
            ) : null}
            <div className="pt-0.5">
              <StepNode step={step} />
            </div>
            <div className="min-w-0 flex-1 -mt-0.5">
              {step.key === "viewed" ? (
                <ViewedStepLabel step={step} viewHistory={timeline.viewHistory} />
              ) : (
                <span
                  className={cn(
                    "text-sm leading-snug",
                    step.state === "pending" && "text-muted-foreground/70",
                  )}
                >
                  {step.label}
                </span>
              )}
              {step.timestamp ? (
                <p className="text-xs text-muted-foreground mt-0.5">{step.timestamp}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
