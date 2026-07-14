import type { InvoiceViewRow } from "@/lib/mock-data/adapters";

export const INVOICE_STATUS_FILTERS = [
  "all",
  "needs_attention",
  "overdue",
  "not_due",
  "not_deposited",
  "deposited",
] as const;

export type InvoiceStatusFilter = (typeof INVOICE_STATUS_FILTERS)[number];

export type InvoiceStatusFilterOption =
  | { type: "item"; value: InvoiceStatusFilter; label: string }
  | { type: "heading"; label: string };

export const INVOICE_STATUS_FILTER_OPTIONS: InvoiceStatusFilterOption[] = [
  { type: "item", value: "all", label: "All" },
  { type: "item", value: "needs_attention", label: "Needs attention" },
  { type: "heading", label: "Unpaid" },
  { type: "item", value: "overdue", label: "— Overdue" },
  { type: "item", value: "not_due", label: "— Not due" },
  { type: "heading", label: "Paid" },
  { type: "item", value: "not_deposited", label: "— Not deposited" },
  { type: "item", value: "deposited", label: "— Deposited" },
];

const LEGACY_STATUS_FILTER_MAP: Record<string, InvoiceStatusFilter> = {
  All: "all",
  "Needs attention": "needs_attention",
  Overdue: "overdue",
  Open: "not_due",
  "Not due": "not_due",
  Paid: "deposited",
  "Partially paid": "not_due",
  "Not deposited": "not_deposited",
  Deposited: "deposited",
};

export function normalizeInvoiceStatusFilter(value: string | null | undefined): InvoiceStatusFilter {
  if (!value?.trim()) return "all";
  const trimmed = value.trim();
  if ((INVOICE_STATUS_FILTERS as readonly string[]).includes(trimmed)) {
    return trimmed as InvoiceStatusFilter;
  }
  return LEGACY_STATUS_FILTER_MAP[trimmed] ?? "all";
}

export function invoiceStatusFilterLabel(filter: InvoiceStatusFilter): string {
  const match = INVOICE_STATUS_FILTER_OPTIONS.find(
    (option) => option.type === "item" && option.value === filter,
  );
  return match?.type === "item" ? match.label : "All";
}

/** QuickBooks hides fully settled rows from unpaid status filters. */
export function invoiceHasOpenBalance(row: InvoiceViewRow): boolean {
  if (row.status.kind === "void") return false;
  if (row.status.kind === "paid") return false;
  return row.balance > 0;
}

/**
 * QuickBooks invoice list "Not deposited" = partially paid (payment received, balance still open).
 * Not the same as the Paid KPI "Not deposited" line (undeposited bank payments).
 */
export function invoiceIsPartiallyPaid(row: InvoiceViewRow): boolean {
  if (!invoiceHasOpenBalance(row)) return false;
  return row.balance < row.amount;
}

/** Invoices that still need follow-up (QuickBooks “Needs attention”). */
export function invoiceNeedsAttention(row: InvoiceViewRow): boolean {
  if (row.status.kind === "void") return false;
  if (row.status.kind === "overdue" || row.status.kind === "partial") {
    return invoiceHasOpenBalance(row);
  }
  if (row.status.kind === "paid" && row.status.detail === "Not deposited") return true;
  return false;
}

export function invoiceMatchesStatusFilter(
  row: InvoiceViewRow,
  filter: InvoiceStatusFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "needs_attention":
      return invoiceNeedsAttention(row);
    case "overdue":
      // QuickBooks "Overdue" = overdue status with an open balance (not partial/open).
      return row.status.kind === "overdue" && invoiceHasOpenBalance(row);
    case "not_due":
      return (
        (row.status.kind === "open" || row.status.kind === "partial") &&
        invoiceHasOpenBalance(row)
      );
    case "not_deposited":
      return invoiceIsPartiallyPaid(row);
    case "deposited":
      // QuickBooks includes partially paid rows here as well as fully paid/deposited.
      return row.status.kind === "paid" || invoiceIsPartiallyPaid(row);
    default:
      return true;
  }
}
