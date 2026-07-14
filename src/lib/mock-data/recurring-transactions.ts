export const RECURRING_TRANSACTION_TYPES = [
  "Bill",
  "Non-Posting Charge",
  "Cheque",
  "Non-Posting Credit",
  "Credit Card Credit",
  "Credit Note",
  "Deposit",
  "Estimate",
  "Expense",
  "Invoice",
  "Journal Entry",
  "Payment",
  "Refund",
  "Sales Receipt",
  "Transfer",
  "Supplier Credit",
] as const;

export type RecurringTransactionType = (typeof RECURRING_TRANSACTION_TYPES)[number];

export type RecurringScheduleType = "Scheduled" | "Reminder" | "Unscheduled";

export type MockRecurringTemplate = {
  id: string;
  templateName: string;
  scheduleType: RecurringScheduleType;
  txnType: RecurringTransactionType;
  interval: string;
  previousDate: string;
  nextDate: string;
  customerSupplier: string;
  amount: number;
  location?: string;
  /** Full editor snapshot (line items, payment account, memo, schedule, …). */
  details?: Record<string, unknown> | null;
};

export const RECURRING_TEMPLATE_TYPE_OPTIONS = [
  "All",
  "Scheduled",
  "Reminder",
  "Unscheduled",
] as const;

export const RECURRING_LOCATION_FILTER_OPTIONS = [
  "All",
  "Unspecified",
  "Antique",
  "Batangas City",
  "Bulacan",
  "Cebu City",
  "Davao",
  "Davao City",
  "Ermita, Metro Manila",
  "Head Office - Puerto Princesa City",
  "Head office Puerto Princesa City, Palawan",
  "Iloilo City",
  "Laguna",
  "Metro Manila",
  "Puerto Princesa City",
  "Roxas City Btranch",
] as const;

export type RecurringLocationFilter = (typeof RECURRING_LOCATION_FILTER_OPTIONS)[number];

export type RecurringListFilters = {
  templateType: RecurringScheduleType | "All";
  transactionType: RecurringTransactionType | "All";
  location: RecurringLocationFilter;
};

export const DEFAULT_RECURRING_LIST_FILTERS: RecurringListFilters = {
  templateType: "All",
  transactionType: "All",
  location: "All",
};

export function recurringFilterSummary(filters: RecurringListFilters): string {
  const parts: string[] = [];
  if (filters.templateType !== "All") parts.push(filters.templateType);
  if (filters.transactionType !== "All") parts.push(filters.transactionType);
  if (filters.location !== "All") parts.push(filters.location);
  return parts.length === 0 ? "All" : parts.join(" · ");
}

export const SEED_RECURRING_TEMPLATES: MockRecurringTemplate[] = [
  {
    id: "rt-web-com",
    templateName: "Web.com.ph Inc.",
    scheduleType: "Scheduled",
    txnType: "Expense",
    interval: "Every Month",
    previousDate: "06/01/2026",
    nextDate: "07/01/2026",
    customerSupplier: "Web.com.ph Inc.",
    amount: 2_548,
    location: "Unspecified",
  },
];

export function formatRecurringAmount(amount: number): string {
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const RECURRING_INTERVAL_OPTIONS = [
  "Daily",
  "Weekly",
  "Every 2 Weeks",
  "Twice a Month",
  "Every Month",
  "Every 2 Months",
  "Every 3 Months",
  "Every 4 Months",
  "Every 6 Months",
  "Every Year",
] as const;

export type RecurringInterval = (typeof RECURRING_INTERVAL_OPTIONS)[number];

export function defaultIntervalForType(_type: RecurringTransactionType): string {
  return "Every Month";
}

export function formatRecurringUsDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

export function parseRecurringUsDate(value: string): Date | null {
  const parts = value.trim().split("/").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [month, day, year] = parts;
  return new Date(year, month - 1, day);
}

export function computeNextRecurringDate(from: Date, interval: string): Date {
  const next = new Date(from);
  switch (interval) {
    case "Daily":
      next.setDate(next.getDate() + 1);
      break;
    case "Weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "Every 2 Weeks":
      next.setDate(next.getDate() + 14);
      break;
    case "Twice a Month":
      next.setDate(next.getDate() + 15);
      break;
    case "Every Month":
      next.setMonth(next.getMonth() + 1);
      break;
    case "Every 2 Months":
      next.setMonth(next.getMonth() + 2);
      break;
    case "Every 3 Months":
      next.setMonth(next.getMonth() + 3);
      break;
    case "Every 4 Months":
      next.setMonth(next.getMonth() + 4);
      break;
    case "Every 6 Months":
      next.setMonth(next.getMonth() + 6);
      break;
    case "Every Year":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

export function nextRecurringDates(
  interval = "Every Month",
): { previousDate: string; nextDate: string } {
  const today = new Date();
  const next = computeNextRecurringDate(today, interval);
  return {
    previousDate: formatRecurringUsDate(today),
    nextDate: formatRecurringUsDate(next),
  };
}

export function advanceRecurringDates(
  nextDate: string,
  interval: string,
): { previousDate: string; nextDate: string } {
  const current = parseRecurringUsDate(nextDate) ?? new Date();
  const advanced = computeNextRecurringDate(current, interval);
  return {
    previousDate: nextDate,
    nextDate: formatRecurringUsDate(advanced),
  };
}

export function frequencyLabelToInterval(
  frequency: "Weekly" | "Monthly" | "Quarterly" | "Yearly",
): RecurringInterval {
  switch (frequency) {
    case "Weekly":
      return "Weekly";
    case "Monthly":
      return "Every Month";
    case "Quarterly":
      return "Every 3 Months";
    case "Yearly":
      return "Every Year";
    default:
      return "Every Month";
  }
}
