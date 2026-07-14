export type ManagementReportCategory = "standard" | "custom";

export type ManagementReportCatalogEntry = {
  id: string;
  label: string;
  category: ManagementReportCategory;
  categoryLabel: "Standard Report" | "Custom Report";
};

const LEGACY_IDS: Record<string, string> = {
  "Profit and Loss|standard": "profit-and-loss",
  "Balance Sheet|standard": "balance-sheet",
  "A/R Ageing Summary Report|standard": "ar-aging",
  "A/R Ageing Detail Report|standard": "ar-aging-detail",
  "A/P Ageing Detail Report|standard": "ap-aging-detail",
  "A/P Ageing Summary Report|standard": "ap-aging",
  "Expenses by Supplier Summary|standard": "expenses-by-supplier-summary",
  "Transaction Detail by Account|custom": "transaction-detail-by-account",
};

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function catalogId(label: string, category: ManagementReportCategory): string {
  const legacy = LEGACY_IDS[`${label}|${category}`];
  if (legacy) return legacy;
  const base = slugify(label);
  return category === "custom" ? `${base}-custom` : base;
}

function entry(
  label: string,
  category: ManagementReportCategory,
): ManagementReportCatalogEntry {
  return {
    id: catalogId(label, category),
    label,
    category,
    categoryLabel: category === "custom" ? "Custom Report" : "Standard Report",
  };
}

/** QuickBooks management report picker — standard and custom reports. */
const CATALOG_ROWS: Array<{ label: string; category: ManagementReportCategory }> = [
  { label: "Transaction List by Tag Group", category: "standard" },
  { label: "Profit and Loss by Class", category: "standard" },
  { label: "Open Invoices Report", category: "standard" },
  { label: "Trial Balance", category: "standard" },
  { label: "Customer Balance Summary", category: "standard" },
  { label: "Employee Contact List", category: "standard" },
  { label: "Account List", category: "standard" },
  { label: "Invoices and Received Payments", category: "standard" },
  { label: "Product/Service List", category: "standard" },
  { label: "Terms List", category: "standard" },
  { label: "Unbilled Time", category: "standard" },
  { label: "Supplier Phone List", category: "standard" },
  { label: "Profit and Loss YTD Comparison", category: "standard" },
  { label: "Transaction List with Splits", category: "standard" },
  { label: "Transaction List by Customer", category: "standard" },
  { label: "Bills and Applied Payments", category: "standard" },
  { label: "Customer Phone List", category: "standard" },
  { label: "Balance Sheet Comparison", category: "standard" },
  { label: "Profit and Loss Detail", category: "standard" },
  { label: "Class List", category: "standard" },
  { label: "Sales by Class Summary", category: "standard" },
  { label: "Stocktake Worksheet", category: "standard" },
  { label: "Transaction Detail by Account", category: "standard" },
  { label: "A/R Ageing Summary Report", category: "standard" },
  { label: "Expenses by Supplier Summary", category: "standard" },
  { label: "Sales by Location Detail", category: "standard" },
  { label: "Journal", category: "standard" },
  { label: "Sales by Class Detail", category: "standard" },
  { label: "Project profitability", category: "standard" },
  { label: "Sales by Customer Detail", category: "standard" },
  { label: "Profit and Loss by Customer", category: "standard" },
  { label: "Open Purchase Order List by Supplier", category: "standard" },
  { label: "Sales by Location Summary", category: "standard" },
  { label: "Time Summary by Pay Type", category: "standard" },
  { label: "Customer Contact List", category: "standard" },
  { label: "Timesheet Detail by Employee", category: "standard" },
  { label: "Profit and Loss % of Total Income", category: "standard" },
  { label: "Profit and Loss by Month", category: "standard" },
  { label: "Supplier Balance Summary", category: "standard" },
  { label: "Unbilled Charges", category: "standard" },
  { label: "Tax Liability Report", category: "standard" },
  { label: "A/P Ageing Detail Report", category: "standard" },
  { label: "A/R Ageing Detail Report", category: "standard" },
  { label: "Inventory Valuation Detail", category: "standard" },
  { label: "Adjusted Trial Balance", category: "standard" },
  { label: "Statement of Cash Flows", category: "standard" },
  { label: "Quarterly Profit and Loss Summary", category: "standard" },
  { label: "Transaction Report", category: "standard" },
  { label: "Balance Sheet Summary", category: "standard" },
  { label: "Transaction List by Supplier", category: "standard" },
  { label: "Collections Report", category: "standard" },
  { label: "Bill Payment List", category: "standard" },
  { label: "Profit and Loss Comparison", category: "standard" },
  { label: "Unbilled time and expenses", category: "standard" },
  { label: "Customer Balance Detail Report", category: "standard" },
  { label: "Invalid Journal Transactions", category: "standard" },
  { label: "Profit and Loss", category: "standard" },
  { label: "Bill Approval Status", category: "standard" },
  { label: "Profit and Loss By Tag Group", category: "standard" },
  { label: "Cheque Detail Report", category: "standard" },
  { label: "A/P Ageing Summary Report", category: "standard" },
  { label: "General Ledger", category: "standard" },
  { label: "Deposit Detail", category: "standard" },
  { label: "Transaction List by Date", category: "standard" },
  { label: "Sales by Product/Service Detail", category: "standard" },
  { label: "Product/Item Profitability by Customer", category: "standard" },
  { label: "Sales by Customer Summary", category: "standard" },
  { label: "Sales by Customer Type Detail", category: "standard" },
  { label: "Supplier Contact List", category: "standard" },
  { label: "Sales by Product/Service Summary", category: "standard" },
  { label: "Location List", category: "standard" },
  { label: "Invoice List by Date", category: "standard" },
  { label: "Income by Customer Summary", category: "standard" },
  { label: "Supplier Balance Detail Report", category: "standard" },
  { label: "Profit and Loss by Location", category: "standard" },
  { label: "Realised Exchange Gains & Losses", category: "standard" },
  { label: "Inventory Valuation Summary", category: "standard" },
  { label: "Project Profitability Summary", category: "standard" },
  { label: "Recent/Edited Time Activities", category: "standard" },
  { label: "Invoice Approval Status", category: "standard" },
  { label: "Estimates by Customer", category: "standard" },
  { label: "Unpaid Bills Report", category: "standard" },
  { label: "General Ledger List", category: "standard" },
  { label: "Statement List", category: "standard" },
  { label: "Payment Method List", category: "standard" },
  { label: "Balance Sheet", category: "standard" },
  { label: "Realized Exchange Gains & Losses", category: "standard" },
  { label: "Balance Sheet Detail", category: "standard" },
  { label: "Custom Summary Report", category: "standard" },
  { label: "Statement of changes in equity", category: "standard" },
  { label: "Estimates & Progress Invoicing Summary by Customer", category: "standard" },
  { label: "A/R Aging Summary", category: "standard" },
  { label: "Customer Balance Detail", category: "standard" },
  { label: "Open Invoices", category: "standard" },
  { label: "A/R Aging Detail", category: "standard" },
  { label: "Invoice List", category: "standard" },
  { label: "Purchases by Supplier Detail", category: "standard" },
  { label: "Purchases by Class Detail", category: "standard" },
  { label: "Purchases by Product/Service Detail", category: "standard" },
  { label: "Purchases by Location Detail", category: "standard" },
  { label: "Check Detail", category: "standard" },
  { label: "A/P Aging Summary", category: "standard" },
  { label: "Supplier Balance Detail", category: "standard" },
  { label: "A/P Aging Detail", category: "standard" },
  { label: "Unpaid Bills", category: "standard" },
  { label: "Transaction Detail by Tax Code", category: "standard" },
  { label: "Recent Automatic Transactions", category: "standard" },
  { label: "Recent Transactions", category: "standard" },
  { label: "Recurring Template List", category: "standard" },
  { label: "Invalid Journal Entries", category: "standard" },
  { label: "Sales by Class Detail", category: "custom" },
  { label: "Transaction List by Supplier - copy", category: "custom" },
  { label: "Profit and Loss by Month", category: "custom" },
  { label: "Transaction Detail by Account", category: "custom" },
];

export const MANAGEMENT_REPORT_CATALOG: ManagementReportCatalogEntry[] = CATALOG_ROWS.map(
  ({ label, category }) => entry(label, category),
);

/** @deprecated Use MANAGEMENT_REPORT_CATALOG — kept for existing imports. */
export const EMBEDDABLE_REPORTS = MANAGEMENT_REPORT_CATALOG.map(({ id, label }) => ({
  id,
  label,
}));
