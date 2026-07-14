/** QuickBooks detail type → account type (from Petrosphere chart of accounts). */
export const QBO_DETAIL_TYPE_TO_ACCOUNT_TYPE: Record<string, string> = {
  "Accounts Payable (A/P)": "Accounts payable (A/P)",
  "Accounts Receivable (A/R)": "Accounts receivable (A/R)",
  "Accrued holiday payable": "Non-current liabilities",
  "Accrued liabilities": "Current liabilities",
  "Accrued non-current liabilities": "Non-current liabilities",
  "Accumulated amortization of non-current assets": "Non-current assets",
  "Accumulated depletion": "Fixed assets",
  "Accumulated depreciation on property, plant and equipment": "Fixed assets",
  "Advertising/Promotional": "Expenses",
  "Allowance for bad debts": "Current assets",
  "Amortization expense": "Expenses",
  "Assets available for sale": "Current assets",
  "Assets held for sale": "Non-current assets",
  "Bad debts": "Expenses",
  Bank: "Cash and cash equivalents",
  "Bank charges": "Expenses",
  "Cash and cash equivalents": "Cash and cash equivalents",
  "Cash on hand": "Cash and cash equivalents",
  "Charitable Contributions": "Expenses",
  "Commissions and fees": "Expenses",
  "Cost of Labor": "Expenses",
  "Cost of labor - COS": "Cost of sales",
  "Cost of Sales": "Cost of sales",
  "Credit Card": "Credit card",
  "Current Tax Liability": "Current liabilities",
  "Deferred tax": "Non-current assets",
  "Discounts/Refunds Given": "Income",
  "Dividend disbursed": "Owner's equity",
  "Dividend income": "Other income",
  "Dividends payable": "Current liabilities",
  "Dues and Subscriptions": "Expenses",
  "Employee Cash Advances": "Current assets",
  "Equipment rental": "Expenses",
  "Equipment rental - COS": "Cost of sales",
  "Equity in earnings of subsidiaries": "Owner's equity",
  "Exchange Gain or Loss": "Other expense",
  "Freight and delivery - COS": "Cost of sales",
  Goodwill: "Non-current assets",
  "Income tax expense": "Expenses",
  "Income tax payable": "Current liabilities",
  Insurance: "Expenses",
  "Intangible Assets": "Non-current assets",
  "Interest earned": "Other income",
  "Interest paid": "Expenses",
  Inventory: "Current assets",
  Land: "Fixed assets",
  "Legal and professional fees": "Expenses",
  "Liabilities related to assets held for sale": "Non-current liabilities",
  "Loan Payable": "Current liabilities",
  "Loans To Officers": "Current assets",
  "Loans to Others": "Current assets",
  "Long-term debt": "Non-current liabilities",
  "Long-term investments": "Non-current assets",
  "Loss on discontinued operations, net of tax": "Expenses",
  "Loss on disposal of assets": "Other income",
  "Management compensation": "Expenses",
  "Meals and entertainment": "Expenses",
  "Notes Payable": "Non-current liabilities",
  "Office/General Administrative Expenses": "Expenses",
  "Opening Balance Equity": "Owner's equity",
  "Other comprehensive income": "Owner's equity",
  "Other costs of sales - COS": "Cost of sales",
  "Other current assets": "Current assets",
  "Other current liabilities": "Current liabilities",
  "Other Expense": "Other expense",
  "Other Miscellaneous Income": "Other income",
  "Other Miscellaneous Service Cost": "Expenses",
  "Other operating income": "Other income",
  "Other selling expenses": "Expenses",
  "Payroll Clearing": "Current liabilities",
  "Payroll Expenses": "Expenses",
  "Prepaid Expenses": "Current assets",
  "Rent or Lease of Buildings": "Expenses",
  "Repair and maintenance": "Expenses",
  "Retained Earnings": "Owner's equity",
  "Revenue - General": "Income",
  "Sales - retail": "Income",
  "Sales - wholesale": "Income",
  "Sales and service tax payable": "Current liabilities",
  "Sales of Product Income": "Income",
  "Share capital": "Owner's equity",
  "Shipping and delivery expense": "Expenses",
  "Supplies and materials": "Expenses",
  "Supplies and materials - COS": "Cost of sales",
  "Tax expense": "Expenses",
  "Tax Suspense": "Current liabilities",
  "Travel expenses - general and admin expenses": "Expenses",
  "Travel expenses - selling expense": "Expenses",
  "Unapplied Cash Bill Payment Expense": "Expenses",
  "Unapplied Cash Payment Income": "Income",
  "Undeposited Funds": "Current assets",
  "Unrealized loss on securities, net of tax": "Other income",
  Utilities: "Expenses",
};

const DETAIL_TYPE_LOOKUP = new Map(
  Object.entries(QBO_DETAIL_TYPE_TO_ACCOUNT_TYPE).map(([detail, accountType]) => [
    detail.toLowerCase(),
    accountType,
  ]),
);

/** Resolve QBO account type from detail type (Run Report export uses Type for detail type). */
export function resolveAccountTypeFromDetailType(detailType: string): string | undefined {
  const key = detailType.trim().toLowerCase();
  if (!key) return undefined;
  return DETAIL_TYPE_LOOKUP.get(key);
}

/** True when headers use QuickBooks report layout (Account List, Run report: Type + Total balance). */
export function isQuickBooksRunReportHeaders(headers: unknown[]): boolean {
  const normalized = headers.map((cell) =>
    String(cell ?? "")
      .replace(/\ufeff/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
  );
  const hasAccountType = normalized.includes("account type");
  const hasAccountName = normalized.includes("account name");
  const hasType = normalized.includes("type");
  const hasBalance = normalized.some((header) =>
    ["total balance", "balance", "quickbooks balance", "qb balance"].includes(header),
  );
  return !hasAccountType && hasBalance && (hasType || hasAccountName);
}
