import type { MockBankAccount } from "./bank-accounts";
import type { MockChartAccount } from "./chart-of-accounts";
import type { MockExpenseCategory } from "./expense-categories";
import type { MockExpenseTransaction } from "./expenses";
import type { MockLocation } from "./locations";
import type { MockPaymentMethod } from "./payment-methods";
import type { PaidBill } from "./paid-bills";
import type { MockProductItemCategory } from "./product-item-categories";
import type { MockProductItemClass } from "./product-item-classes";
import type { MockProductService } from "./products-services";
import type { MockRecurringTemplate } from "./recurring-transactions";
import type { MockSalesTransaction } from "./sales";
import type { MockSupplier } from "./suppliers";
import type { MockCustomer, MockInvoice, MockInvoiceLine, MockLead } from "./types";
import type { UnpaidBill } from "./unpaid-bills";

export type MockStoreSnapshot = {
  version: number;
  customers: MockCustomer[];
  leads: MockLead[];
  unpaidInvoices: MockInvoice[];
  paidInvoices: MockInvoice[];
  bankAccounts: MockBankAccount[];
  expenses: MockExpenseTransaction[];
  salesTransactions: MockSalesTransaction[];
  /** Invoice line items keyed by reference number (from Sales by Product/Service Detail import). */
  salesTransactionLines: Record<string, MockInvoiceLine[]>;
  chartAccounts: MockChartAccount[];
  paymentMethods: MockPaymentMethod[];
  locations: MockLocation[];
  expenseCategories: MockExpenseCategory[];
  productServices: MockProductService[];
  productItemCategories: MockProductItemCategory[];
  productItemClasses: MockProductItemClass[];
  suppliers: MockSupplier[];
  unpaidBills: UnpaidBill[];
  paidBills: PaidBill[];
  recurringTemplates: MockRecurringTemplate[];
};

/** Fresh store with no demo data — ready for QuickBooks import. */
export function createEmptySnapshot(): MockStoreSnapshot {
  return {
    version: 0,
    customers: [],
    leads: [],
    unpaidInvoices: [],
    paidInvoices: [],
    bankAccounts: [],
    expenses: [],
    salesTransactions: [],
    salesTransactionLines: {},
    chartAccounts: [],
    paymentMethods: [],
    locations: [],
    expenseCategories: [],
    productServices: [],
    productItemCategories: [],
    productItemClasses: [],
    suppliers: [],
    unpaidBills: [],
    paidBills: [],
    recurringTemplates: [],
  };
}
