import {
  findSalesTransactionForInvoice,
  getChartAccountsSnapshot,
  getInvoiceById,
  getNextPaymentNumber,
} from "./store";
import { isDirectBankDepositAccount } from "./chart-of-accounts";
import { statusSubFromTimeline, resolveInvoiceStatusTimeline } from "@/lib/invoice-status";
import {
  createInvoiceViaApi,
  updateInvoiceViaApi,
} from "@/lib/invoices/api";
import {
  createSalesTransactionViaApi,
  updateSalesTransactionViaApi,
} from "@/lib/sales-transactions/api";
import type { InvoiceStatusTimeline, InvoiceAttachment, MockInvoiceLine } from "./types";

type InvoiceLineInput = {
  id: string;
  serviceDate: string;
  productService: string;
  sku: string;
  description: string;
  qty: number;
  rate: number;
  className: string;
};

function normalizeInvoiceLines(lines: InvoiceLineInput[]): MockInvoiceLine[] {
  return lines
    .filter((line) => line.productService.trim() || line.qty * line.rate > 0)
    .map((line) => ({
      id: line.id,
      serviceDate: line.serviceDate,
      productService: line.productService.trim(),
      sku: line.sku.trim(),
      description: line.description.trim(),
      qty: line.qty,
      rate: line.rate,
      className: line.className.trim(),
    }));
}

function nowIso() {
  return new Date().toISOString();
}

async function patchInvoiceTimeline(
  invoiceId: string,
  patch: Partial<InvoiceStatusTimeline>,
): Promise<boolean> {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) return false;

  const statusTimeline: InvoiceStatusTimeline = {
    ...(invoice.statusTimeline ?? {}),
    ...patch,
  };

  try {
    await updateInvoiceViaApi(invoiceId, {
      statusTimeline,
      statusSub: statusSubFromTimeline(statusTimeline),
    });
    return true;
  } catch (error) {
    console.warn("Failed to update invoice timeline:", error);
    return false;
  }
}

export async function recordInvoiceOpened(invoiceId: string): Promise<boolean> {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) return false;
  if (invoice.statusTimeline?.openedAt) return true;

  const resolved = resolveInvoiceStatusTimeline(invoice);
  return patchInvoiceTimeline(invoiceId, {
    openedAt: resolved.openedAt ?? nowIso(),
    ...(resolved.paidAt ? { paidAt: resolved.paidAt } : {}),
    ...(resolved.depositedAt ? { depositedAt: resolved.depositedAt } : {}),
  });
}

export async function recordInvoiceSent(invoiceId: string): Promise<boolean> {
  return patchInvoiceTimeline(invoiceId, { sentAt: nowIso() });
}

export async function recordInvoiceViewed(invoiceId: string): Promise<boolean> {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) return false;

  const existing = invoice.statusTimeline ?? {};
  const viewHistory = [...(existing.viewHistory ?? []), nowIso()];
  return patchInvoiceTimeline(invoiceId, {
    viewedAt: nowIso(),
    viewCount: viewHistory.length,
    viewHistory,
  });
}

export async function recordInvoicePaid(invoiceId: string, paidAt = nowIso()): Promise<boolean> {
  return patchInvoiceTimeline(invoiceId, { paidAt });
}

export async function recordInvoiceDeposited(
  invoiceId: string,
  depositedAt = nowIso(),
): Promise<boolean> {
  return patchInvoiceTimeline(invoiceId, { depositedAt });
}

export function formatInvoiceNumber(number: string) {
  const trimmed = number.trim();
  if (!trimmed) return trimmed;
  return /^INV-/i.test(trimmed) ? trimmed : `INV-${trimmed}`;
}

/** Persists a new invoice to Supabase and the sales transactions ledger. */
export async function recordInvoiceCreation(input: {
  customerId: string;
  customerName: string;
  number: string;
  invoiceDate: string;
  terms: string;
  noteToCustomer: string;
  amount: number;
  balanceDue: number;
  lines: InvoiceLineInput[];
  attachments?: InvoiceAttachment[];
}) {
  const lines = normalizeInvoiceLines(input.lines);
  const openedAt = nowIso();
  const lineDescription = lines.map((l) => l.description.trim()).find(Boolean) ?? "";
  const memo = (lineDescription || input.noteToCustomer).trim().slice(0, 120);

  const invoice = await createInvoiceViaApi({
    customerId: input.customerId,
    customerName: input.customerName,
    number: input.number,
    date: input.invoiceDate,
    amount: input.amount,
    balanceDue: input.balanceDue,
    kind: "open",
    statusTimeline: { openedAt },
    ...(lines.length > 0 ? { lines } : {}),
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
  });

  // Same id as the invoice so list merge keeps lines/attachments on View/Edit.
  await createSalesTransactionViaApi({
    id: invoice.id,
    date: input.invoiceDate,
    type: "Invoice",
    number: formatInvoiceNumber(input.number),
    customer: input.customerName,
    memo,
    amount: input.amount,
    status: { kind: "overdue", detail: input.terms || "Due on receipt" },
    qbStatus: "open",
  });
}

/** Update an existing invoice in Supabase and sync the sales ledger row when found. */
export async function recordInvoiceUpdate(input: {
  invoiceId: string;
  customerId: string;
  customerName: string;
  number: string;
  invoiceDate: string;
  terms: string;
  noteToCustomer: string;
  amount: number;
  balanceDue: number;
  lines: InvoiceLineInput[];
  attachments?: InvoiceAttachment[];
}): Promise<boolean> {
  const lines = normalizeInvoiceLines(input.lines);
  const invoice = getInvoiceById(input.invoiceId);
  if (!invoice) return false;

  await updateInvoiceViaApi(input.invoiceId, {
    customerId: input.customerId,
    customerName: input.customerName,
    number: input.number,
    date: input.invoiceDate,
    amount: input.amount,
    balanceDue: input.balanceDue,
    lines,
    attachments: input.attachments ?? [],
  });

  const updated = getInvoiceById(input.invoiceId);
  if (!updated) return true;

  const txn = findSalesTransactionForInvoice(updated, input.customerName);
  if (txn) {
    const lineDescription = lines.map((l) => l.description.trim()).find(Boolean) ?? "";
    const memo = (lineDescription || input.noteToCustomer).trim().slice(0, 120);
    await updateSalesTransactionViaApi(txn.id, {
      date: input.invoiceDate,
      number: formatInvoiceNumber(input.number),
      customer: input.customerName,
      memo,
      amount: input.amount,
      status:
        input.balanceDue <= 0
          ? { kind: "closed" }
          : { kind: "overdue", detail: input.terms || "Due on receipt" },
    });
  }
  return true;
}

/** Record a customer payment and reduce the linked invoice balance. */
export async function recordReceivePaymentAgainstInvoice(input: {
  invoiceId: string;
  customerName: string;
  paymentDate: string;
  amount: number;
  referenceNo: string;
  memo: string;
  depositToId?: string;
}): Promise<boolean> {
  const invoice = getInvoiceById(input.invoiceId);
  if (!invoice || input.amount <= 0) return false;

  const displayNumber = input.referenceNo.trim()
    ? /^PMT-/i.test(input.referenceNo)
      ? input.referenceNo
      : `PMT-${input.referenceNo}`
    : getNextPaymentNumber();

  await createSalesTransactionViaApi({
    date: input.paymentDate,
    type: "Payment",
    number: displayNumber,
    customer: input.customerName,
    memo: input.memo.trim().slice(0, 120),
    amount: input.amount,
    status: { kind: "closed" },
    qbStatus: "applied",
    ...(input.depositToId ? { depositToAccountId: input.depositToId } : {}),
  });

  const newBalance = Math.max(0, invoice.balanceDue - input.amount);
  const paidAt = newBalance <= 0 ? nowIso() : undefined;
  const depositAccount = input.depositToId
    ? getChartAccountsSnapshot().find((a) => a.id === input.depositToId)
    : undefined;
  const depositedAt =
    paidAt && isDirectBankDepositAccount(depositAccount) ? paidAt : undefined;

  await updateInvoiceViaApi(input.invoiceId, {
    balanceDue: newBalance,
    kind: newBalance <= 0 ? "paid" : newBalance < invoice.amount ? "partial" : invoice.kind,
    ...(paidAt
      ? {
          statusTimeline: {
            ...(invoice.statusTimeline ?? {}),
            paidAt,
            ...(depositedAt ? { depositedAt } : {}),
          },
          statusSub: undefined,
        }
      : {}),
  });

  const refreshed = getInvoiceById(input.invoiceId);
  if (!refreshed) return true;

  const txn = findSalesTransactionForInvoice(refreshed, input.customerName);
  if (txn && newBalance <= 0) {
    await updateSalesTransactionViaApi(txn.id, {
      status: { kind: "closed" },
      qbStatus: "paid",
    });
  }

  return true;
}
