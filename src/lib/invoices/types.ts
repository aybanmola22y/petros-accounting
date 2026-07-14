import { parseTransactionDate } from "@/lib/ledger/date-utils";
import type { InvoiceKind, InvoiceStatusTimeline, MockInvoice, MockInvoiceLine } from "@/lib/mock-data/types";

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string | null;
  amount: number | string;
  balance_due: number | string;
  kind: string;
  overdue_days: number | null;
  status_sub: string | null;
  status_timeline: InvoiceStatusTimeline | null;
  voided: boolean;
  lines: MockInvoiceLine[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type InvoiceInsert = {
  invoice_number: string;
  invoice_date: string;
  customer_id?: string | null;
  amount: number;
  balance_due: number;
  kind?: InvoiceKind;
  overdue_days?: number | null;
  status_sub?: string | null;
  status_timeline?: InvoiceStatusTimeline | null;
  voided?: boolean;
  lines?: MockInvoiceLine[] | null;
  sort_order?: number;
};

export type InvoiceUpdate = Partial<InvoiceInsert>;

function formatMockDate(isoDate: string): string {
  const isoPrefix = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) {
    const year = Number(isoPrefix[1]);
    const month = Number(isoPrefix[2]);
    const day = Number(isoPrefix[3]);
    return `${month}/${day}/${year}`;
  }

  const parsed = parseTransactionDate(isoDate);
  if (!parsed || Number.isNaN(parsed.getTime())) return isoDate;
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`;
}

function parseMockDateToIso(date: string): string {
  const parsed = parseTransactionDate(date);
  return parsed ? parsed.toISOString().slice(0, 10) : date;
}

export function invoiceRowToMock(row: InvoiceRow): MockInvoice {
  const lines = Array.isArray(row.lines) ? row.lines : undefined;
  return {
    id: row.id,
    number: row.invoice_number.trim(),
    date: formatMockDate(row.invoice_date),
    customerId: row.customer_id ?? "",
    amount: Number(row.amount) || 0,
    balanceDue: Number(row.balance_due) || 0,
    kind: (row.kind as InvoiceKind) || "open",
    overdueDays: row.overdue_days ?? undefined,
    statusSub: row.status_sub?.trim() || undefined,
    statusTimeline: row.status_timeline ?? undefined,
    voided: row.voided || undefined,
    ...(lines?.length ? { lines } : {}),
  };
}

export function mockInvoiceToInsert(invoice: Omit<MockInvoice, "id"> & { sortOrder?: number }): InvoiceInsert {
  return {
    invoice_number: invoice.number.trim(),
    invoice_date: parseMockDateToIso(invoice.date),
    customer_id: invoice.customerId || null,
    amount: invoice.amount,
    balance_due: invoice.balanceDue,
    kind: invoice.kind,
    overdue_days: invoice.overdueDays ?? null,
    status_sub: invoice.statusSub ?? null,
    status_timeline: invoice.statusTimeline ?? null,
    voided: invoice.voided ?? false,
    lines: invoice.lines?.length ? invoice.lines : null,
    sort_order: invoice.sortOrder,
  };
}

export function mockInvoicePatchToUpdate(patch: Partial<MockInvoice>): InvoiceUpdate {
  const update: InvoiceUpdate = {};
  if (patch.number !== undefined) update.invoice_number = patch.number.trim();
  if (patch.date !== undefined) update.invoice_date = parseMockDateToIso(patch.date);
  if (patch.customerId !== undefined) update.customer_id = patch.customerId || null;
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.balanceDue !== undefined) update.balance_due = patch.balanceDue;
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.overdueDays !== undefined) update.overdue_days = patch.overdueDays ?? null;
  if (patch.statusSub !== undefined) update.status_sub = patch.statusSub ?? null;
  if (patch.statusTimeline !== undefined) update.status_timeline = patch.statusTimeline ?? null;
  if (patch.voided !== undefined) update.voided = patch.voided;
  if (patch.lines !== undefined) update.lines = patch.lines?.length ? patch.lines : null;
  return update;
}
