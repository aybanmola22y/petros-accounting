import { parseTransactionDate } from "@/lib/ledger/date-utils";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import {
  computeInvoiceOpenBalances,
  invoiceOpenBalance,
  type InvoiceOpenBalanceRow,
  type PaymentAllocationRow,
} from "@/lib/ledger/invoice-open-balance";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import type { InvoiceKind, MockCustomer, MockInvoice, MockInvoiceLine } from "@/lib/mock-data/types";

/**
 * Match key between an imported invoice-line reference and a sales transaction number.
 * QuickBooks exports the same invoice with inconsistent zero-padding ("1001" vs "01001"),
 * so compare on digits with leading zeros stripped.
 */
export function normalizeInvoiceRef(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  return digits || trimmed.toLowerCase();
}

/** Group imported invoice lines by their normalized reference number. */
export function indexInvoiceLinesByRef(
  linesByReference: Record<string, MockInvoiceLine[]> | undefined,
): Map<string, MockInvoiceLine[]> {
  const map = new Map<string, MockInvoiceLine[]>();
  if (!linesByReference) return map;
  for (const [reference, lines] of Object.entries(linesByReference)) {
    const key = normalizeInvoiceRef(reference);
    if (!key || lines.length === 0) continue;
    const existing = map.get(key);
    if (existing) existing.push(...lines);
    else map.set(key, [...lines]);
  }
  return map;
}

function qbStatus(txn: MockSalesTransaction): string {
  return txn.qbStatus?.trim().toLowerCase() ?? "";
}

function isVoidSalesInvoice(txn: MockSalesTransaction): boolean {
  const status = qbStatus(txn);
  const memo = txn.memo.trim().toLowerCase();
  return status === "void" || memo.includes("void");
}

function parseOverdueDays(detail: string | undefined): number | undefined {
  const match = detail?.match(/(\d+)\s*day/i);
  return match ? Number(match[1]) : undefined;
}

function estimateOverdueDays(txn: MockSalesTransaction, asOf = dashboardLedgerAnchor()): number {
  const fromDetail =
    txn.status.kind === "overdue" ? parseOverdueDays(txn.status.detail) : undefined;
  if (fromDetail != null) return fromDetail;

  const invoiceDate = parseTransactionDate(txn.date);
  if (!invoiceDate) return 1;
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 14);
  const diffMs = asOf.getTime() - dueDate.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function resolveCustomerIdForName(
  name: string,
  customers: readonly MockCustomer[],
): string {
  const trimmed = name.trim();
  if (!trimmed) return "import:Unknown customer";
  const match = customers.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (match) return match.id;
  return `import:${trimmed}`;
}

function salesInvoiceKind(txn: MockSalesTransaction): InvoiceKind {
  const status = qbStatus(txn);
  if (status === "paid" || status === "closed") return "paid";
  if (status === "partial") return "partial";
  if (status === "open") return "open";
  if (status === "overdue" || status === "expired") return "overdue";
  if (txn.status.kind === "closed") return "paid";
  if (txn.status.kind === "overdue") return "overdue";
  return "open";
}

function paidInvoiceTimeline(date: string, deposited = true) {
  const parsed = parseTransactionDate(date);
  const paidAt = parsed?.toISOString() ?? new Date().toISOString();
  return deposited
    ? { openedAt: paidAt, paidAt, depositedAt: paidAt }
    : { openedAt: paidAt, paidAt };
}

export function salesTransactionOpenBalances(
  transactions: readonly MockSalesTransaction[],
): Map<string, number> {
  const invoiceRows: InvoiceOpenBalanceRow[] = [];
  const paymentRows: PaymentAllocationRow[] = [];

  for (const txn of transactions) {
    if (isVoidSalesInvoice(txn)) continue;
    if (txn.type === "Invoice") {
      invoiceRows.push({
        id: txn.id,
        date: txn.date,
        customer: txn.customer,
        amount: txn.amount,
        qbStatus: qbStatus(txn),
      });
    } else if (txn.type === "Payment") {
      paymentRows.push({
        date: txn.date,
        customer: txn.customer,
        amount: txn.amount,
        qbStatus: qbStatus(txn),
        memo: txn.memo,
      });
    }
  }

  return computeInvoiceOpenBalances(invoiceRows, paymentRows);
}

/** Invoice rows derived from QuickBooks sales transaction import (Type = Invoice). */
export function invoicesFromSalesTransactions(
  transactions: readonly MockSalesTransaction[],
  customers: readonly MockCustomer[] = [],
  asOf = dashboardLedgerAnchor(),
  linesByNumber?: Map<string, MockInvoiceLine[]>,
): MockInvoice[] {
  const openBalances = salesTransactionOpenBalances(transactions);

  return transactions
    .filter((txn) => txn.type === "Invoice" && !isVoidSalesInvoice(txn))
    .map((txn) => {
      const kind = salesInvoiceKind(txn);
      const amount = Math.abs(txn.amount);
      const balanceDue =
        kind === "paid"
          ? 0
          : invoiceOpenBalance(
              {
                id: txn.id,
                date: txn.date,
                customer: txn.customer,
                amount: txn.amount,
                qbStatus: qbStatus(txn),
              },
              openBalances,
            );
      const customerId = resolveCustomerIdForName(txn.customer, customers);

      const description = txn.memo?.trim() ?? "";

      const importedLines = linesByNumber?.get(normalizeInvoiceRef(txn.number));
      const lines: MockInvoiceLine[] =
        importedLines && importedLines.length > 0
          ? importedLines.map((line, index) => ({
              id: `${txn.id}-line-${index + 1}`,
              serviceDate: line.serviceDate || txn.date,
              productService: line.productService,
              sku: line.sku,
              description: line.description || description,
              qty: line.qty,
              rate: line.rate,
              className: line.className,
            }))
          : [
              {
                id: `${txn.id}-line-1`,
                serviceDate: txn.date,
                productService: txn.incomeAccount?.trim() || "",
                sku: "",
                description,
                qty: 1,
                rate: amount,
                className: "",
              },
            ];

      const invoice: MockInvoice = {
        id: txn.id,
        date: txn.date,
        number: txn.number,
        customerId,
        amount,
        balanceDue,
        kind,
        lines,
      };

      if (kind === "paid") {
        invoice.statusTimeline = paidInvoiceTimeline(txn.date, true);
      } else if (kind === "overdue") {
        invoice.overdueDays = estimateOverdueDays(txn, asOf);
        if (txn.status.kind === "overdue" && txn.status.detail) {
          invoice.statusSub = txn.status.detail;
        }
      } else if (kind === "partial") {
        invoice.statusSub =
          txn.status.kind === "overdue" && txn.status.detail
            ? txn.status.detail
            : "Partially paid";
      }

      return invoice;
    });
}

/** Merge UI-created invoices with invoices derived from sales import.
 * Sales import wins on invoice number. Blank numbers never collide.
 */
export function mergeInvoicesForReceivables(
  storeInvoices: readonly MockInvoice[],
  salesInvoices: readonly MockInvoice[],
): MockInvoice[] {
  if (salesInvoices.length === 0) return [...storeInvoices];

  const byId = new Map<string, MockInvoice>();
  for (const invoice of salesInvoices) {
    byId.set(invoice.id, invoice);
  }

  const salesNumbers = new Set(
    salesInvoices
      .map((invoice) => normalizeInvoiceRef(invoice.number))
      .filter((key) => key.length > 0),
  );

  for (const invoice of storeInvoices) {
    if (byId.has(invoice.id)) continue;
    const key = normalizeInvoiceRef(invoice.number);
    // Prefer the imported sales row when the same invoice number exists.
    if (key && salesNumbers.has(key)) continue;
    byId.set(invoice.id, invoice);
  }

  return [...byId.values()];
}
