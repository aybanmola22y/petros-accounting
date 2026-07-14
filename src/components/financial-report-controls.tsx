"use client";

import { CompareToSelect } from "@/components/compare-to-select";
import { ReportDateField } from "@/components/report-date-field";
import { ReportPeriodSelect } from "@/components/report-period-select";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DISPLAY_COLUMNS_OPTIONS,
  type AccountingMethod,
  type CompareToSelection,
  type DisplayColumnsBy,
} from "@/lib/financial-report-utils";
import type { ReportRangePeriod } from "@/lib/report-date-utils";

type FinancialReportControlsProps = {
  period: ReportRangePeriod;
  fromDate: Date;
  toDate: Date;
  accountingMethod: AccountingMethod;
  displayColumnsBy: DisplayColumnsBy;
  compareTo: CompareToSelection;
  onPeriodChange: (period: ReportRangePeriod) => void;
  onFromDateChange: (date: Date) => void;
  onToDateChange: (date: Date) => void;
  onAccountingMethodChange: (method: AccountingMethod) => void;
  onDisplayColumnsByChange: (value: DisplayColumnsBy) => void;
  onCompareToChange: (value: CompareToSelection) => void;
};

export function FinancialReportControls(props: FinancialReportControlsProps) {
  const {
    period,
    fromDate,
    toDate,
    accountingMethod,
    displayColumnsBy,
    compareTo,
    onPeriodChange,
    onFromDateChange,
    onToDateChange,
    onAccountingMethodChange,
    onDisplayColumnsByChange,
    onCompareToChange,
  } = props;

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-3 gap-y-3">
      <ReportPeriodSelect
        value={period}
        onChange={onPeriodChange}
        className="w-11rem min-w-11rem shrink-0"
      />

      <ReportDateField
        label="From"
        value={fromDate}
        onChange={onFromDateChange}
        onDatePicked={() => onPeriodChange("Custom dates")}
      />

      <ReportDateField
        label="To"
        value={toDate}
        onChange={onToDateChange}
        onDatePicked={() => onPeriodChange("Custom dates")}
      />

      <div className="flex shrink-0 flex-col gap-1.5">
        <Label className="text-xs font-normal text-muted-foreground">Accounting method</Label>
        <ToggleGroup
          type="single"
          value={accountingMethod}
          onValueChange={(v) => {
            if (v === "Cash" || v === "Accrual") onAccountingMethodChange(v);
          }}
          className="h-9 rounded-md border bg-background p-0.5 shadow-sm"
        >
          <ToggleGroupItem
            value="Cash"
            className="h-8 rounded-sm px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            Cash
          </ToggleGroupItem>
          <ToggleGroupItem
            value="Accrual"
            className="h-8 rounded-sm px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            Accrual
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex w-9.5rem min-w-9.5rem shrink-0 flex-col gap-1.5">
        <Label className="text-xs font-normal text-muted-foreground">Display columns by</Label>
        <Select
          value={displayColumnsBy === "none" ? undefined : displayColumnsBy}
          onValueChange={(v) => onDisplayColumnsByChange(v as DisplayColumnsBy)}
        >
          <SelectTrigger className="h-9 w-full bg-background shadow-sm">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent align="start" position="popper" className="min-w-10rem">
            {DISPLAY_COLUMNS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CompareToSelect
        value={compareTo}
        onChange={onCompareToChange}
        className="shrink-0"
      />
    </div>
  );
}

/** @deprecated Use FinancialReportControls */
export const BalanceSheetReportControls = FinancialReportControls;
