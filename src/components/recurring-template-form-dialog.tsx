"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RECURRING_INTERVAL_OPTIONS,
  RECURRING_LOCATION_FILTER_OPTIONS,
  RECURRING_TEMPLATE_TYPE_OPTIONS,
  type MockRecurringTemplate,
  type RecurringScheduleType,
  type RecurringTransactionType,
} from "@/lib/mock-data/recurring-transactions";

export type RecurringTemplateFormValues = Omit<MockRecurringTemplate, "id">;

type RecurringTemplateFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  txnType: RecurringTransactionType;
  initialValues?: Partial<RecurringTemplateFormValues>;
  onSave: (values: RecurringTemplateFormValues) => void | Promise<void>;
};

const SCHEDULE_TYPES = RECURRING_TEMPLATE_TYPE_OPTIONS.filter(
  (option): option is RecurringScheduleType => option !== "All",
);

const LOCATION_OPTIONS = RECURRING_LOCATION_FILTER_OPTIONS.filter((option) => option !== "All");

function buildDefaults(
  txnType: RecurringTransactionType,
  initialValues?: Partial<RecurringTemplateFormValues>,
): RecurringTemplateFormValues {
  return {
    templateName: initialValues?.templateName ?? `New ${txnType}`,
    scheduleType: initialValues?.scheduleType ?? "Scheduled",
    txnType: initialValues?.txnType ?? txnType,
    interval: initialValues?.interval ?? "Every Month",
    previousDate: initialValues?.previousDate ?? "",
    nextDate: initialValues?.nextDate ?? "",
    customerSupplier: initialValues?.customerSupplier ?? "—",
    amount: initialValues?.amount ?? 0,
    location: initialValues?.location,
  };
}

export function RecurringTemplateFormDialog({
  open,
  onOpenChange,
  mode,
  txnType,
  initialValues,
  onSave,
}: RecurringTemplateFormDialogProps) {
  const [form, setForm] = useState<RecurringTemplateFormValues>(() =>
    buildDefaults(txnType, initialValues),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildDefaults(txnType, initialValues));
    }
  }, [open, txnType, initialValues]);

  async function handleSubmit() {
    if (!form.templateName.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        templateName: form.templateName.trim(),
        customerSupplier: form.customerSupplier.trim() || "—",
        amount: Number(form.amount) || 0,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b px-6 py-5 text-left">
          <DialogTitle className="text-xl font-semibold">
            {mode === "create" ? "New recurring template" : "Edit recurring template"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {form.txnType} template — set schedule and amount like QuickBooks recurring transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              value={form.templateName}
              onChange={(e) => setForm((current) => ({ ...current, templateName: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.scheduleType}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    scheduleType: value as RecurringScheduleType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Interval</Label>
              <Select
                value={form.interval}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, interval: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_INTERVAL_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="previous-date">Previous date</Label>
              <Input
                id="previous-date"
                placeholder="M/D/YYYY"
                value={form.previousDate}
                onChange={(e) =>
                  setForm((current) => ({ ...current, previousDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-date">Next date</Label>
              <Input
                id="next-date"
                placeholder="M/D/YYYY"
                value={form.nextDate}
                onChange={(e) => setForm((current) => ({ ...current, nextDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-supplier">Customer / Supplier</Label>
            <Input
              id="customer-supplier"
              value={form.customerSupplier}
              onChange={(e) =>
                setForm((current) => ({ ...current, customerSupplier: e.target.value }))
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm((current) => ({ ...current, amount: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={form.location ?? "Unspecified"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    location: value === "Unspecified" ? undefined : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {LOCATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={saving || !form.templateName.trim()}
            onClick={() => void handleSubmit()}
          >
            {mode === "create" ? "Save template" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
