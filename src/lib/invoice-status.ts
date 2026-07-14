import type { InvoiceViewRow } from "@/lib/mock-data/adapters";
import type { InvoiceStatusTimeline, MockInvoice } from "@/lib/mock-data/types";

export type InvoiceStatusStepKey = "opened" | "sent" | "viewed" | "paid" | "deposited";

export type InvoiceStatusStep = {
  key: InvoiceStatusStepKey;
  label: string;
  detail?: string;
  timestamp?: string;
  state: "complete" | "current" | "pending";
};

const APP_ANCHOR = new Date(2026, 5, 9, 10, 55, 0);

function parseShortDate(date: string): Date {
  const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return APP_ANCHOR;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  return new Date(year, Number(m[1]) - 1, Number(m[2]), 10, 0, 0);
}

/** Backfill timeline from stored fields when statusTimeline is missing. */
export function resolveInvoiceStatusTimeline(invoice: MockInvoice): InvoiceStatusTimeline {
  if (invoice.statusTimeline) {
    return { ...invoice.statusTimeline };
  }

  const openedAt = parseShortDate(invoice.date).toISOString();
  const timeline: InvoiceStatusTimeline = { openedAt };

  if (invoice.kind === "paid") {
    const paid = parseShortDate(invoice.date);
    paid.setHours(14, 0, 0, 0);
    timeline.paidAt = paid.toISOString();
  }

  return timeline;
}

/** True only when funds were explicitly marked deposited (bank deposit), not merely paid. */
export function isInvoiceDeposited(invoice: MockInvoice): boolean {
  return Boolean(invoice.statusTimeline?.depositedAt);
}

export function formatStatusDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (withTime) {
    return d.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

export function invoiceStatusHeadline(timeline: InvoiceStatusTimeline, invoice: MockInvoice): string {
  if (timeline.depositedAt) return "Deposited";
  if (timeline.paidAt || invoice.kind === "paid") return "Paid";
  if (timeline.viewedAt) return "Viewed";
  if (timeline.sentAt) return "Sent";
  if (timeline.openedAt) return "Opened";
  return "Open";
}

export function buildInvoiceStatusSteps(
  timeline: InvoiceStatusTimeline,
  invoice: MockInvoice,
): InvoiceStatusStep[] {
  const t = timeline;
  const viewCount = t.viewCount ?? t.viewHistory?.length ?? 0;

  const openedDone = Boolean(t.openedAt);
  const sentDone = Boolean(t.sentAt);
  const viewedDone = Boolean(t.viewedAt) || viewCount > 0;
  const paidDone = Boolean(t.paidAt) || invoice.kind === "paid";
  const depositedDone = Boolean(t.depositedAt);

  let current: InvoiceStatusStepKey = "opened";
  if (depositedDone) current = "deposited";
  else if (paidDone) current = "paid";
  else if (viewedDone) current = "viewed";
  else if (sentDone) current = "sent";
  else if (openedDone) current = "opened";

  function state(key: InvoiceStatusStepKey): InvoiceStatusStep["state"] {
    const order: InvoiceStatusStepKey[] = ["opened", "sent", "viewed", "paid", "deposited"];
    const currentIdx = order.indexOf(current);
    const keyIdx = order.indexOf(key);
    if (keyIdx < currentIdx) return "complete";
    if (keyIdx === currentIdx) return "current";
    return "pending";
  }

  return [
    {
      key: "opened",
      label: "Opened",
      timestamp: t.openedAt ? formatStatusDate(t.openedAt, false) : undefined,
      state: state("opened"),
    },
    {
      key: "sent",
      label: "Sent",
      timestamp: t.sentAt ? formatStatusDate(t.sentAt, true) : undefined,
      state: state("sent"),
    },
    {
      key: "viewed",
      label:
        viewCount > 1
          ? `Viewed ${viewCount} times`
          : viewCount === 1
            ? "Viewed 1 time"
            : "Viewed",
      timestamp: t.viewedAt ? formatStatusDate(t.viewedAt, true) : undefined,
      state: state("viewed"),
    },
    {
      key: "paid",
      label: "Paid",
      timestamp: t.paidAt ? formatStatusDate(t.paidAt, true) : undefined,
      state: state("paid"),
    },
    {
      key: "deposited",
      label: "Deposited",
      timestamp: t.depositedAt ? formatStatusDate(t.depositedAt, true) : undefined,
      state: state("deposited"),
    },
  ];
}

export function statusSubFromTimeline(timeline: InvoiceStatusTimeline): string | undefined {
  if (timeline.viewedAt || (timeline.viewCount ?? 0) > 0) return "Viewed";
  if (timeline.sentAt) return "Sent";
  return undefined;
}

/** QBO activity panel status, e.g. "Overdue (Viewed)" or "Deposited". */
export function invoiceActivityStatusLabel(
  invoice: MockInvoice,
  viewRow: InvoiceViewRow,
): string {
  if (invoice.voided || viewRow.status.kind === "void") return "Voided";

  const timeline = resolveInvoiceStatusTimeline(invoice);
  const deliverySub =
    statusSubFromTimeline(timeline) ??
    (viewRow.status.kind === "overdue" ? viewRow.status.sub : undefined);

  const withSub = (primary: string) => {
    if (!deliverySub) return primary;
    if (primary.toLowerCase() === deliverySub.toLowerCase()) return primary;
    return `${primary} (${deliverySub})`;
  };

  if (isInvoiceDeposited(invoice)) return "Deposited";
  if (invoice.kind === "paid") {
    if (viewRow.status.kind === "paid" && viewRow.status.detail === "Not deposited") {
      return withSub("Paid");
    }
    return "Paid";
  }
  if (viewRow.status.kind === "overdue") return withSub("Overdue");
  if (viewRow.status.kind === "partial") return "Partially paid";
  if (viewRow.status.kind === "open") return withSub("Open");
  return invoiceStatusHeadline(timeline, invoice);
}
