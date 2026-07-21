import { isInvoiceDeposited } from "@/lib/invoice-status";
import {
  formatTransactionDateDisplay,
  isDateInRange,
  parseTransactionDate,
} from "@/lib/ledger/date-utils";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import { isInvoiceDateInLookback } from "@/lib/ledger/invoice-open-balance";
import { startOfDay, type ReportDateRange } from "@/lib/report-date-utils";
import type {
  CustomerHubOverdue,
  CustomerWithBalance,
  MockCustomer,
  MockInvoice,
  OverdueInvoiceRow,
  PipelineMetric,
  ReceivablesKpiSegment,
  ReceivablesSummary,
} from "./types";

export function getAllInvoices(invoices: MockInvoice[] = getInvoiceRecords()): MockInvoice[] {
  return invoices;
}

export function getInvoiceRecords(
  unpaid: MockInvoice[] = [],
  paid: MockInvoice[] = [],
): MockInvoice[] {
  return [...unpaid, ...paid];
}

export const INVOICE_UNPAID_LOOKBACK_DAYS = 365;
/** QuickBooks Customer Hub unpaid funnel uses a slightly longer window (~385d). */
export const CUSTOMER_HUB_UNPAID_LOOKBACK_DAYS = 385;
export const INVOICE_PAID_LOOKBACK_DAYS = 30;

function lookbackRange(asOf: Date, days: number): ReportDateRange {
  const to = startOfDay(asOf);
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from: startOfDay(from), to };
}

function activeInvoices(invoices: MockInvoice[]): MockInvoice[] {
  return invoices.filter((invoice) => !invoice.voided);
}

function invoiceTransactionDate(invoice: MockInvoice): Date | null {
  return parseTransactionDate(invoice.date);
}

function invoicePaidDate(invoice: MockInvoice): Date | null {
  const paidAt = invoice.statusTimeline?.paidAt;
  if (paidAt) {
    const parsed = new Date(paidAt);
    if (!Number.isNaN(parsed.getTime())) return startOfDay(parsed);
  }
  return invoiceTransactionDate(invoice);
}

export function computeReceivablesSummary(
  invoices: MockInvoice[] = getInvoiceRecords(),
  asOf = dashboardLedgerAnchor(),
): ReceivablesSummary {
  const active = activeInvoices(invoices);
  const unpaidRange = lookbackRange(asOf, INVOICE_UNPAID_LOOKBACK_DAYS);
  const paidRange = lookbackRange(asOf, INVOICE_PAID_LOOKBACK_DAYS);

  const unpaid = active.filter((invoice) => {
    if (invoice.kind === "paid") return false;
    const date = invoiceTransactionDate(invoice);
    return date ? isDateInRange(date, unpaidRange) : false;
  });
  const overdue = unpaid.filter((invoice) => invoice.kind === "overdue");
  const notDue = unpaid.filter(
    (invoice) => invoice.kind === "open" || invoice.kind === "partial",
  );
  const paid = active.filter((invoice) => {
    if (invoice.kind !== "paid") return false;
    const paidOn = invoicePaidDate(invoice);
    return paidOn ? isDateInRange(paidOn, paidRange) : false;
  });

  const overdueAmount = overdue.reduce((s, i) => s + i.balanceDue, 0);
  const notDueYet = notDue.reduce((s, i) => s + i.balanceDue, 0);
  const unpaidTotal = unpaid.reduce((s, i) => s + i.balanceDue, 0);
  const paidTotal = paid.reduce((s, i) => s + i.amount, 0);
  let deposited = 0;
  let notDeposited = 0;
  for (const inv of paid) {
    if (isInvoiceDeposited(inv)) deposited += inv.amount;
    else notDeposited += inv.amount;
  }

  return {
    unpaidTotal,
    overdueAmount,
    notDueYet,
    overdueCount: overdue.length,
    unpaidCount: unpaid.length,
    paidTotal,
    paidCount: paid.length,
    notDeposited,
    deposited,
    estimatesAmount: 0,
    estimatesCount: 0,
    unbilledIncome: 0,
  };
}

export function computeCustomerBalances(
  customers: MockCustomer[],
  invoices: MockInvoice[] = getInvoiceRecords(),
): CustomerWithBalance[] {
  const balanceByCustomerId = new Map<string, number>();
  const balanceByCustomerName = new Map<string, number>();

  for (const inv of invoices) {
    if (inv.kind === "paid") continue;
    balanceByCustomerId.set(
      inv.customerId,
      (balanceByCustomerId.get(inv.customerId) ?? 0) + inv.balanceDue,
    );
    const importName = inv.customerId.startsWith("import:")
      ? inv.customerId.slice("import:".length).toLowerCase()
      : null;
    if (importName) {
      balanceByCustomerName.set(
        importName,
        (balanceByCustomerName.get(importName) ?? 0) + inv.balanceDue,
      );
    }
  }

  return customers.map((c) => {
    const fromInvoices =
      balanceByCustomerId.get(c.id) ??
      balanceByCustomerName.get(c.name.trim().toLowerCase()) ??
      0;
    const openBalance = fromInvoices > 0 ? fromInvoices : (c.openBalance ?? 0);
    return {
      ...c,
      openBalance,
      action: openBalance > 0 ? ("payment" as const) : ("invoice" as const),
    };
  });
}

export function getCustomerName(
  customerId: string,
  customers: MockCustomer[] = [],
  customerName?: string,
): string {
  const explicit = customerName?.trim();
  if (explicit && explicit.toLowerCase() !== "unknown customer") return explicit;
  const id = customerId?.trim() ?? "";
  if (id.startsWith("import:")) {
    const name = id.slice("import:".length).trim();
    if (name && name.toLowerCase() !== "unknown customer") return name;
  }
  if (id) {
    const match = customers.find((c) => c.id === id)?.name?.trim();
    if (match) return match;
  }
  return "Unknown customer";
}

export function getOverdueInvoiceRows(
  invoices: MockInvoice[] = getInvoiceRecords(),
  customers: MockCustomer[] = [],
  limit = 4,
): OverdueInvoiceRow[] {
  return buildCustomerHubOverdueFromInvoices(invoices, customers, limit).rows;
}

export function buildCustomerHubOverdueFromInvoices(
  invoices: MockInvoice[] = getInvoiceRecords(),
  customers: MockCustomer[] = [],
  limit = 4,
  lookbackDays = CUSTOMER_HUB_UNPAID_LOOKBACK_DAYS,
  asOf = dashboardLedgerAnchor(),
): CustomerHubOverdue {
  const overdue = activeInvoices(invoices)
    .filter((invoice) => {
      if (invoice.kind !== "overdue") return false;
      return isInvoiceDateInLookback(invoice.date, lookbackDays, asOf);
    })
    .sort((a, b) => {
      const byDate =
        (parseTransactionDate(b.date)?.getTime() ?? 0) -
        (parseTransactionDate(a.date)?.getTime() ?? 0);
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
    });

  return {
    amount: overdue.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    count: overdue.length,
    rows: overdue.slice(0, limit).map((inv) => ({
      invoiceId: inv.id,
      client: getCustomerName(inv.customerId, customers, inv.customerName),
      date: formatTransactionDateDisplay(inv.date),
      amount: inv.balanceDue,
    })),
  };
}

export function computePipelineMetrics(summary: ReceivablesSummary): PipelineMetric[] {
  return [
    { id: "opportunities", value: 0 },
    { id: "estimates", value: summary.estimatesCount },
    { id: "contracts", value: 0 },
    { id: "projects", value: 0 },
    {
      id: "invoices",
      value: summary.unpaidCount,
      overdueCount: summary.overdueCount,
    },
    { id: "reviews", value: 0 },
  ];
}

export function buildReceivablesKpiSegments(summary: ReceivablesSummary): ReceivablesKpiSegment[] {
  return [
    {
      id: "estimates",
      amount: summary.estimatesAmount,
      count: summary.estimatesCount,
      label: "estimates",
      barClass: "bg-sky-400",
      textClass: "text-sky-700",
    },
    {
      id: "unbilled",
      amount: summary.unbilledIncome,
      count: 0,
      label: "Unbilled income",
      barClass: "bg-violet-500",
      textClass: "text-violet-700",
    },
    {
      id: "overdue",
      amount: summary.overdueAmount,
      count: summary.overdueCount,
      label: "overdue invoices",
      barClass: "bg-amber-500",
      textClass: "text-amber-700",
    },
    {
      id: "open",
      amount: summary.unpaidTotal,
      count: summary.unpaidCount,
      label: "open invoices and credits",
      barClass: "bg-muted-foreground/50",
      textClass: "text-foreground",
    },
    {
      id: "paid",
      amount: summary.paidTotal,
      count: summary.paidCount,
      label: "recently paid",
      barClass: "bg-emerald-500",
      textClass: "text-emerald-700",
    },
  ];
}

