import { isDateInRange, parseTransactionDate } from "@/lib/ledger/date-utils";
import { startOfDay } from "@/lib/report-date-utils";

export const DEFAULT_INVOICE_PAYMENT_TERMS_DAYS = 14;

export type InvoiceOpenBalanceRow = {
  id: string;
  date: string;
  customer: string;
  amount: number;
  /** Raw QuickBooks status (paid, overdue, open, partial, etc.). */
  qbStatus: string;
};

export type PaymentAllocationRow = {
  date: string;
  customer: string;
  amount: number;
  qbStatus: string;
  memo?: string;
};

function normalizeCustomer(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

function isVoidPayment(row: PaymentAllocationRow): boolean {
  const status = normalizeStatus(row.qbStatus);
  const memo = row.memo?.trim().toLowerCase() ?? "";
  return status === "void" || memo.includes("void");
}

function isAppliedPayment(row: PaymentAllocationRow): boolean {
  const status = normalizeStatus(row.qbStatus);
  return status === "applied" || status === "closed";
}

function isPaidInvoiceStatus(status: string): boolean {
  const normalized = normalizeStatus(status);
  return normalized === "paid" || normalized === "closed";
}

type AllocationInvoice = {
  id: string;
  customer: string;
  date: Date;
  open: number;
  paid: boolean;
};

function applyPaymentToInvoices(
  invoicesForCustomer: AllocationInvoice[],
  paymentAmount: number,
  paymentDate: Date,
  allowPrepayment: boolean,
): number {
  let remaining = paymentAmount;
  for (const invoice of invoicesForCustomer) {
    if (remaining <= 0) break;
    if (invoice.open <= 0) continue;
    if (!allowPrepayment && paymentDate.getTime() < invoice.date.getTime()) continue;

    const applied = Math.min(invoice.open, remaining);
    invoice.open -= applied;
    remaining -= applied;
  }
  return remaining;
}

/**
 * QuickBooks-style open balance: invoice amount minus applied payments
 * allocated FIFO per customer (oldest invoice first).
 *
 * Paid invoices still absorb payments so earlier receipts are not
 * re-applied to later invoices. Leftover applied amounts (prepayments
 * dated before the invoice) apply in a second pass.
 */
export function computeInvoiceOpenBalances(
  invoices: readonly InvoiceOpenBalanceRow[],
  payments: readonly PaymentAllocationRow[],
): Map<string, number> {
  const openById = new Map<string, number>();

  const allocationInvoices: AllocationInvoice[] = invoices
    .map((invoice) => {
      const amount = Math.abs(invoice.amount);
      const paid = isPaidInvoiceStatus(invoice.qbStatus);
      const date = parseTransactionDate(invoice.date);
      return {
        id: invoice.id,
        customer: normalizeCustomer(invoice.customer),
        date: date!,
        open: amount,
        paid,
      };
    })
    .filter((invoice) => invoice.customer && invoice.date && invoice.open > 0)
    .sort((a, b) => {
      const byDate = a.date.getTime() - b.date.getTime();
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
    });

  for (const invoice of allocationInvoices) {
    openById.set(invoice.id, invoice.paid ? 0 : invoice.open);
  }

  const byCustomer = new Map<string, AllocationInvoice[]>();
  for (const invoice of allocationInvoices) {
    const list = byCustomer.get(invoice.customer) ?? [];
    list.push(invoice);
    byCustomer.set(invoice.customer, list);
  }

  const appliedPayments = payments
    .filter((payment) => !isVoidPayment(payment) && isAppliedPayment(payment))
    .map((payment) => ({
      customer: normalizeCustomer(payment.customer),
      date: parseTransactionDate(payment.date),
      amount: Math.abs(payment.amount),
    }))
    .filter((payment) => payment.customer && payment.date && payment.amount > 0)
    .sort((a, b) => a.date!.getTime() - b.date!.getTime());

  for (const payment of appliedPayments) {
    const invoicesForCustomer = byCustomer.get(payment.customer);
    if (!invoicesForCustomer) continue;

    let remaining = applyPaymentToInvoices(
      invoicesForCustomer,
      payment.amount,
      payment.date!,
      false,
    );
    if (remaining > 0) {
      remaining = applyPaymentToInvoices(
        invoicesForCustomer,
        remaining,
        payment.date!,
        true,
      );
    }
    void remaining;
  }

  for (const invoice of allocationInvoices) {
    openById.set(invoice.id, invoice.paid ? 0 : invoice.open);
  }

  return openById;
}

export function invoiceOpenBalance(
  invoice: InvoiceOpenBalanceRow,
  openBalances: ReadonlyMap<string, number>,
): number {
  if (isPaidInvoiceStatus(invoice.qbStatus)) return 0;
  return openBalances.get(invoice.id) ?? Math.abs(invoice.amount);
}

export function isInvoiceDateInLookback(
  date: string,
  lookbackDays: number,
  asOf: Date,
): boolean {
  const parsed = parseTransactionDate(date);
  if (!parsed) return false;
  const to = startOfDay(asOf);
  const from = new Date(to);
  from.setDate(from.getDate() - lookbackDays);
  return isDateInRange(parsed, { from: startOfDay(from), to });
}
