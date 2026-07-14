import {
  findCategoryByName,
  type MockExpenseCategory,
} from "@/lib/mock-data/expense-categories";

/** Map legacy transaction category values to chart category names. */
const CATEGORY_ALIASES: Record<string, string> = {
  "Professional Fees": "Trainer/Facilitator Fees",
  Rent: "Rent or lease payments",
};

/** Dashboard donut labels (QuickBooks-style casing). */
const DASHBOARD_LABEL_OVERRIDES: Record<string, string> = {
  "Employee Salary": "Employee salary",
  "Trainer/Facilitator Fees": "Trainer/facilitator fees",
  "Professional Fees": "Trainer/facilitator fees",
};

/** Rolled into the dashboard "Other" slice (top-five widget). */
export const EXPENSE_DASHBOARD_OTHER_CATEGORIES = new Set([
  "Meals & Entertainment",
  "Office Supplies",
  "Transportation Expenses",
  "--Split--",
]);

function formatDashboardLabel(name: string, displayName: string): string {
  return DASHBOARD_LABEL_OVERRIDES[name] ?? displayName.replace(/^↳\s*/, "");
}

/** Resolve a transaction category to the label shown on the expenses dashboard. */
export function resolveExpenseCategoryDisplayName(
  category: string,
  categories?: readonly MockExpenseCategory[],
): string {
  if (EXPENSE_DASHBOARD_OTHER_CATEGORIES.has(category)) return "Other";

  const lookupName = CATEGORY_ALIASES[category] ?? category;
  if (categories?.length) {
    const match =
      findCategoryByName([...categories], lookupName) ??
      findCategoryByName([...categories], category);
    if (match) return formatDashboardLabel(match.name, match.displayName);
  }

  return (
    DASHBOARD_LABEL_OVERRIDES[category] ??
    DASHBOARD_LABEL_OVERRIDES[lookupName] ??
    lookupName
  );
}

export function expenseDashboardCategoryLabel(
  category: string,
  categories?: readonly MockExpenseCategory[],
): string {
  return resolveExpenseCategoryDisplayName(category, categories);
}
