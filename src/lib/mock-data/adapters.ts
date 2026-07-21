import type { MockInvoice } from "./types";
import { getCustomerName } from "./compute";
import type { MockCustomer } from "./types";
import { resolveInvoiceStatusTimeline, statusSubFromTimeline, isInvoiceDeposited } from "@/lib/invoice-status";

export type InvoiceViewStatus =
  | { kind: "overdue"; detail: string; sub?: string }
  | { kind: "partial"; detail: string }
  | { kind: "paid"; detail: "Deposited" | "Not deposited" }
  | { kind: "open"; detail?: string }
  | { kind: "void" };

export type InvoiceViewRow = {
  id: string;
  date: string;
  number: string;
  customer: string;
  amount: number;
  balance: number;
  dueDate: string;
  status: InvoiceViewStatus;
};

function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

function parseInvoiceDate(date: string): Date | null {
  const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  return new Date(year, Number(m[1]) - 1, Number(m[2]));
}

/** App anchor date for overdue due-date display (matches seed "today"). */
const INVOICE_LIST_TODAY = new Date(2026, 4, 21);

function estimateDueDate(invoice: MockInvoice): string {
  if (invoice.kind === "paid") return invoice.date;
  if (invoice.kind === "open") {
    const base = parseInvoiceDate(invoice.date);
    if (!base) return "—";
    base.setDate(base.getDate() + 14);
    return formatShortDate(base);
  }
  if (invoice.kind === "overdue") {
    const due = new Date(INVOICE_LIST_TODAY);
    due.setDate(due.getDate() - (invoice.overdueDays ?? 1));
    return formatShortDate(due);
  }
  const base = parseInvoiceDate(invoice.date);
  return base ? formatShortDate(base) : "—";
}

function deliverySub(invoice: MockInvoice): string | undefined {
  return statusSubFromTimeline(resolveInvoiceStatusTimeline(invoice)) ?? invoice.statusSub;
}

function rowBalance(invoice: MockInvoice): number {
  return invoice.kind === "paid" ? 0 : invoice.balanceDue;
}

export function mockInvoiceToViewRow(
  invoice: MockInvoice,
  customers: MockCustomer[] = [],
): InvoiceViewRow {
  const customer = getCustomerName(invoice.customerId, customers, invoice.customerName);
  const balance = rowBalance(invoice);
  const dueDate = estimateDueDate(invoice);

  if (invoice.voided) {
    return {
      id: invoice.id,
      date: invoice.date,
      number: invoice.number,
      customer,
      amount: invoice.amount,
      balance: 0,
      dueDate,
      status: { kind: "void" },
    };
  }

  if (invoice.kind === "paid") {
    return {
      id: invoice.id,
      date: invoice.date,
      number: invoice.number,
      customer,
      amount: invoice.amount,
      balance,
      dueDate,
      status: {
        kind: "paid",
        detail: isInvoiceDeposited(invoice) ? "Deposited" : "Not deposited",
      },
    };
  }

  if (invoice.kind === "open") {
    return {
      id: invoice.id,
      date: invoice.date,
      number: invoice.number,
      customer,
      amount: invoice.amount,
      balance,
      dueDate,
      status: { kind: "open", detail: "Due in 14 days" },
    };
  }

  if (invoice.kind === "partial") {
    return {
      id: invoice.id,
      date: invoice.date,
      number: invoice.number,
      customer,
      amount: invoice.amount,
      balance,
      dueDate,
      status: {
        kind: "partial",
        detail: `Partially paid, ${formatDue(invoice.balanceDue)} due`,
      },
    };
  }

  const days = invoice.overdueDays ?? 1;
  const partialSub =
    invoice.balanceDue < invoice.amount
      ? `Partially paid, ${formatDue(invoice.balanceDue)} due`
      : undefined;
  return {
    id: invoice.id,
    date: invoice.date,
    number: invoice.number,
    customer,
    amount: invoice.amount,
    balance,
    dueDate,
    status: {
      kind: "overdue",
      detail: `Overdue ${days} day${days === 1 ? "" : "s"}`,
      sub: partialSub ?? deliverySub(invoice),
    },
  };
}

function formatDue(amount: number) {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function invoiceNumberValue(number: string): number {
  const digits = number.replace(/\D/g, "");
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? 0 : n;
}

function invoiceCreatedTime(id: string): number {
  const match = id.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

/** Descending by invoice number (highest NO. first) so the column stays easy to scan. */
function compareInvoicesByNumberDesc(a: MockInvoice, b: MockInvoice): number {
  const numDiff = invoiceNumberValue(b.number) - invoiceNumberValue(a.number);
  if (numDiff !== 0) return numDiff;

  const dateA = parseInvoiceDate(a.date)?.getTime() ?? 0;
  const dateB = parseInvoiceDate(b.date)?.getTime() ?? 0;
  if (dateA !== dateB) return dateB - dateA;

  return invoiceCreatedTime(b.id) - invoiceCreatedTime(a.id);
}

/** Invoice rows for the list — real records only (no demo padding). */
export function buildDisplayInvoiceList(
  base: MockInvoice[],
  customers: MockCustomer[] = [],
): InvoiceViewRow[] {
  return [...base].sort(compareInvoicesByNumberDesc).map((invoice) => mockInvoiceToViewRow(invoice, customers));
}

/** Counts from real invoices only (matches pipeline / summary cards). */
export function countInvoicesByStatus(base: MockInvoice[]) {
  const rows = base.map((invoice) => mockInvoiceToViewRow(invoice));
  return {
    overdue: rows.filter((r) => r.status.kind === "overdue").length,
    open: rows.filter((r) => r.status.kind === "open").length,
    partial: rows.filter((r) => r.status.kind === "partial").length,
    paid: rows.filter((r) => r.status.kind === "paid").length,
    unpaid: rows.filter((r) => r.status.kind !== "paid").length,
  };
}
