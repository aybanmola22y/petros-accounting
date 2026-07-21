import { parseTransactionDate } from "@/lib/ledger/date-utils";
import type {
  InvoiceAttachment,
  InvoiceKind,
  InvoiceStatusTimeline,
  MockInvoice,
  MockInvoiceLine,
} from "@/lib/mock-data/types";

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
  /** Optional dedicated column (migration 20260721100000). */
  attachments?: InvoiceAttachment[] | null;
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
  attachments?: InvoiceAttachment[] | null;
  sort_order?: number;
};

export type InvoiceUpdate = Partial<InvoiceInsert>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TimelineExtras = InvoiceStatusTimeline & {
  __attachments?: InvoiceAttachment[];
  __customerName?: string;
};

/** Only real customer UUIDs may be written to invoices.customer_id (FK). */
export function toDbCustomerId(customerId: string | null | undefined): string | null {
  const trimmed = customerId?.trim() ?? "";
  if (!trimmed || !UUID_RE.test(trimmed)) return null;
  return trimmed;
}

export function isUuidCustomerId(customerId: string | null | undefined): boolean {
  return Boolean(toDbCustomerId(customerId));
}

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

function stripTimelineExtras(
  timeline: TimelineExtras | null | undefined,
): InvoiceStatusTimeline | undefined {
  if (!timeline) return undefined;
  const { __attachments: _a, __customerName: _n, ...rest } = timeline;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

function resolveCustomerNameForStorage(invoice: Pick<MockInvoice, "customerId" | "customerName">): string | undefined {
  const explicit = invoice.customerName?.trim();
  if (explicit) return explicit;
  const id = invoice.customerId?.trim() ?? "";
  if (id.startsWith("import:")) return id.slice("import:".length).trim() || undefined;
  return undefined;
}

function embedInvoiceExtrasInTimeline(
  timeline: InvoiceStatusTimeline | null | undefined,
  attachments: InvoiceAttachment[] | null | undefined,
  customerName: string | null | undefined,
): TimelineExtras | null {
  const base = stripTimelineExtras(timeline as TimelineExtras | undefined) ?? {};
  const next: TimelineExtras = { ...base };
  if (attachments && attachments.length > 0) next.__attachments = attachments;
  const name = customerName?.trim();
  if (name) next.__customerName = name;
  return Object.keys(next).length > 0 ? next : null;
}

function readAttachments(row: InvoiceRow): InvoiceAttachment[] | undefined {
  if (Array.isArray(row.attachments) && row.attachments.length > 0) {
    return row.attachments;
  }
  const embedded = (row.status_timeline as TimelineExtras | null)?.__attachments;
  return Array.isArray(embedded) && embedded.length > 0 ? embedded : undefined;
}

function readCustomerName(row: InvoiceRow): string | undefined {
  const embedded = (row.status_timeline as TimelineExtras | null)?.__customerName?.trim();
  return embedded || undefined;
}

export function invoiceRowToMock(row: InvoiceRow): MockInvoice {
  const lines = Array.isArray(row.lines) ? row.lines : undefined;
  const attachments = readAttachments(row);
  const customerName = readCustomerName(row);
  const customerId = row.customer_id ?? "";
  return {
    id: row.id,
    number: row.invoice_number.trim(),
    date: formatMockDate(row.invoice_date),
    customerId,
    ...(customerName ? { customerName } : {}),
    amount: Number(row.amount) || 0,
    balanceDue: Number(row.balance_due) || 0,
    kind: (row.kind as InvoiceKind) || "open",
    overdueDays: row.overdue_days ?? undefined,
    statusSub: row.status_sub?.trim() || undefined,
    statusTimeline: stripTimelineExtras(row.status_timeline as TimelineExtras | null),
    voided: row.voided || undefined,
    ...(lines?.length ? { lines } : {}),
    ...(attachments?.length ? { attachments } : {}),
  };
}

export function mockInvoiceToInsert(invoice: Omit<MockInvoice, "id"> & { sortOrder?: number }): InvoiceInsert {
  return {
    invoice_number: invoice.number.trim(),
    invoice_date: parseMockDateToIso(invoice.date),
    customer_id: toDbCustomerId(invoice.customerId),
    amount: invoice.amount,
    balance_due: invoice.balanceDue,
    kind: invoice.kind,
    overdue_days: invoice.overdueDays ?? null,
    status_sub: invoice.statusSub ?? null,
    status_timeline: embedInvoiceExtrasInTimeline(
      invoice.statusTimeline,
      invoice.attachments,
      resolveCustomerNameForStorage(invoice),
    ),
    voided: invoice.voided ?? false,
    lines: invoice.lines?.length ? invoice.lines : null,
    sort_order: invoice.sortOrder,
  };
}

export function mockInvoicePatchToUpdate(patch: Partial<MockInvoice>): InvoiceUpdate {
  const update: InvoiceUpdate = {};
  if (patch.number !== undefined) update.invoice_number = patch.number.trim();
  if (patch.date !== undefined) update.invoice_date = parseMockDateToIso(patch.date);
  if (patch.customerId !== undefined) update.customer_id = toDbCustomerId(patch.customerId);
  if (patch.amount !== undefined) update.amount = patch.amount;
  if (patch.balanceDue !== undefined) update.balance_due = patch.balanceDue;
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.overdueDays !== undefined) update.overdue_days = patch.overdueDays ?? null;
  if (patch.statusSub !== undefined) update.status_sub = patch.statusSub ?? null;
  if (
    patch.statusTimeline !== undefined &&
    patch.attachments === undefined &&
    patch.customerName === undefined &&
    patch.customerId === undefined
  ) {
    update.status_timeline = embedInvoiceExtrasInTimeline(patch.statusTimeline, undefined, undefined);
  }
  if (patch.voided !== undefined) update.voided = patch.voided;
  if (patch.lines !== undefined) update.lines = patch.lines?.length ? patch.lines : null;
  return update;
}

/** Merge attachments + customer display name into an existing timeline. */
export function mergeAttachmentsIntoTimeline(
  existingTimeline: InvoiceStatusTimeline | null | undefined,
  attachments: InvoiceAttachment[] | null | undefined,
  customerName?: string | null,
): TimelineExtras | null {
  const existingName = (existingTimeline as TimelineExtras | null | undefined)?.__customerName;
  return embedInvoiceExtrasInTimeline(
    existingTimeline,
    attachments,
    customerName !== undefined ? customerName : existingName,
  );
}
