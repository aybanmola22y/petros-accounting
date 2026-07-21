export type InvoiceKind = "overdue" | "open" | "partial" | "paid";

export type InvoiceStatusTimeline = {
  openedAt?: string;
  sentAt?: string;
  viewedAt?: string;
  viewCount?: number;
  viewHistory?: string[];
  paidAt?: string;
  depositedAt?: string;
};

export type CustomerProfile = {
  street1?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
};

export type MockCustomer = {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  currency: string;
  /** Imported AR balance from QuickBooks (used when no invoice linkage). */
  openBalance?: number;
  attachmentCount?: number;
  profile?: CustomerProfile;
};

export type MockLead = {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  source: string;
  email?: string;
  status?: string;
};

export type MockInvoiceLine = {
  id: string;
  serviceDate: string;
  productService: string;
  sku: string;
  description: string;
  qty: number;
  rate: number;
  className: string;
};

export type InvoiceAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
  addedAt: string;
};

export type MockInvoice = {
  id: string;
  date: string;
  number: string;
  customerId: string;
  /** Display name when customerId is missing / not a resolvable UUID (imported payees). */
  customerName?: string;
  amount: number;
  /** Outstanding balance (equals amount for open/overdue; less for partial). */
  balanceDue: number;
  kind: InvoiceKind;
  overdueDays?: number;
  statusSub?: string;
  statusTimeline?: InvoiceStatusTimeline;
  voided?: boolean;
  lines?: MockInvoiceLine[];
  attachments?: InvoiceAttachment[];
};

export type ReceivablesSummary = {
  unpaidTotal: number;
  overdueAmount: number;
  notDueYet: number;
  overdueCount: number;
  unpaidCount: number;
  paidTotal: number;
  paidCount: number;
  notDeposited: number;
  deposited: number;
  estimatesAmount: number;
  estimatesCount: number;
  unbilledIncome: number;
};

export type CustomerWithBalance = MockCustomer & {
  openBalance: number;
  action: "invoice" | "payment";
};

export type OverdueInvoiceRow = {
  client: string;
  date: string;
  amount: number;
  invoiceId: string;
};

/** Customer Hub overdue card — full overdue AR total and preview rows. */
export type CustomerHubOverdue = {
  amount: number;
  count: number;
  rows: OverdueInvoiceRow[];
};

export type ReceivablesKpiSegment = {
  id: string;
  amount: number;
  count: number;
  label: string;
  barClass: string;
  textClass: string;
};

export type PipelineMetric = {
  id: string;
  value: number;
  overdueCount?: number;
};

/** Cached view model returned by the mock store (stable reference per version). */
export type ReceivablesView = {
  summary: ReceivablesSummary;
  /** Customer Hub funnel — QuickBooks uses a longer unpaid lookback than sales KPIs. */
  customerHubSummary: ReceivablesSummary;
  kpiSegments: ReceivablesKpiSegment[];
  pipeline: PipelineMetric[];
  /** Customer Hub overdue card — all overdue balances (no lookback). */
  customerHubOverdue: CustomerHubOverdue;
  customers: CustomerWithBalance[];
  leads: MockLead[];
  invoices: MockInvoice[];
};
