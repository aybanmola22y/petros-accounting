import { computeInvoiceSummaryFromSalesTransactions, computeCustomerHubOverdue } from "@/lib/ledger/compute-invoice-summary";
import { computeSalesTransactionKpiSummary } from "@/lib/ledger/compute-sales-transaction-kpi";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import { buildDisplayInvoiceList } from "./adapters";
import type { InvoiceViewRow } from "./adapters";
import {
  buildReceivablesKpiSegments,
  buildCustomerHubOverdueFromInvoices,
  computeCustomerBalances,
  computePipelineMetrics,
  computeReceivablesSummary,
  CUSTOMER_HUB_UNPAID_LOOKBACK_DAYS,
  getAllInvoices,
  getCustomerName,
  getInvoiceRecords,
} from "./compute";
import type { MockBankAccount } from "./bank-accounts";
import {
  mergeChartAccountsWithBankBalances,
  type MockChartAccount,
} from "./chart-of-accounts";
import type { MockExpenseCategory } from "./expense-categories";
import {
  chartAccountsToExpenseCategories,
  mergeExpenseCategories,
} from "./expense-categories";
import {
  type CreateProductServiceInput,
  type MockProductService,
  productServiceFromCreateInput,
} from "./products-services";
import { buildSeedLocations, type MockLocation } from "./locations";
import { buildSeedPaymentMethods, type MockPaymentMethod } from "./payment-methods";
import type { MockProductItemCategory } from "./product-item-categories";
import type { MockProductItemClass } from "./product-item-classes";
import type { MockSupplier, SupplierProfile } from "./suppliers";
import type { PaidBill } from "./paid-bills";
import type { UnpaidBill } from "./unpaid-bills";
import { resolveSupplierOpenBalance } from "./unpaid-bills";
import { applyComputedLedgerBalances } from "@/lib/ledger";
import {
  indexInvoiceLinesByRef,
  invoicesFromSalesTransactions,
  mergeInvoicesForReceivables,
} from "@/lib/ledger/invoices-from-sales-transactions";
import { buildDashboardSummary, type DashboardSummary } from "./dashboard";
import type { MockExpenseTransaction } from "./expenses";
import type { MockSalesTransaction } from "./sales";
import type { MockRecurringTemplate, RecurringTransactionType } from "./recurring-transactions";
import type {
  MockCustomer,
  MockInvoice,
  MockInvoiceLine,
  MockLead,
  ReceivablesView,
} from "./types";
import { createEmptySnapshot, type MockStoreSnapshot } from "./empty-snapshot";
import {
  clearPersistedSnapshot,
  loadPersistedSnapshot,
  persistSnapshot,
  schedulePersistSnapshot,
} from "./store-persistence";
import {
  SEED_PAID_INVOICES,
  SEED_UNPAID_INVOICES,
} from "./seeds";

type Snapshot = MockStoreSnapshot;

/**
 * Reference picklists (payment methods, locations) are not transactional demo
 * data, so they are always seeded. Keeps the QuickBooks-import flow clean while
 * still giving the expense/bill forms their standard dropdown choices.
 */
function seedReferenceLists(data: Snapshot): Snapshot {
  return {
    ...data,
    paymentMethods: data.paymentMethods.length > 0 ? data.paymentMethods : buildSeedPaymentMethods(),
    locations: data.locations.length > 0 ? data.locations : buildSeedLocations(),
  };
}

function createInitialSnapshot(): Snapshot {
  const base = seedReferenceLists(createEmptySnapshot());
  return {
    ...base,
    // Customers and leads are real Supabase data (QuickBooks exports),
    // so do not prefill seed rows here.
    customers: [],
    leads: [],
    unpaidInvoices: [...SEED_UNPAID_INVOICES],
    paidInvoices: [...SEED_PAID_INVOICES],
  };
}

/** Remove bills that were auto-derived from expense import rows (not real AP data). */
function stripExpenseDerivedBills(data: Snapshot): Snapshot {
  const billIds = new Set(
    data.expenses
      .filter((e) => e.type.trim().toLowerCase() === "bill")
      .map((e) => e.id),
  );
  const paymentIds = new Set(
    data.expenses
      .filter((e) => e.type.toLowerCase().includes("bill payment"))
      .map((e) => e.id),
  );
  const unpaidBills = data.unpaidBills.filter((b) => !billIds.has(b.id));
  const paidBills = data.paidBills.filter((b) => !paymentIds.has(b.id));
  if (
    unpaidBills.length === data.unpaidBills.length &&
    paidBills.length === data.paidBills.length
  ) {
    return data;
  }
  return { ...data, unpaidBills, paidBills };
}

let snapshot: Snapshot = createInitialSnapshot();
let persistenceHydrated = false;

/** Load browser-persisted data after hydration so SSR and first client paint match. */
export function hydrateStoreFromPersistence() {
  if (typeof window === "undefined" || persistenceHydrated) return;
  persistenceHydrated = true;

  const persisted = loadPersistedSnapshot();
  if (!persisted) return;

  const cleaned = stripExpenseDerivedBills(
    seedReferenceLists({
      ...createEmptySnapshot(),
      ...persisted,
      leads: persisted.leads ?? [],
    }),
  );
  snapshot = cleaned;
  if (
    cleaned.unpaidBills.length !== persisted.unpaidBills.length ||
    cleaned.paidBills.length !== persisted.paidBills.length
  ) {
    persistSnapshot(cleaned);
  }
  emit();
}

const listeners = new Set<() => void>();

let cachedReceivablesView: ReceivablesView | null = null;
let cachedReceivablesVersion = -1;

let cachedDisplayInvoices: InvoiceViewRow[] | null = null;
let cachedDisplayInvoicesVersion = -1;

let cachedDashboard: DashboardSummary | null = null;
let cachedDashboardVersion = -1;

let cachedChartAccounts: MockChartAccount[] | null = null;
let cachedChartAccountsVersion = -1;

let cachedPaymentMethods: MockPaymentMethod[] | null = null;
let cachedPaymentMethodsVersion = -1;

let cachedLocations: MockLocation[] | null = null;
let cachedLocationsVersion = -1;

let cachedExpenseCategories: MockExpenseCategory[] | null = null;
let cachedExpenseCategoriesVersion = -1;

let cachedProductServices: MockProductService[] | null = null;
let cachedProductServicesVersion = -1;

let cachedProductItemCategories: MockProductItemCategory[] | null = null;
let cachedProductItemCategoriesVersion = -1;

let cachedProductItemClasses: MockProductItemClass[] | null = null;
let cachedProductItemClassesVersion = -1;

let cachedSuppliers: MockSupplier[] | null = null;
let cachedSuppliersVersion = -1;

let cachedUnpaidBills: UnpaidBill[] | null = null;
let cachedUnpaidBillsVersion = -1;

let cachedPaidBills: PaidBill[] | null = null;
let cachedPaidBillsVersion = -1;

let storeBatchDepth = 0;
let storeBatchDirty = false;

/** Coalesce multiple store writes into one subscriber notification. */
export function beginStoreBatch() {
  storeBatchDepth += 1;
}

export function endStoreBatch() {
  storeBatchDepth = Math.max(0, storeBatchDepth - 1);
  if (storeBatchDepth === 0 && storeBatchDirty) {
    storeBatchDirty = false;
    schedulePersistSnapshot(snapshot);
    listeners.forEach((listener) => listener());
  }
}

function emit() {
  snapshot = { ...snapshot, version: snapshot.version + 1 };
  if (storeBatchDepth > 0) {
    storeBatchDirty = true;
    return;
  }
  schedulePersistSnapshot(snapshot);
  listeners.forEach((listener) => listener());
}

export function subscribeMockStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMockStoreVersion() {
  return snapshot.version;
}

function currentInvoices() {
  return invoicesForSnapshot(snapshot);
}

function invoicesForSnapshot(snap: Snapshot) {
  const storeInvoices = getInvoiceRecords(snap.unpaidInvoices, snap.paidInvoices);
  const salesInvoices = invoicesFromSalesTransactions(
    snap.salesTransactions ?? [],
    snap.customers,
    dashboardLedgerAnchor(),
    indexInvoiceLinesByRef(snap.salesTransactionLines),
  );
  return mergeInvoicesForReceivables(storeInvoices, salesInvoices);
}

function buildReceivablesViewFromSnapshot(snap: Snapshot): ReceivablesView {
  const salesTransactions = snap.salesTransactions ?? [];
  const invoices = invoicesForSnapshot(snap);
  const asOf = dashboardLedgerAnchor();
  const summary =
    salesTransactions.length > 0
      ? computeInvoiceSummaryFromSalesTransactions(salesTransactions, asOf)
      : computeReceivablesSummary(invoices, asOf);

  const customerHubSummary =
    salesTransactions.length > 0
      ? computeInvoiceSummaryFromSalesTransactions(
          salesTransactions,
          asOf,
          CUSTOMER_HUB_UNPAID_LOOKBACK_DAYS,
        )
      : summary;

  const kpiSegments =
    salesTransactions.length > 0
      ? computeSalesTransactionKpiSummary(salesTransactions, asOf).segments.map(
          ({ id, amount, count, label, barClass, textClass }) => ({
            id,
            amount,
            count,
            label,
            barClass,
            textClass,
          }),
        )
      : buildReceivablesKpiSegments(summary);

  const customerHubOverdue =
    salesTransactions.length > 0
      ? computeCustomerHubOverdue(salesTransactions)
      : buildCustomerHubOverdueFromInvoices(invoices, snap.customers);

  return {
    summary,
    customerHubSummary,
    kpiSegments,
    pipeline: computePipelineMetrics(customerHubSummary),
    customerHubOverdue,
    customers: computeCustomerBalances(snap.customers, invoices),
    leads: [...snap.leads],
    invoices,
  };
}

function buildReceivablesView(): ReceivablesView {
  return buildReceivablesViewFromSnapshot(snapshot);
}

let cachedServerReceivablesView: ReceivablesView | null = null;

/** Stable receivables view from seed data only — used as the SSR snapshot for useSyncExternalStore. */
export function getServerReceivablesSnapshot(): ReceivablesView {
  if (!cachedServerReceivablesView) {
    cachedServerReceivablesView = buildReceivablesViewFromSnapshot(createInitialSnapshot());
  }
  return cachedServerReceivablesView;
}

/** Stable snapshot for useSyncExternalStore â€” same reference until store version changes. */
export function getReceivablesSnapshot(): ReceivablesView {
  if (cachedReceivablesView && cachedReceivablesVersion === snapshot.version) {
    return cachedReceivablesView;
  }
  cachedReceivablesVersion = snapshot.version;
  cachedReceivablesView = buildReceivablesView();
  return cachedReceivablesView;
}

/** Stable invoice list for useSyncExternalStore. */
export function getDisplayInvoicesSnapshot(): InvoiceViewRow[] {
  if (cachedDisplayInvoices && cachedDisplayInvoicesVersion === snapshot.version) {
    return cachedDisplayInvoices;
  }
  cachedDisplayInvoicesVersion = snapshot.version;
  cachedDisplayInvoices = buildDisplayInvoiceList(
    getAllInvoices(currentInvoices()),
    snapshot.customers,
  );
  return cachedDisplayInvoices;
}

export function addCustomer(input: {
  name: string;
  companyName: string;
  phone: string;
  currency: string;
  email?: string;
}): string {
  const id = `c-${Date.now()}`;
  snapshot.customers.push({
    id,
    name: input.name,
    companyName: input.companyName || "None",
    phone: input.phone,
    currency: input.currency,
    email: input.email,
  });
  emit();
  return id;
}

let cachedMaxInvoiceNumber: number | null = null;

function parseInvoiceNumber(number: string): number | null {
  const n = parseInt(number.replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function recomputeMaxInvoiceNumber(): number {
  let max = 0;
  for (const inv of currentInvoices()) {
    const n = parseInvoiceNumber(inv.number);
    if (n !== null && n > max) max = n;
  }
  return max;
}

function touchMaxInvoiceNumber(number: string) {
  const n = parseInvoiceNumber(number);
  if (n === null) return;
  cachedMaxInvoiceNumber =
    cachedMaxInvoiceNumber === null ? n : Math.max(cachedMaxInvoiceNumber, n);
}

function invalidateMaxInvoiceNumber() {
  cachedMaxInvoiceNumber = null;
}

export function getNextInvoiceNumber(): string {
  if (cachedMaxInvoiceNumber === null) {
    cachedMaxInvoiceNumber = recomputeMaxInvoiceNumber();
  }
  return String(cachedMaxInvoiceNumber + 1);
}

export function addInvoice(input: {
  customerId: string;
  number: string;
  date: string;
  amount: number;
  balanceDue?: number;
  kind?: MockInvoice["kind"];
  statusTimeline?: MockInvoice["statusTimeline"];
  statusSub?: string;
  lines?: MockInvoice["lines"];
}) {
  const balanceDue = input.balanceDue ?? input.amount;
  snapshot.unpaidInvoices.push({
    id: `inv-${Date.now()}`,
    number: input.number,
    date: input.date,
    customerId: input.customerId,
    amount: input.amount,
    balanceDue,
    kind: input.kind ?? "open",
    statusTimeline: input.statusTimeline,
    statusSub: input.statusSub,
    ...(input.lines?.length ? { lines: input.lines } : {}),
  });
  touchMaxInvoiceNumber(input.number);
  emit();
}

export function getInvoiceById(id: string): MockInvoice | undefined {
  return currentInvoices().find((inv) => inv.id === id);
}

export function updateInvoice(
  id: string,
  patch: Partial<Omit<MockInvoice, "id">>,
): boolean {
  const apply = (list: MockInvoice[]) => {
    const index = list.findIndex((inv) => inv.id === id);
    if (index === -1) return false;
    list[index] = { ...list[index], ...patch };
    return true;
  };
  if (apply(snapshot.unpaidInvoices) || apply(snapshot.paidInvoices)) {
    if (patch.number !== undefined) invalidateMaxInvoiceNumber();
    emit();
    return true;
  }
  return false;
}

export function deleteInvoice(id: string): boolean {
  const remove = (list: MockInvoice[]) => {
    const index = list.findIndex((inv) => inv.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    return true;
  };
  if (remove(snapshot.unpaidInvoices) || remove(snapshot.paidInvoices)) {
    invalidateMaxInvoiceNumber();
    emit();
    return true;
  }
  return false;
}

export function voidInvoice(id: string): boolean {
  return updateInvoice(id, { voided: true, balanceDue: 0 });
}

export function findSalesTransactionForInvoice(invoice: MockInvoice, customerName: string) {
  const formatted = /^INV-/i.test(invoice.number.trim())
    ? invoice.number.trim()
    : `INV-${invoice.number.trim()}`;
  const digits = invoice.number.replace(/\D/g, "");
  return (snapshot.salesTransactions ?? []).find(
    (t) =>
      t.type === "Invoice" &&
      t.customer === customerName &&
      (t.number === formatted ||
        t.number.replace(/\D/g, "") === digits ||
        t.number === invoice.number),
  );
}

export type RecurringInvoiceSchedule = {
  id: string;
  customerId: string;
  invoiceNumber: string;
  amount: number;
  frequency: "Weekly" | "Monthly" | "Quarterly" | "Yearly";
  nextDate: string;
  createdAt: string;
};

let recurringInvoiceSchedules: RecurringInvoiceSchedule[] = [];

export function addRecurringInvoiceSchedule(input: Omit<RecurringInvoiceSchedule, "id" | "createdAt">) {
  recurringInvoiceSchedules.push({
    ...input,
    id: `rec-inv-${Date.now()}`,
    createdAt: new Date().toISOString(),
  });
  emit();
  return recurringInvoiceSchedules[recurringInvoiceSchedules.length - 1];
}

export function getRecurringInvoiceSchedules() {
  return [...recurringInvoiceSchedules];
}

export function getRecurringTemplatesSnapshot(): MockRecurringTemplate[] {
  return snapshot.recurringTemplates;
}

export function addRecurringTemplate(
  input: Omit<MockRecurringTemplate, "id"> & { id?: string },
) {
  const row: MockRecurringTemplate = {
    ...input,
    id: input.id ?? `rt-${Date.now()}`,
  };
  snapshot.recurringTemplates = [...snapshot.recurringTemplates, row];
  emit();
  return row;
}

export function deleteRecurringTemplate(id: string) {
  snapshot.recurringTemplates = snapshot.recurringTemplates.filter((t) => t.id !== id);
  emit();
}

export function replaceRecurringTemplatesInStore(templates: MockRecurringTemplate[]) {
  snapshot.recurringTemplates = templates.map((template) => ({ ...template }));
  emit();
}

export function updateRecurringTemplate(id: string, patch: Partial<MockRecurringTemplate>) {
  snapshot.recurringTemplates = snapshot.recurringTemplates.map((template) =>
    template.id === id ? { ...template, ...patch } : template,
  );
  emit();
}

/** Stable dashboard snapshot for useSyncExternalStore / React Query. */
export function getDashboardSnapshot(): DashboardSummary {
  if (cachedDashboard && cachedDashboardVersion === snapshot.version) {
    return cachedDashboard;
  }
  const receivables = getReceivablesSnapshot();
  cachedDashboardVersion = snapshot.version;
  cachedDashboard = buildDashboardSummary(
    receivables.summary,
    receivables.invoices.filter((i) => i.kind === "paid"),
    snapshot.bankAccounts,
    snapshot.expenses,
    snapshot.salesTransactions ?? [],
    snapshot.chartAccounts,
    snapshot.unpaidBills,
    snapshot.expenseCategories,
  );
  return cachedDashboard;
}

export function getSalesTransactionsSnapshot(): MockSalesTransaction[] {
  return snapshot.salesTransactions;
}

export function addSalesTransaction(input: Omit<MockSalesTransaction, "id">) {
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  snapshot.salesTransactions = [
    { ...input, id: `st-${Date.now()}`, recordedAt },
    ...(snapshot.salesTransactions ?? []),
  ];
  emit();
}

/** Insert or replace a sales transaction that already has a server id. */
export function upsertSalesTransactionInStore(txn: MockSalesTransaction) {
  const index = snapshot.salesTransactions.findIndex((t) => t.id === txn.id);
  if (index === -1) {
    snapshot.salesTransactions = [txn, ...(snapshot.salesTransactions ?? [])];
  } else {
    const next = [...snapshot.salesTransactions];
    next[index] = txn;
    snapshot.salesTransactions = next;
  }
  emit();
}

export function updateSalesTransaction(
  id: string,
  patch: Partial<Omit<MockSalesTransaction, "id">>,
) {
  const index = snapshot.salesTransactions.findIndex((t) => t.id === id);
  if (index === -1) return false;
  const next = [...snapshot.salesTransactions];
  next[index] = { ...next[index], ...patch };
  snapshot.salesTransactions = next;
  emit();
  return true;
}

export function deleteSalesTransactions(ids: string[]) {
  const drop = new Set(ids);
  snapshot.salesTransactions = snapshot.salesTransactions.filter((t) => !drop.has(t.id));
  emit();
}

export function getExpensesSnapshot(): MockExpenseTransaction[] {
  return snapshot.expenses;
}

let cachedMaxExpenseNumber: number | null = null;

function parseExpenseNumber(number: string): number | null {
  const n = parseInt(number.replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function recomputeMaxExpenseNumber(): number {
  let max = 0;
  for (const e of snapshot.expenses) {
    const n = parseExpenseNumber(e.number);
    if (n !== null && n > max) max = n;
  }
  return max;
}

function touchMaxExpenseNumber(number: string) {
  const n = parseExpenseNumber(number);
  if (n === null) return;
  cachedMaxExpenseNumber =
    cachedMaxExpenseNumber === null ? n : Math.max(cachedMaxExpenseNumber, n);
}

function invalidateMaxExpenseNumber() {
  cachedMaxExpenseNumber = null;
}

export function getNextExpenseNumber(): string {
  if (cachedMaxExpenseNumber === null) {
    cachedMaxExpenseNumber = recomputeMaxExpenseNumber();
  }
  return String(cachedMaxExpenseNumber + 1);
}

export function getNextPaymentNumber(): string {
  let max = 0;
  for (const t of snapshot.salesTransactions ?? []) {
    if (t.type !== "Payment") continue;
    const n = parseInt(t.number.replace(/\D/g, ""), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `PMT-${max + 1}`;
}

export function addExpense(input: Omit<MockExpenseTransaction, "id">) {
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  snapshot.expenses.unshift({
    ...input,
    id: `exp-${Date.now()}`,
    recordedAt,
  });
  touchMaxExpenseNumber(input.number);
  emit();
}

/** Insert or replace an expense that already has a server id. */
export function upsertExpenseInStore(expense: MockExpenseTransaction) {
  const index = snapshot.expenses.findIndex((e) => e.id === expense.id);
  if (index === -1) {
    snapshot.expenses = [expense, ...snapshot.expenses];
  } else {
    const next = [...snapshot.expenses];
    next[index] = expense;
    snapshot.expenses = next;
  }
  touchMaxExpenseNumber(expense.number);
  emit();
}

export function updateExpense(id: string, patch: Partial<MockExpenseTransaction>) {
  snapshot.expenses = snapshot.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e));
  if (patch.number !== undefined) invalidateMaxExpenseNumber();
  emit();
}

export function deleteExpenses(ids: string[]) {
  const drop = new Set(ids);
  snapshot.expenses = snapshot.expenses.filter((e) => !drop.has(e.id));
  invalidateMaxExpenseNumber();
  emit();
}

/** Connected bank accounts with live feed balances. */
export function getBankAccountsSnapshot(): MockBankAccount[] {
  return snapshot.bankAccounts;
}

export function setBankAccountBalance(id: string, bankBalance: number) {
  snapshot.bankAccounts = snapshot.bankAccounts.map((a) =>
    a.id === id ? { ...a, bankBalance } : a,
  );
  emit();
}

export function refreshAllBankAccountBalances(
  updates: { id: string; bankBalance: number }[],
) {
  const byId = Object.fromEntries(updates.map((u) => [u.id, u.bankBalance]));
  snapshot.bankAccounts = snapshot.bankAccounts.map((a) =>
    byId[a.id] !== undefined ? { ...a, bankBalance: byId[a.id]! } : a,
  );
  emit();
}

/** Stable chart-of-accounts snapshot for useSyncExternalStore. */
export function getChartAccountsSnapshot(): MockChartAccount[] {
  if (cachedChartAccounts && cachedChartAccountsVersion === snapshot.version) {
    return cachedChartAccounts;
  }
  cachedChartAccountsVersion = snapshot.version;
  cachedChartAccounts = mergeChartAccountsWithBankBalances(
    applyComputedLedgerBalances(
      snapshot.chartAccounts,
      snapshot.salesTransactions ?? [],
      snapshot.expenses,
    ),
    snapshot.bankAccounts,
  );
  return cachedChartAccounts;
}

export function addChartAccount(
  input: Omit<MockChartAccount, "id"> & { id?: string },
) {
  snapshot.chartAccounts.push({
    ...input,
    id: input.id ?? `coa-${Date.now()}`,
  });
  emit();
}

export function updateChartAccount(id: string, patch: Partial<MockChartAccount>) {
  snapshot.chartAccounts = snapshot.chartAccounts.map((a) =>
    a.id === id ? { ...a, ...patch } : a,
  );
  emit();
}

export function updateChartAccounts(
  updater: (accounts: MockChartAccount[]) => MockChartAccount[],
) {
  snapshot.chartAccounts = updater(snapshot.chartAccounts);
  emit();
}

/** Replace in-memory chart accounts after loading from Supabase (ledger compatibility). */
export function replaceChartAccountsInStore(accounts: MockChartAccount[]) {
  snapshot.chartAccounts = accounts.map((account) => ({ ...account }));
  emit();
}

/** Replace in-memory expenses after loading from Supabase (ledger compatibility). */
export function replaceExpensesInStore(expenses: MockExpenseTransaction[]) {
  snapshot.expenses = expenses.map((expense) => ({ ...expense }));
  snapshot = stripExpenseDerivedBills(snapshot);
  invalidateMaxExpenseNumber();
  cachedExpenseCategoriesVersion = -1;
  emit();
}

/** Replace in-memory sales transactions after loading from Supabase. */
export function replaceSalesTransactionsInStore(transactions: MockSalesTransaction[]) {
  snapshot.salesTransactions = transactions.map((transaction) => ({ ...transaction }));
  // Sales import is the invoice list source of truth — drop demo seed invoices.
  if (transactions.some((txn) => txn.type === "Invoice")) {
    const seedId = /^(inv-|inv-p)/i;
    snapshot.unpaidInvoices = snapshot.unpaidInvoices.filter((invoice) => !seedId.test(invoice.id));
    snapshot.paidInvoices = snapshot.paidInvoices.filter((invoice) => !seedId.test(invoice.id));
  }
  invalidateMaxInvoiceNumber();
  emit();
}

/** Replace invoice line items (keyed by reference number) loaded from Supabase. */
export function replaceSalesTransactionLinesInStore(
  linesByReference: Record<string, MockInvoiceLine[]>,
) {
  snapshot.salesTransactionLines = linesByReference ?? {};
  emit();
}

export function getSalesTransactionLinesSnapshot(): Record<string, MockInvoiceLine[]> {
  return snapshot.salesTransactionLines ?? {};
}

/** Replace in-memory customers after loading from Supabase. */
export function replaceCustomersInStore(customers: MockCustomer[]) {
  snapshot.customers = customers.map((customer) => ({ ...customer }));
  emit();
}

/** Replace UI-created invoices after loading from Supabase. */
export function replaceInvoicesInStore(invoices: MockInvoice[]) {
  const unpaid: MockInvoice[] = [];
  const paid: MockInvoice[] = [];
  for (const invoice of invoices) {
    const row = { ...invoice };
    if (row.kind === "paid") paid.push(row);
    else unpaid.push(row);
  }
  snapshot.unpaidInvoices = unpaid;
  snapshot.paidInvoices = paid;
  invalidateMaxInvoiceNumber();
  emit();
}

/** Replace in-memory leads after loading from Supabase. */
export function replaceLeadsInStore(leads: MockLead[]) {
  snapshot.leads = leads.map((lead) => ({ ...lead }));
  emit();
}

export function getCustomersSnapshot(): MockCustomer[] {
  return snapshot.customers;
}

export function getLeadsSnapshot(): MockLead[] {
  return snapshot.leads;
}

/** Replace in-memory suppliers after loading from Supabase. */
export function replaceSuppliersInStore(suppliers: MockSupplier[]) {
  snapshot.suppliers = suppliers.map((supplier) => ({ ...supplier }));
  emit();
}

/** Replace in-memory products and services after loading from Supabase. */
export function replaceProductServicesInStore(productServices: MockProductService[]) {
  snapshot.productServices = productServices.map((product) => ({ ...product }));
  emit();
}

export function updateProductServiceInStore(
  id: string,
  patch: Partial<MockProductService>,
): MockProductService | null {
  const index = snapshot.productServices.findIndex((product) => product.id === id);
  if (index < 0) return null;
  snapshot.productServices[index] = {
    ...snapshot.productServices[index]!,
    ...patch,
  };
  emit();
  return snapshot.productServices[index]!;
}

/** Replace in-memory unpaid bills after loading from Supabase. */
export function replaceUnpaidBillsInStore(bills: UnpaidBill[]) {
  snapshot.unpaidBills = bills.map((bill) => ({ ...bill }));
  emit();
}

/** Stable payment methods list for useSyncExternalStore. */
export function getPaymentMethodsSnapshot(): MockPaymentMethod[] {
  if (cachedPaymentMethods && cachedPaymentMethodsVersion === snapshot.version) {
    return cachedPaymentMethods;
  }
  cachedPaymentMethodsVersion = snapshot.version;
  cachedPaymentMethods = [...snapshot.paymentMethods];
  return cachedPaymentMethods;
}

export function addPaymentMethod(input: { name: string; isCreditCard: boolean }) {
  const name = input.name.trim();
  if (!name) return null;
  const exists = snapshot.paymentMethods.some(
    (m) => m.name.toLowerCase() === name.toLowerCase(),
  );
  if (exists) return null;
  const method: MockPaymentMethod = {
    id: `pm-${Date.now()}`,
    name,
    isCreditCard: input.isCreditCard,
    isCustom: true,
  };
  snapshot.paymentMethods.push(method);
  emit();
  return method;
}

/** Stable locations list for useSyncExternalStore. */
export function getLocationsSnapshot(): MockLocation[] {
  if (cachedLocations && cachedLocationsVersion === snapshot.version) {
    return cachedLocations;
  }
  cachedLocationsVersion = snapshot.version;
  cachedLocations = [...snapshot.locations];
  return cachedLocations;
}

export function getExpenseCategoriesSnapshot(): MockExpenseCategory[] {
  if (cachedExpenseCategories && cachedExpenseCategoriesVersion === snapshot.version) {
    return cachedExpenseCategories;
  }
  cachedExpenseCategoriesVersion = snapshot.version;
  const fromChart = chartAccountsToExpenseCategories(snapshot.chartAccounts);
  const expenseNames = snapshot.expenses.map((expense) => expense.category);
  cachedExpenseCategories = mergeExpenseCategories(
    fromChart,
    snapshot.expenseCategories,
    expenseNames,
  );
  return cachedExpenseCategories;
}

export function addExpenseCategory(input: {
  name: string;
  accountType: string;
  isSubAccount: boolean;
  parentName?: string;
}) {
  const raw = input.name.trim();
  if (!raw) return null;
  const name = input.isSubAccount ? raw.replace(/^â†³\s*/, "") : raw;
  const exists = snapshot.expenseCategories.some(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (exists) return null;
  const category: MockExpenseCategory = {
    id: `cat-${Date.now()}`,
    name,
    displayName: input.isSubAccount ? `â†³ ${name}` : name,
    accountType: input.accountType,
    isSubAccount: input.isSubAccount,
    parentName: input.parentName,
    isCustom: true,
  };
  snapshot.expenseCategories.push(category);
  emit();
  return category;
}

export function getProductServicesSnapshot(): MockProductService[] {
  if (cachedProductServices && cachedProductServicesVersion === snapshot.version) {
    return cachedProductServices;
  }
  cachedProductServicesVersion = snapshot.version;
  cachedProductServices = [...snapshot.productServices];
  return cachedProductServices;
}

export function getProductItemCategoriesSnapshot(): MockProductItemCategory[] {
  if (
    cachedProductItemCategories &&
    cachedProductItemCategoriesVersion === snapshot.version
  ) {
    return cachedProductItemCategories;
  }
  cachedProductItemCategoriesVersion = snapshot.version;
  cachedProductItemCategories = [...snapshot.productItemCategories];
  return cachedProductItemCategories;
}

export function addProductItemCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const exists = snapshot.productItemCategories.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exists) return null;
  const category: MockProductItemCategory = {
    id: `pic-${Date.now()}`,
    name: trimmed,
    isCustom: true,
  };
  snapshot.productItemCategories.push(category);
  emit();
  return category;
}

export function getProductItemClassesSnapshot(): MockProductItemClass[] {
  if (cachedProductItemClasses && cachedProductItemClassesVersion === snapshot.version) {
    return cachedProductItemClasses;
  }
  cachedProductItemClassesVersion = snapshot.version;
  cachedProductItemClasses = [...snapshot.productItemClasses];
  return cachedProductItemClasses;
}

export function addProductItemClass(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const exists = snapshot.productItemClasses.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exists) return null;
  const itemClass: MockProductItemClass = {
    id: `picl-${Date.now()}`,
    name: trimmed,
    isCustom: true,
  };
  snapshot.productItemClasses.push(itemClass);
  emit();
  return itemClass;
}

export function getSuppliersSnapshot(): MockSupplier[] {
  if (cachedSuppliers && cachedSuppliersVersion === snapshot.version) {
    return cachedSuppliers;
  }
  cachedSuppliersVersion = snapshot.version;
  cachedSuppliers = snapshot.suppliers.map((supplier) => ({
    ...supplier,
    openBalance: resolveSupplierOpenBalance(supplier, snapshot.unpaidBills),
  }));
  return cachedSuppliers;
}

export function addSupplier(input: {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  currency?: string;
  openingBalance?: number;
  profile?: SupplierProfile;
}) {
  const name = input.name.trim();
  if (!name) return null;
  const exists = snapshot.suppliers.some(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
  if (exists) return null;
  const openingBalance =
    typeof input.openingBalance === "number" && Number.isFinite(input.openingBalance)
      ? Math.max(0, input.openingBalance)
      : 0;
  const supplier: MockSupplier = {
    id: `sup-${Date.now()}`,
    name,
    companyName: input.companyName?.trim() || name,
    phone: input.phone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    currency: input.currency?.trim() || "PHP",
    openBalance: openingBalance,
    isCustom: true,
    profile: input.profile,
  };
  snapshot.suppliers.push(supplier);
  emit();
  return supplier;
}

export type ImportSuppliersResult = {
  added: MockSupplier[];
  skipped: Array<{ name: string; reason: string; rowNumber?: number }>;
};

export function importSuppliers(
  rows: Array<{
    rowNumber?: number;
    name: string;
    companyName?: string;
    phone?: string;
    email?: string;
    currency?: string;
    openingBalance?: number;
    profile?: SupplierProfile;
  }>,
): ImportSuppliersResult {
  const added: MockSupplier[] = [];
  const skipped: ImportSuppliersResult["skipped"] = [];

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) {
      skipped.push({
        name: "(blank row)",
        reason: "Missing supplier name",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const exists = snapshot.suppliers.some(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      skipped.push({
        name,
        reason: "Already exists in supplier list",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const openingBalance =
      typeof row.openingBalance === "number" && Number.isFinite(row.openingBalance)
        ? Math.max(0, row.openingBalance)
        : 0;

    const supplier: MockSupplier = {
      id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      companyName: row.companyName?.trim() || name,
      phone: row.phone?.trim() ?? "",
      email: row.email?.trim() ?? "",
      currency: row.currency?.trim() || "PHP",
      openBalance: openingBalance,
      isCustom: true,
      profile: row.profile,
    };
    snapshot.suppliers.push(supplier);
    added.push(supplier);
  }

  if (added.length > 0) emit();
  return { added, skipped };
}

export type ImportChartAccountsResult = {
  added: MockChartAccount[];
  skipped: Array<{ name: string; reason: string; rowNumber?: number }>;
  replaced: boolean;
};

export function importChartAccounts(
  rows: Array<{
    rowNumber?: number;
    number: string;
    name: string;
    accountType: string;
    currency?: string;
    ledgerBalance?: number;
  }>,
  options?: { replace?: boolean },
): ImportChartAccountsResult {
  const replace = options?.replace ?? false;
  const added: MockChartAccount[] = [];
  const skipped: ImportChartAccountsResult["skipped"] = [];

  if (replace) {
    snapshot.chartAccounts = [];
  }

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) {
      skipped.push({
        name: "(blank row)",
        reason: "Missing account name",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const number = row.number.trim();
    const exists = snapshot.chartAccounts.some(
      (account) =>
        account.name.toLowerCase() === name.toLowerCase() ||
        (number && account.number === number),
    );
    if (exists) {
      skipped.push({
        name,
        reason: "Already exists in chart of accounts",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const account: MockChartAccount = {
      id: `coa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      number,
      name,
      accountType: row.accountType,
      currency: row.currency?.trim() || "PHP",
      tax: "",
      ledgerBalance:
        typeof row.ledgerBalance === "number" && Number.isFinite(row.ledgerBalance)
          ? row.ledgerBalance
          : 0,
      isActive: true,
    };
    snapshot.chartAccounts.push(account);
    added.push(account);
  }

  if (added.length > 0 || replace) emit();
  return { added, skipped, replaced: replace };
}

export type ImportCustomersResult = {
  added: MockCustomer[];
  skipped: Array<{ name: string; reason: string; rowNumber?: number }>;
};

export function importCustomers(
  rows: Array<{
    rowNumber?: number;
    name: string;
    companyName?: string;
    phone?: string;
    email?: string;
    currency?: string;
  }>,
): ImportCustomersResult {
  const added: MockCustomer[] = [];
  const skipped: ImportCustomersResult["skipped"] = [];

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) {
      skipped.push({
        name: "(blank row)",
        reason: "Missing customer name",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const exists = snapshot.customers.some(
      (customer) => customer.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      skipped.push({
        name,
        reason: "Already exists in customer list",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const customer: MockCustomer = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      companyName: row.companyName?.trim() || "None",
      phone: row.phone?.trim() ?? "",
      email: row.email?.trim() ?? "",
      currency: row.currency?.trim() || "PHP",
    };
    snapshot.customers.push(customer);
    added.push(customer);
  }

  if (added.length > 0) emit();
  return { added, skipped };
}

export type StoreDataSummary = {
  chartAccounts: number;
  customers: number;
  suppliers: number;
  invoices: number;
  expenses: number;
  salesTransactions: number;
  products: number;
};

export function getStoreDataSummary(): StoreDataSummary {
  return getStoreDataSummarySnapshot();
}

let cachedStoreDataSummary: StoreDataSummary | null = null;
let cachedStoreDataSummaryVersion = -1;

/** Stable store summary for useSyncExternalStore. */
export function getStoreDataSummarySnapshot(): StoreDataSummary {
  if (cachedStoreDataSummary && cachedStoreDataSummaryVersion === snapshot.version) {
    return cachedStoreDataSummary;
  }
  cachedStoreDataSummaryVersion = snapshot.version;
  cachedStoreDataSummary = {
    chartAccounts: snapshot.chartAccounts.length,
    customers: snapshot.customers.length,
    suppliers: snapshot.suppliers.length,
    invoices: snapshot.unpaidInvoices.length + snapshot.paidInvoices.length,
    expenses: snapshot.expenses.length,
    salesTransactions: snapshot.salesTransactions.length,
    products: snapshot.productServices.length,
  };
  return cachedStoreDataSummary;
}

/** Wipe all data and browser storage — use before a fresh QuickBooks import. */
export function resetMockStore() {
  snapshot = createInitialSnapshot();
  clearPersistedSnapshot();
  emit();
}

export function updateSupplier(
  id: string,
  input: {
    name: string;
    companyName?: string;
    phone?: string;
    email?: string;
    currency?: string;
    openingBalance?: number;
    profile?: SupplierProfile;
  },
) {
  const index = snapshot.suppliers.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const name = input.name.trim();
  if (!name) return null;
  const exists = snapshot.suppliers.some(
    (s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase(),
  );
  if (exists) return null;
  const openingBalance =
    typeof input.openingBalance === "number" && Number.isFinite(input.openingBalance)
      ? Math.max(0, input.openingBalance)
      : snapshot.suppliers[index].openBalance;
  const updated: MockSupplier = {
    ...snapshot.suppliers[index],
    name,
    companyName: input.companyName?.trim() || name,
    phone: input.phone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    currency: input.currency?.trim() || "PHP",
    openBalance: openingBalance,
    profile: input.profile,
  };
  snapshot.suppliers[index] = updated;
  emit();
  return updated;
}

export function getSupplierById(id: string): MockSupplier | undefined {
  return snapshot.suppliers.find((s) => s.id === id);
}

export function deleteSuppliers(ids: string[]) {
  if (!ids.length) return;
  const idSet = new Set(ids);
  snapshot.suppliers = snapshot.suppliers.filter((s) => !idSet.has(s.id));
  emit();
}

export function getUnpaidBillsSnapshot(): UnpaidBill[] {
  if (cachedUnpaidBills && cachedUnpaidBillsVersion === snapshot.version) {
    return cachedUnpaidBills;
  }
  cachedUnpaidBillsVersion = snapshot.version;
  cachedUnpaidBills = [...snapshot.unpaidBills];
  return cachedUnpaidBills;
}

export function getNextBillNumber() {
  const nums = snapshot.unpaidBills
    .map((b) => Number.parseInt(b.id.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 1000;
  return String(max + 1);
}

export function addUnpaidBill(input: {
  supplier: string;
  mailingAddress?: string;
  billDate: string;
  dueDate: string;
  billNo: string;
  billAmount: number;
  category?: string;
  lineDescription?: string;
}) {
  const supplier = input.supplier.trim();
  if (!supplier) return null;
  const billAmount = input.billAmount;
  const bill: UnpaidBill = {
    id: getNextBillNumber(),
    supplier,
    mailingAddress: input.mailingAddress?.trim() || supplier,
    billDate: input.billDate,
    dueDate: input.dueDate,
    billAmount,
    openBalance: billAmount,
    statusType: "due_later",
    statusDetail: "Due on receipt",
    category: input.category,
    lineDescription: input.lineDescription,
  };
  snapshot.unpaidBills.unshift(bill);
  emit();
  return bill;
}

export function getPaidBillsSnapshot(): PaidBill[] {
  if (cachedPaidBills && cachedPaidBillsVersion === snapshot.version) {
    return cachedPaidBills;
  }
  cachedPaidBillsVersion = snapshot.version;
  cachedPaidBills = [...snapshot.paidBills];
  return cachedPaidBills;
}

export function payUnpaidBills(
  payments: Array<{ billId: string; paidAmount: number; paidDate: string }>,
) {
  let changed = false;

  for (const payment of payments) {
    if (payment.paidAmount <= 0) continue;
    const index = snapshot.unpaidBills.findIndex((bill) => bill.id === payment.billId);
    if (index === -1) continue;

    const bill = snapshot.unpaidBills[index]!;
    const paidAmount = Math.min(payment.paidAmount, bill.openBalance);
    if (paidAmount <= 0) continue;

    snapshot.paidBills.unshift({
      id: `paid-${bill.id}-${Date.now()}`,
      supplier: bill.supplier,
      dueDate: bill.dueDate,
      billDate: bill.billDate,
      billAmount: bill.billAmount,
      paidAmount,
      paidDate: payment.paidDate,
      billNo: bill.billNo,
    });

    const remaining = bill.openBalance - paidAmount;
    if (remaining <= 0) {
      snapshot.unpaidBills.splice(index, 1);
    } else {
      snapshot.unpaidBills[index] = { ...bill, openBalance: remaining };
    }
    changed = true;
  }

  if (changed) emit();
}

export function addProductService(input: CreateProductServiceInput) {
  const trimmed = input.name.trim();
  if (!trimmed) return null;
  const exists = snapshot.productServices.some(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exists) return null;
  const product = productServiceFromCreateInput(input, `ps-${Date.now()}`);
  snapshot.productServices.unshift(product);
  emit();
  return product;
}

export function addLocation(input: { name: string; isSubLocation: boolean }) {
  const raw = input.name.trim();
  if (!raw) return null;
  const name = input.isSubLocation ? `â†³ ${raw}` : raw;
  const exists = snapshot.locations.some(
    (l) => l.name.toLowerCase() === name.toLowerCase(),
  );
  if (exists) return null;
  const location: MockLocation = {
    id: `loc-${Date.now()}`,
    name,
    isSubLocation: input.isSubLocation,
    isCustom: true,
  };
  snapshot.locations.push(location);
  emit();
  return location;
}

/** @deprecated Use getDisplayInvoicesSnapshot for React subscriptions. */
export function getInvoicesForView() {
  return getAllInvoices(currentInvoices());
}

export { getCustomerName };
export type { DashboardSummary };
