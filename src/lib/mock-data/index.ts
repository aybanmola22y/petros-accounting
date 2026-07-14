export type {
  CustomerWithBalance,
  MockCustomer,
  MockInvoice,
  MockLead,
  OverdueInvoiceRow,
  CustomerHubOverdue,
  PipelineMetric,
  ReceivablesKpiSegment,
  ReceivablesSummary,
  ReceivablesView,
} from "./types";

export {
  addCustomer,
  addInvoice,
  addRecurringInvoiceSchedule,
  getRecurringInvoiceSchedules,
  getRecurringTemplatesSnapshot,
  addRecurringTemplate,
  deleteRecurringTemplate,
  replaceRecurringTemplatesInStore,
  updateRecurringTemplate,
  getNextInvoiceNumber,
  getBankAccountsSnapshot,
  getChartAccountsSnapshot,
  addChartAccount,
  updateChartAccount,
  updateChartAccounts,
  getPaymentMethodsSnapshot,
  addPaymentMethod,
  getLocationsSnapshot,
  addLocation,
  getExpenseCategoriesSnapshot,
  addExpenseCategory,
  getProductServicesSnapshot,
  addProductService,
  getProductItemCategoriesSnapshot,
  addProductItemCategory,
  getProductItemClassesSnapshot,
  addProductItemClass,
  getSuppliersSnapshot,
  getCustomersSnapshot,
  addSupplier,
  importSuppliers,
  importChartAccounts,
  importCustomers,
  resetMockStore,
  getStoreDataSummary,
  getStoreDataSummarySnapshot,
  replaceChartAccountsInStore,
  replaceExpensesInStore,
  replaceSalesTransactionsInStore,
  replaceSalesTransactionLinesInStore,
  getSalesTransactionLinesSnapshot,
  replaceCustomersInStore,
  replaceLeadsInStore,
  replaceInvoicesInStore,
  replaceSuppliersInStore,
  replaceProductServicesInStore,
  updateProductServiceInStore,
  replaceUnpaidBillsInStore,
  updateSupplier,
  getSupplierById,
  deleteSuppliers,
  getUnpaidBillsSnapshot,
  getPaidBillsSnapshot,
  addUnpaidBill,
  payUnpaidBills,
  getNextBillNumber,
  getExpensesSnapshot,
  getSalesTransactionsSnapshot,
  getDashboardSnapshot,
  addSalesTransaction,
  updateSalesTransaction,
  deleteSalesTransactions,
  addExpense,
  getNextExpenseNumber,
  getNextPaymentNumber,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  voidInvoice,
  findSalesTransactionForInvoice,
  updateExpense,
  deleteExpenses,
  setBankAccountBalance,
  refreshAllBankAccountBalances,
  getDisplayInvoicesSnapshot,
  getInvoicesForView,
  getMockStoreVersion,
  getReceivablesSnapshot,
  getServerReceivablesSnapshot,
  hydrateStoreFromPersistence,
  subscribeMockStore,
} from "./store";

export {
  recordInvoiceCreation,
  recordInvoiceUpdate,
  recordReceivePaymentAgainstInvoice,
  recordInvoiceOpened,
  recordInvoiceSent,
  recordInvoiceViewed,
  recordInvoicePaid,
  recordInvoiceDeposited,
  formatInvoiceNumber,
} from "./record-invoice";

export type { MockBankAccount } from "./bank-accounts";
export type { MockChartAccount } from "./chart-of-accounts";
export type { MockPaymentMethod } from "./payment-methods";
export { SEED_PAYMENT_METHOD_NAMES, buildSeedPaymentMethods } from "./payment-methods";
export type { MockLocation } from "./locations";
export { SEED_LOCATION_NAMES, buildSeedLocations } from "./locations";
export type { MockExpenseCategory } from "./expense-categories";
export type {
  CreateProductServiceInput,
  MockProductService,
  ProductServiceItemType,
} from "./products-services";
export {
  SEED_PRODUCT_SERVICE_NAMES,
  buildSeedProductServices,
  computeProductStockSummary,
  formatProductItemType,
  groupProductsByCategory,
  productServiceFromCreateInput,
} from "./products-services";
export type { MockProductItemCategory } from "./product-item-categories";
export {
  SEED_PRODUCT_ITEM_CATEGORIES,
  buildSeedProductItemCategories,
} from "./product-item-categories";
export type { MockProductItemClass } from "./product-item-classes";
export { SEED_PRODUCT_ITEM_CLASSES, buildSeedProductItemClasses } from "./product-item-classes";
export type { MockSupplier, SupplierAttachment, SupplierProfile } from "./suppliers";
export { formatSupplierAddress } from "./suppliers";
export type { ImportSuppliersResult, StoreDataSummary } from "./store";
export { SEED_SUPPLIERS, buildSeedSuppliers } from "./suppliers";
export {
  BILL_DATE_FILTER_OPTIONS,
  billListDateRange,
  computePaidLast30Days,
  defaultBillDateRange,
  filterPaidBills,
  formatBillDateRangeLabel,
  PAYABLES_REFERENCE_DATE,
} from "./paid-bills";
export type { BillDateFilter, PaidBill, PaidBillsSummary } from "./paid-bills";
export type { UnpaidBill, SupplierPayablesSummary } from "./unpaid-bills";
export {
  billsForSupplierList,
  buildSeedUnpaidBills,
  computeSupplierPayablesSummary,
  filterUnpaidBills,
  openBalanceBySupplierName,
  overdueSupplierNames,
  resolveSupplierOpenBalance,
  UNPAID_BILLS,
} from "./unpaid-bills";
export {
  CATEGORY_ACCOUNT_TYPES,
  DEFAULT_EXPENSE_CATEGORY,
  buildSeedExpenseCategories,
} from "./expense-categories";
export {
  SEED_CHART_ACCOUNTS,
  PAYMENT_ACCOUNT_TYPES,
  filterPaymentAccounts,
  getActiveChartAccountsSorted,
  chartAccountDisplayBalance,
  mergeChartAccountsWithBankBalances,
} from "./chart-of-accounts";
export type {
  MockExpenseTransaction,
  ExpensePeriod,
  ExpenseCategorySlice,
  ExpenseDashboardSlice,
} from "./expenses";
export type {
  MockSalesTransaction,
  SalesPeriod,
  SalesMonthPoint,
  SalesDashboardSlice,
} from "./sales";
export {
  computeSalesDashboard,
  filterSalesByPeriod,
  isRecognizedSale,
  salesChartYMax,
} from "./sales";
export {
  EXPENSE_CATEGORIES,
  EXPENSE_DATE_FILTER_OPTIONS,
  computeExpenseDashboard,
  expenseDateChipLabel,
  filterExpensesByPeriod,
  parseExpenseDate,
} from "./expenses";
export type { RecurringInvoiceSchedule } from "./store";
export {
  RECURRING_TRANSACTION_TYPES,
  RECURRING_TEMPLATE_TYPE_OPTIONS,
  RECURRING_LOCATION_FILTER_OPTIONS,
  DEFAULT_RECURRING_LIST_FILTERS,
  SEED_RECURRING_TEMPLATES,
  formatRecurringAmount,
  defaultIntervalForType,
  nextRecurringDates,
  recurringFilterSummary,
  RECURRING_INTERVAL_OPTIONS,
  advanceRecurringDates,
  computeNextRecurringDate,
  formatRecurringUsDate,
  parseRecurringUsDate,
  frequencyLabelToInterval,
} from "./recurring-transactions";
export type {
  MockRecurringTemplate,
  RecurringListFilters,
  RecurringLocationFilter,
  RecurringScheduleType,
  RecurringTransactionType,
} from "./recurring-transactions";
export type { DashboardSummary } from "./dashboard";
export {
  SEED_BANK_ACCOUNTS,
  buildDashboardBankAccountRows,
  computeTotalBankBalance,
} from "./bank-accounts";
export type { DashboardBankAccountRow } from "./bank-accounts";
export { SEED_SALES_BY_MONTH } from "./seeds-dashboard";

export { mockInvoiceToViewRow, buildDisplayInvoiceList } from "./adapters";
export type { InvoiceViewRow, InvoiceViewStatus } from "./adapters";

export {
  computeSalesTotal,
  computeSalesBreakdown,
  computeSalesByMonth,
  computeSalesDashboardSlice,
  computeRevenueByMonth,
  computeExpenseTotal,
  computeExpenseDashboardSlice,
  computeProfitLossSummary,
  computeProfitAndLossLines,
  buildLedgerEntries,
  buildBookkeepingEntries,
  applyComputedLedgerBalances,
  computeRecentTransactions,
  salesPeriodToRange,
  expensePeriodToRange,
} from "@/lib/ledger";
export type {
  ProfitLossSummary,
  SalesTotalBreakdown,
  LedgerEntry,
  RevenueMonthPoint,
  RecentTransactionRow,
} from "@/lib/ledger";
