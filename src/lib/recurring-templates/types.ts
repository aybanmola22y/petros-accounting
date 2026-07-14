import type { MockRecurringTemplate } from "@/lib/mock-data/recurring-transactions";

export type RecurringTemplateRow = {
  id: string;
  template_name: string;
  schedule_type: string;
  txn_type: string;
  interval_label: string;
  previous_date: string;
  next_date: string;
  customer_supplier: string;
  amount: number | string;
  location: string | null;
  details: Record<string, unknown> | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RecurringTemplateInsert = {
  template_name: string;
  schedule_type: string;
  txn_type: string;
  interval_label: string;
  previous_date: string;
  next_date: string;
  customer_supplier: string;
  amount: number;
  location?: string | null;
  details?: Record<string, unknown> | null;
  sort_order?: number;
};

export function recurringTemplateRowToMock(row: RecurringTemplateRow): MockRecurringTemplate {
  return {
    id: row.id,
    templateName: row.template_name.trim(),
    scheduleType: row.schedule_type as MockRecurringTemplate["scheduleType"],
    txnType: row.txn_type as MockRecurringTemplate["txnType"],
    interval: row.interval_label.trim(),
    previousDate: row.previous_date.trim(),
    nextDate: row.next_date.trim(),
    customerSupplier: row.customer_supplier.trim(),
    amount: Number(row.amount) || 0,
    location: row.location?.trim() || undefined,
    details: row.details ?? null,
  };
}

export function mockRecurringTemplateToInsert(
  template: Omit<MockRecurringTemplate, "id"> & { sortOrder?: number },
): RecurringTemplateInsert {
  return {
    template_name: template.templateName.trim(),
    schedule_type: template.scheduleType,
    txn_type: template.txnType,
    interval_label: template.interval,
    previous_date: template.previousDate,
    next_date: template.nextDate,
    customer_supplier: template.customerSupplier.trim(),
    amount: template.amount,
    location: template.location ?? null,
    details: template.details ?? null,
    sort_order: template.sortOrder,
  };
}
