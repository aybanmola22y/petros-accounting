"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { ReportDateField } from "@/components/report-date-field";
import { ReportPeriodSelect } from "@/components/report-period-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useChartAccounts } from "@/hooks/use-chart-accounts";
import { useMockExpenses } from "@/hooks/use-mock-expenses";
import { useToast } from "@/hooks/use-toast";
import {
  EXPENSE_DETAIL_BASIS_PARAM,
  EXPENSE_DETAIL_PERIOD_PARAM,
} from "@/lib/expense-navigation";
import { computeExpenseTransactionDetailByAccount } from "@/lib/ledger/compute-transaction-detail-by-account";
import { dashboardLedgerAnchor } from "@/lib/ledger/dashboard-ledger-anchor";
import {
  expenseDashboardPeriodLabel,
  type ExpenseDashboardPeriod,
} from "@/lib/ledger/expense-dashboard-periods";
import {
  isTransactionDetailReportPeriod,
  resolveTransactionDetailReportRange,
  TRANSACTION_DETAIL_REPORT_PERIOD_OPTIONS,
} from "@/lib/ledger/transaction-detail-report-range";
import type { AccountingBasis } from "@/lib/ledger/types";
import {
  formatReportRangeLabel,
  startOfDay,
  type ReportRangePeriod,
} from "@/lib/report-date-utils";
import {
  getChartAccountsSnapshot,
  getExpensesSnapshot,
  subscribeMockStore,
} from "@/lib/mock-data";
import {
  ReportChrome,
  ReportToolbar,
  formatPHP,
  printReport,
} from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

const TABLE_COLUMNS = [
  { key: "date", label: "Transaction date", align: "left" as const, width: "9%" },
  { key: "type", label: "Transaction type", align: "left" as const, width: "9%" },
  { key: "number", label: "Number", align: "left" as const, width: "7%" },
  { key: "name", label: "Name", align: "left" as const, width: "13%" },
  { key: "location", label: "Location full name", align: "left" as const, width: "13%" },
  { key: "className", label: "Class full name", align: "left" as const, width: "8%" },
  { key: "description", label: "Description", align: "left" as const, width: "13%" },
  { key: "split", label: "Split", align: "left" as const, width: "9%" },
  { key: "amount", label: "Amount", align: "right" as const, width: "9.5%" },
  { key: "balance", label: "Balance", align: "right" as const, width: "9.5%" },
] as const;

function parseBasis(value: string | null): AccountingBasis | null {
  return value === "Cash" || value === "Accrual" ? value : null;
}

function AccountGroupSection({
  accountName,
  count,
  total,
  open,
  onToggle,
  children,
}: {
  accountName: string;
  count: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="bg-muted/40 border-b">
        <td colSpan={TABLE_COLUMNS.length} className="p-0">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold hover:bg-muted/60 transition-colors"
          >
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{accountName}</span>
            <span className="text-muted-foreground font-normal">({count})</span>
          </button>
        </td>
      </tr>
      {open ? children : null}
      <tr className="bg-muted/25 border-b font-semibold">
        <td colSpan={8} className="px-4 py-2.5 text-sm">
          Total for {accountName}
        </td>
        <td className="px-3 py-2.5 text-sm text-right tabular-nums whitespace-nowrap">
          {formatPHP(total)}
        </td>
        <td className="px-3 py-2.5 text-sm text-right tabular-nums text-muted-foreground">
          —
        </td>
      </tr>
    </>
  );
}

export function TransactionDetailByAccountReport({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  useMockExpenses();
  useChartAccounts();
  const expenses = useSyncExternalStore(
    subscribeMockStore,
    getExpensesSnapshot,
    getExpensesSnapshot,
  );
  const chartAccounts = useSyncExternalStore(
    subscribeMockStore,
    getChartAccountsSnapshot,
    getChartAccountsSnapshot,
  );

  const anchor = dashboardLedgerAnchor();
  const urlPeriod = searchParams.get(EXPENSE_DETAIL_PERIOD_PARAM);
  const urlBasis = searchParams.get(EXPENSE_DETAIL_BASIS_PARAM);

  const initialPeriod: ReportRangePeriod = isTransactionDetailReportPeriod(urlPeriod)
    ? urlPeriod
    : "This month";
  const initialRange = resolveTransactionDetailReportRange(
    initialPeriod,
    startOfDay(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    anchor,
    anchor,
  );

  const [period, setPeriod] = useState<ReportRangePeriod>(initialPeriod);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [accountingMethod, setAccountingMethod] = useState<AccountingBasis>(
    () => parseBasis(urlBasis) ?? "Cash",
  );
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [refreshKey, setRefreshKey] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  const range = useMemo(
    () => resolveTransactionDetailReportRange(period, fromDate, toDate, anchor),
    [period, fromDate, toDate, anchor],
  );

  const { groups, grandTotal } = useMemo(() => {
    void refreshKey;
    return computeExpenseTransactionDetailByAccount(
      expenses,
      range,
      chartAccounts,
      accountingMethod,
    );
  }, [expenses, range, chartAccounts, accountingMethod, refreshKey]);

  const dateLabel = useMemo(() => {
    if (period === "Custom dates") {
      return formatReportRangeLabel(range);
    }
    if (isTransactionDetailReportPeriod(period)) {
      return expenseDashboardPeriodLabel(period as ExpenseDashboardPeriod, range).replace(
        /^Spending for /,
        "",
      );
    }
    return formatReportRangeLabel(range);
  }, [period, range]);

  useEffect(() => {
    setCollapsedGroups(new Set());
  }, [period, fromDate, toDate, accountingMethod]);

  const handlePeriodChange = (next: ReportRangePeriod) => {
    setPeriod(next);
    if (next === "Custom dates") return;
    const resolved = resolveTransactionDetailReportRange(next, fromDate, toDate, anchor);
    setFromDate(resolved.from);
    setToDate(resolved.to);
  };

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    toast({ title: "Report refreshed", description: dateLabel });
  }, [dateLabel, toast]);

  const handleEmail = useCallback(() => {
    const lines = groups.flatMap((g) =>
      g.rows.map(
        (r) =>
          `${r.date}\t${r.type}\t${r.number}\t${r.name}\t${r.description}\t${r.amount}`,
      ),
    );
    const subject = encodeURIComponent(`Transaction Detail by Account — ${dateLabel}`);
    const body = encodeURIComponent(
      `Transaction Detail by Account\n${dateLabel}\n${accountingMethod} basis\n\n${lines.join("\n")}\n\nTOTAL\t${grandTotal}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    toast({ title: "Opening email", description: "Your email client should open with the report." });
  }, [accountingMethod, dateLabel, grandTotal, groups, toast]);

  const allExpanded = groups.length > 0 && collapsedGroups.size === 0;
  const rowPadding = density === "compact" ? "py-2" : "py-3";
  const rowText = density === "compact" ? "text-xs" : "text-sm";

  return (
    <div className={cn("space-y-4 print:space-y-0", embedded && "p-4 md:p-6")}>
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href="/reports/custom"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Back to reports
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              type="button"
              onClick={() =>
                toast({
                  title: "Customise",
                  description: "Column and grouping options will be available in a future update.",
                })
              }
            >
              <Settings2 className="h-3.5 w-3.5" />
              Customise
            </Button>
            <Button
              size="sm"
              className="h-8 bg-emerald-700 hover:bg-emerald-800"
              type="button"
              onClick={() =>
                toast({
                  title: "Report saved",
                  description: `Saved "${dateLabel}" on ${accountingMethod} basis.`,
                })
              }
            >
              Save As
            </Button>
          </div>
        </div>
      ) : null}

      <ReportToolbar
        onRefresh={handleRefresh}
        onEmail={handleEmail}
        onPrint={printReport}
        filters={
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-3 gap-y-3">
            <ReportPeriodSelect
              value={period}
              onChange={handlePeriodChange}
              periods={TRANSACTION_DETAIL_REPORT_PERIOD_OPTIONS}
              className="w-11rem min-w-11rem shrink-0"
            />
            <ReportDateField
              label="From"
              value={fromDate}
              onChange={(date) => {
                const nextFrom = startOfDay(date);
                setFromDate(nextFrom);
                setPeriod("Custom dates");
                if (nextFrom.getTime() > toDate.getTime()) {
                  setToDate(nextFrom);
                }
              }}
              onDatePicked={() => setPeriod("Custom dates")}
            />
            <ReportDateField
              label="To"
              value={toDate}
              onChange={(date) => {
                const nextTo = startOfDay(date);
                setToDate(nextTo);
                setPeriod("Custom dates");
                if (nextTo.getTime() < fromDate.getTime()) {
                  setFromDate(nextTo);
                }
              }}
              onDatePicked={() => setPeriod("Custom dates")}
            />
            <div className="flex shrink-0 flex-col gap-1.5">
              <Label className="text-xs font-normal text-muted-foreground">
                Accounting method
              </Label>
              <ToggleGroup
                type="single"
                value={accountingMethod}
                onValueChange={(v) => {
                  if (v === "Cash" || v === "Accrual") setAccountingMethod(v);
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
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3 print:hidden">
        <Select
          value={density}
          onValueChange={(v) => setDensity(v as "compact" | "comfortable")}
        >
          <SelectTrigger className="h-8 w-[120px] bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="comfortable">Comfortable</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          type="button"
          onClick={() => {
            if (allExpanded) {
              setCollapsedGroups(new Set(groups.map((g) => g.accountName)));
            } else {
              setCollapsedGroups(new Set());
            }
          }}
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </Button>
      </div>

      <ReportChrome
        reportTitle="Transaction Detail by Account"
        dateLabel={dateLabel}
        footerBasis={accountingMethod}
      >
        <div className="report-print-table overflow-x-hidden">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              {TABLE_COLUMNS.map((col) => (
                <col key={col.key} style={{ width: col.width }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/30">
                {TABLE_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    title={col.label}
                    className={cn(
                      "px-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground truncate",
                      col.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td
                    colSpan={TABLE_COLUMNS.length}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No transactions for this period.
                  </td>
                </tr>
              ) : (
                groups.map((group) => {
                  const open = !collapsedGroups.has(group.accountName);
                  return (
                    <AccountGroupSection
                      key={group.accountName}
                      accountName={group.accountName}
                      count={group.rows.length}
                      total={group.total}
                      open={open}
                      onToggle={() => {
                        setCollapsedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.accountName)) {
                            next.delete(group.accountName);
                          } else {
                            next.add(group.accountName);
                          }
                          return next;
                        });
                      }}
                    >
                      {group.rows.map((row, index) => (
                        <tr
                          key={row.id}
                          className={cn(
                            "border-b hover:bg-muted/20",
                            index % 2 === 0 ? "bg-background" : "bg-muted/10",
                            rowText,
                          )}
                        >
                          <td
                            className={cn("px-2 tabular-nums truncate", rowPadding)}
                            title={row.date}
                          >
                            {row.date}
                          </td>
                          <td className={cn("px-2 truncate", rowPadding)} title={row.type}>
                            {row.type}
                          </td>
                          <td
                            className={cn("px-2 tabular-nums truncate", rowPadding)}
                            title={row.number}
                          >
                            {row.number}
                          </td>
                          <td className={cn("px-2 truncate", rowPadding)} title={row.name}>
                            {row.name}
                          </td>
                          <td className={cn("px-2 truncate", rowPadding)} title={row.location}>
                            {row.location}
                          </td>
                          <td
                            className={cn("px-2 truncate", rowPadding)}
                            title={row.className || "—"}
                          >
                            {row.className || "—"}
                          </td>
                          <td
                            className={cn("px-2 truncate", rowPadding)}
                            title={row.description}
                          >
                            {row.description}
                          </td>
                          <td className={cn("px-2 truncate", rowPadding)} title={row.split}>
                            {row.split}
                          </td>
                          <td
                            className={cn(
                              "px-2 text-right tabular-nums truncate font-medium",
                              rowPadding,
                            )}
                            title={formatPHP(row.amount)}
                          >
                            {formatPHP(row.amount)}
                          </td>
                          <td
                            className={cn(
                              "px-2 text-right tabular-nums truncate text-muted-foreground",
                              rowPadding,
                            )}
                            title={formatPHP(row.balance)}
                          >
                            {formatPHP(row.balance)}
                          </td>
                        </tr>
                      ))}
                    </AccountGroupSection>
                  );
                })
              )}
              {groups.length > 0 && (
                <tr className="border-t-2 bg-muted/30 font-bold">
                  <td colSpan={8} className="px-4 py-3 text-sm uppercase tracking-wide">
                    Total
                  </td>
                  <td className="px-3 py-3 text-sm text-right tabular-nums">
                    {formatPHP(grandTotal)}
                  </td>
                  <td className="px-3 py-3" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ReportChrome>
    </div>
  );
}
