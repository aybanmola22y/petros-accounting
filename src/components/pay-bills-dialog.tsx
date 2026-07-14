"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  MessageSquare,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  chartAccountDisplayBalance,
  filterPaymentAccounts,
  getActiveChartAccountsSorted,
  getChartAccountsSnapshot,
  getUnpaidBillsSnapshot,
  payUnpaidBills,
  subscribeMockStore,
} from "@/lib/mock-data";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";
import { cn } from "@/lib/utils";

function todayFormatted() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatPayBillsPHP(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `PHP${formatted}`;
}

function randomReferenceNumber() {
  const segment = (len: number) =>
    Array.from({ length: len }, () =>
      "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789".charAt(Math.floor(Math.random() * 36)),
    ).join("");
  return `${segment(8)} ${segment(3)}`;
}

type BillRowState = {
  selected: boolean;
  creditApplied: number;
  payment: number;
};

function StatusCell({ bill }: { bill: UnpaidBill }) {
  const isOverdue = bill.statusType === "overdue";
  return (
    <div className="flex items-start gap-2">
      {isOverdue ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      ) : (
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div>
        <p
          className={cn(
            "text-sm font-medium",
            isOverdue ? "text-amber-700" : "text-muted-foreground",
          )}
        >
          {isOverdue ? "Overdue" : "Due later"}
        </p>
        <p className="text-xs text-muted-foreground">{bill.statusDetail}</p>
      </div>
    </div>
  );
}

type PayBillsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPayee: (bill: UnpaidBill) => void;
};

const PAGE_SIZE = 7;
const EMPTY_UNPAID_BILLS: UnpaidBill[] = [];

export function PayBillsDialog({ open, onOpenChange, onSelectPayee }: PayBillsDialogProps) {
  const { toast } = useToast();
  const chartAccounts = useSyncExternalStore(
    subscribeMockStore,
    getChartAccountsSnapshot,
    getChartAccountsSnapshot,
  );
  const unpaidBills = useSyncExternalStore(
    subscribeMockStore,
    getUnpaidBillsSnapshot,
    () => EMPTY_UNPAID_BILLS,
  );

  const paymentAccounts = useMemo(
    () => filterPaymentAccounts(getActiveChartAccountsSorted(chartAccounts)),
    [chartAccounts],
  );

  const defaultAccountId = useMemo(() => {
    const cashOnHand = paymentAccounts.find((a) => a.name === "Cash on hand");
    return cashOnHand?.id ?? paymentAccounts[0]?.id ?? "";
  }, [paymentAccounts]);

  const [paymentAccountId, setPaymentAccountId] = useState(defaultAccountId);
  const [paymentDate, setPaymentDate] = useState(todayFormatted());
  const [referenceNumber, setReferenceNumber] = useState(() => randomReferenceNumber());
  const [currency, setCurrency] = useState("PHP");
  const [showDateFilter, setShowDateFilter] = useState(true);
  const [page, setPage] = useState(1);
  const [rowState, setRowState] = useState<Record<string, BillRowState>>({});

  useEffect(() => {
    if (!open) return;
    setPaymentAccountId(defaultAccountId);
    setPaymentDate(todayFormatted());
    setReferenceNumber(randomReferenceNumber());
    setPage(1);
    setRowState(
      Object.fromEntries(
        unpaidBills.map((bill) => [
          bill.id,
          { selected: false, creditApplied: 0, payment: 0 },
        ]),
      ),
    );
  }, [open, defaultAccountId, unpaidBills]);

  const selectedAccount = paymentAccounts.find((a) => a.id === paymentAccountId);
  const balanceHint = selectedAccount ? chartAccountDisplayBalance(selectedAccount) : null;

  const totalPages = Math.max(1, Math.ceil(unpaidBills.length / PAGE_SIZE));
  const pageItems = unpaidBills.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = unpaidBills.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, unpaidBills.length);

  const allPageSelected =
    pageItems.length > 0 &&
    pageItems.every((bill) => rowState[bill.id]?.selected ?? false);

  function getRow(billId: string): BillRowState {
    return rowState[billId] ?? { selected: false, creditApplied: 0, payment: 0 };
  }

  function updateRow(billId: string, patch: Partial<BillRowState>) {
    setRowState((prev) => ({
      ...prev,
      [billId]: { ...getRow(billId), ...patch },
    }));
  }

  function toggleAllOnPage() {
    const nextSelected = !allPageSelected;
    setRowState((prev) => {
      const next = { ...prev };
      for (const bill of pageItems) {
        const current = next[bill.id] ?? { selected: false, creditApplied: 0, payment: 0 };
        next[bill.id] = {
          ...current,
          selected: nextSelected,
          payment: nextSelected ? bill.openBalance : 0,
        };
      }
      return next;
    });
  }

  function rowTotal(bill: UnpaidBill): number {
    const row = getRow(bill.id);
    return Math.max(0, row.payment - row.creditApplied);
  }

  const columnTotals = useMemo(() => {
    return unpaidBills.reduce(
      (acc, bill) => {
        const row = rowState[bill.id] ?? { selected: false, creditApplied: 0, payment: 0 };
        acc.openBalance += bill.openBalance;
        acc.creditApplied += bill.creditAvailable ? row.creditApplied : 0;
        acc.payment += row.payment;
        acc.total += rowTotal(bill);
        return acc;
      },
      { openBalance: 0, creditApplied: 0, payment: 0, total: 0 },
    );
  }, [unpaidBills, rowState]);

  const totalPaymentAmount = columnTotals.total;

  function handleSave() {
    const payments = unpaidBills
      .map((bill) => {
        const amount = rowTotal(bill);
        if (amount <= 0) return null;
        return { billId: bill.id, paidAmount: amount, paidDate: paymentDate };
      })
      .filter((payment): payment is NonNullable<typeof payment> => payment !== null);

    if (payments.length === 0) {
      toast({
        title: "No payments entered",
        description: "Select bills and enter payment amounts before saving.",
        variant: "destructive",
      });
      return;
    }

    payUnpaidBills(payments);
    toast({
      title: "Payments saved",
      description: `${formatPayBillsPHP(totalPaymentAmount)} recorded from ${selectedAccount?.name ?? "account"}.`,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(920px,96vh)] max-h-[96vh] w-[calc(100vw-2.5rem)] max-w-[calc(100vw-2.5rem)] flex-col gap-0 overflow-hidden border bg-background p-0 shadow-xl sm:max-w-[calc(100vw-2.5rem)] [&>button:last-child]:hidden">
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-3">
          <DialogTitle className="text-xl font-semibold tracking-tight">Pay Bills</DialogTitle>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
              <HelpCircle className="h-5 w-5" />
              <span className="sr-only">Help</span>
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </div>

        <div className="shrink-0 border-b px-6 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-normal text-muted-foreground">Payment account</Label>
                <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {balanceHint != null ? (
                  <p className="text-sm tabular-nums text-foreground">
                    Balance: {formatPayBillsPHP(balanceHint)}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-normal text-muted-foreground">Payment date</Label>
                <div className="relative">
                  <Input
                    className="h-10 bg-background pr-10"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    placeholder="MM/DD/YYYY"
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-normal text-muted-foreground">Reference number</Label>
                <Input
                  className="h-10 bg-background"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-normal text-muted-foreground">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHP">PHP - Philippine Peso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-3 xl:items-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto gap-1.5 px-0 text-muted-foreground hover:bg-transparent"
                onClick={() =>
                  toast({
                    title: "Feedback",
                    description: "Thanks — your feedback helps us improve Pay Bills.",
                  })
                }
              >
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                Give feedback
              </Button>
              <div className="text-left xl:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total payment amount
                </p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground/80">
                  {formatPayBillsPHP(totalPaymentAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
              Filters
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </Button>
            {showDateFilter ? (
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                Last 12 months
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-muted"
                  onClick={() => setShowDateFilter(false)}
                  aria-label="Remove date filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="Settings"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-1">
          <table className="w-full table-fixed text-sm">
            <thead className="sticky top-0 z-10 border-b bg-muted/30">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="w-10 px-4 py-2.5">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleAllOnPage}
                    aria-label="Select all on page"
                  />
                </th>
                <th className="w-[24%] px-4 py-2.5">Payee</th>
                <th className="w-[9%] px-4 py-2.5">Ref no.</th>
                <th className="w-[9%] px-4 py-2.5">Due date</th>
                <th className="w-[14%] px-4 py-2.5">Status</th>
                <th className="w-[11%] px-4 py-2.5 text-right">Open balance</th>
                <th className="w-[11%] px-4 py-2.5 text-right">Credit applied</th>
                <th className="w-[11%] px-4 py-2.5 text-right">Payment</th>
                <th className="w-[11%] px-4 py-2.5 text-right">Total amount</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((bill, index) => {
                const row = getRow(bill.id);
                return (
                  <tr
                    key={bill.id}
                    className={cn(
                      "border-b border-border/50",
                      index % 2 === 0 ? "bg-background" : "bg-muted/10",
                    )}
                  >
                    <td className="px-4 py-2 align-middle">
                      <Checkbox
                        checked={row.selected}
                        onCheckedChange={(checked) =>
                          updateRow(bill.id, {
                            selected: checked === true,
                            payment: checked === true ? bill.openBalance : 0,
                          })
                        }
                        aria-label={`Select ${bill.supplier}`}
                      />
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <button
                        type="button"
                        className="text-left font-medium text-primary hover:underline"
                        onClick={() => {
                          onSelectPayee(bill);
                          onOpenChange(false);
                        }}
                      >
                        {bill.supplier}
                      </button>
                    </td>
                    <td className="px-4 py-2 align-middle text-muted-foreground">
                      {bill.billNo ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 align-middle text-muted-foreground">
                      {bill.dueDate}
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <StatusCell bill={bill} />
                    </td>
                    <td className="px-4 py-2 text-right align-middle tabular-nums font-medium">
                      {formatPayBillsPHP(bill.openBalance)}
                    </td>
                    <td className="px-4 py-2 text-right align-middle">
                      {bill.creditAvailable ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="ml-auto h-8 w-full max-w-7.5rem bg-background text-right tabular-nums"
                          value={row.creditApplied || ""}
                          onChange={(e) =>
                            updateRow(bill.id, {
                              creditApplied: Number.parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not available</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right align-middle">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="ml-auto h-8 w-full max-w-7.5rem bg-background text-right tabular-nums"
                        value={row.payment || ""}
                        onChange={(e) =>
                          updateRow(bill.id, {
                            payment: Number.parseFloat(e.target.value) || 0,
                            selected: Number.parseFloat(e.target.value) > 0,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right align-middle tabular-nums font-medium">
                      {formatPayBillsPHP(rowTotal(bill))}
                    </td>
                  </tr>
                );
              })}

              <tr className="border-t-2 bg-muted/20 font-semibold">
                <td className="px-4 py-2.5" colSpan={5}>
                  Total (PHP)
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatPayBillsPHP(columnTotals.openBalance)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatPayBillsPHP(columnTotals.creditApplied)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatPayBillsPHP(columnTotals.payment)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatPayBillsPHP(columnTotals.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-4 border-t px-6 py-2 text-sm text-muted-foreground">
          <button
            type="button"
            className="hover:text-foreground disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage(1)}
          >
            First
          </button>
          <button
            type="button"
            className="hover:text-foreground disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="tabular-nums">
            {rangeStart} - {rangeEnd} of {unpaidBills.length}
          </span>
          <button
            type="button"
            className="hover:text-foreground disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
          <button
            type="button"
            className="hover:text-foreground disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            Last
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t px-6 py-3">
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-0 text-emerald-700 hover:bg-transparent hover:text-emerald-800"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <div className="inline-flex">
            <Button
              type="button"
              className="rounded-r-none bg-emerald-600 px-5 text-white hover:bg-emerald-700"
              onClick={handleSave}
            >
              Save
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  className="rounded-l-none border-l border-emerald-500/40 bg-emerald-600 px-2 text-white hover:bg-emerald-700"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSave}>Save</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    handleSave();
                  }}
                >
                  Save and close
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
