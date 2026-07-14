"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  HelpCircle,
  MessageSquare,
  Paperclip,
  Search,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChartAccountDepositSelect } from "@/components/chart-account-deposit-select";
import { useToast } from "@/hooks/use-toast";
import {
  getActiveChartAccountsSorted,
  getChartAccountsSnapshot,
  getPaymentMethodsSnapshot,
  getReceivablesSnapshot,
  subscribeMockStore,
} from "@/lib/mock-data";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

export type ReceivePaymentLine = {
  id: string;
  description: string;
  dueDate: string;
  originalAmount: number;
  openBalance: number;
  payment: number;
  selected: boolean;
};

export type ReceivePaymentFormValues = {
  customerId: string;
  email: string;
  sendLater: boolean;
  paymentDate: string;
  paymentMethod: string;
  referenceNo: string;
  depositToId: string;
  amountReceived: number;
  memo: string;
  lines: ReceivePaymentLine[];
};

type CustomerOption = {
  id: string;
  name: string;
  email?: string;
  openBalance?: number;
};

type ReceivePaymentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerOption[];
  prefill?: ReceivePaymentFormValues | null;
  /** When false, form stays editable but only Close is shown (View mode). */
  canSave?: boolean;
  onSave?: (values: ReceivePaymentFormValues) => void;
};

function todayFormatted() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function defaultFormState(
  customers: CustomerOption[],
  depositAccountId: string,
): ReceivePaymentFormValues {
  return {
    customerId: customers[0]?.id ?? "",
    email: customers[0]?.email ?? "",
    sendLater: false,
    paymentDate: todayFormatted(),
    paymentMethod: "Cash",
    referenceNo: "",
    depositToId: depositAccountId,
    amountReceived: 0,
    memo: "",
    lines: [],
  };
}

export function ReceivePaymentFormDialog({
  open,
  onOpenChange,
  customers,
  prefill = null,
  canSave = true,
  onSave,
}: ReceivePaymentFormDialogProps) {
  const { toast } = useToast();
  const prefillAppliedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<{ name: string; size: number }[]>([]);
  const [showExistingAttachments, setShowExistingAttachments] = useState(false);

  const chartAccounts = useSyncExternalStore(
    subscribeMockStore,
    getChartAccountsSnapshot,
    getChartAccountsSnapshot,
  );
  const paymentMethods = useSyncExternalStore(
    subscribeMockStore,
    getPaymentMethodsSnapshot,
    getPaymentMethodsSnapshot,
  );
  const receivables = useSyncExternalStore(
    subscribeMockStore,
    getReceivablesSnapshot,
    getReceivablesSnapshot,
  );

  const depositAccounts = useMemo(
    () => getActiveChartAccountsSorted(chartAccounts),
    [chartAccounts],
  );
  const defaultDepositId = depositAccounts[0]?.id ?? "";

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [form, setForm] = useState(() =>
    prefill
      ? { ...prefill, depositToId: prefill.depositToId || defaultDepositId }
      : defaultFormState(customers, defaultDepositId),
  );

  useEffect(() => {
    if (open) {
      if (prefill && !prefillAppliedRef.current) {
        const depositToId =
          prefill.depositToId &&
          depositAccounts.some((a) => a.id === prefill.depositToId)
            ? prefill.depositToId
            : depositAccounts[0]?.id ?? prefill.depositToId ?? defaultDepositId;
        setForm({
          ...prefill,
          depositToId,
        });
        prefillAppliedRef.current = true;
      } else if (!prefill) {
        setForm(defaultFormState(customers, defaultDepositId));
      }
    } else {
      prefillAppliedRef.current = false;
      setInvoiceSearch("");
      setAttachments([]);
      setShowExistingAttachments(false);
      setForm(defaultFormState(customers, defaultDepositId));
    }
  }, [open, prefill, customers, defaultDepositId, depositAccounts]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === form.customerId),
    [customers, form.customerId],
  );

  const customerBalance = selectedCustomer?.openBalance ?? 0;

  const filteredLines = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return form.lines;
    return form.lines.filter((l) => l.description.toLowerCase().includes(q));
  }, [form.lines, invoiceSearch]);

  const amountToApply = useMemo(
    () =>
      form.lines
        .filter((l) => l.selected)
        .reduce((sum, l) => sum + (Number(l.payment) || 0), 0),
    [form.lines],
  );

  const amountToCredit = Math.max(0, form.amountReceived - amountToApply);

  function updateLine(id: string, patch: Partial<ReceivePaymentLine>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }

  function clearPayments() {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => ({ ...l, payment: 0, selected: false })),
    }));
  }

  function handleCustomerChange(customerId: string) {
    const customer = customers.find((c) => c.id === customerId);
    const openInvoices = receivables.invoices.filter(
      (inv) =>
        inv.customerId === customerId &&
        inv.balanceDue > 0 &&
        inv.kind !== "paid",
    );
    setForm((prev) => ({
      ...prev,
      customerId,
      email: customer?.email ?? "",
      lines: openInvoices.map((inv) => ({
        id: inv.id,
        description: `Invoice ${inv.number}`,
        dueDate: inv.date,
        originalAmount: inv.amount,
        openBalance: inv.balanceDue,
        payment: 0,
        selected: false,
      })),
    }));
  }

  function handleAttachments(files: FileList | null) {
    if (!files?.length) return;
    const added = Array.from(files).map((f) => ({ name: f.name, size: f.size }));
    setAttachments((prev) => [...prev, ...added]);
    toast({
      title: "Attachments added",
      description: `${added.length} file${added.length === 1 ? "" : "s"} attached.`,
    });
  }

  function handleSave(closeAfter: boolean) {
    if (!canSave) return;
    if (!form.customerId) {
      toast({
        title: "Customer required",
        description: "Select a customer for this payment.",
        variant: "destructive",
      });
      return;
    }
    if (form.amountReceived <= 0) {
      toast({
        title: "Amount required",
        description: "Enter the amount received.",
        variant: "destructive",
      });
      return;
    }
    onSave?.(form);
    if (closeAfter) onOpenChange(false);
    else toast({ title: "Payment saved", description: formatPHP(form.amountReceived) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[98vh] flex-col gap-0 overflow-hidden p-0",
          "h-[min(900px,98vh)] w-[min(1280px,98vw)] max-w-[min(1280px,98vw)]",
          "[&>button]:hidden",
        )}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 border-b px-5 py-4">
          <DialogTitle className="text-lg font-semibold pt-0.5">
            {canSave ? "Receive Payment" : "View payment"}
          </DialogTitle>
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="hidden sm:block text-right min-w-[200px] border-l border-border/60 pl-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Amount received
              </p>
              <p className="text-2xl font-semibold tabular-nums leading-tight pb-3">
                {formatPHP(form.amountReceived)}
              </p>
              <p className="text-xs text-muted-foreground pt-2.5 border-t border-border/60">
                Customer balance {formatPHP(customerBalance)}
              </p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Help">
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Feedback">
                <MessageSquare className="h-4 w-4" />
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex h-5 items-center justify-between gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">Customer</Label>
                  <span className="text-xs invisible shrink-0 select-none" aria-hidden>
                    Cc/Bcc
                  </span>
                </div>
                <Select value={form.customerId} onValueChange={handleCustomerChange}>
                  <SelectTrigger className="h-10 w-full py-0">
                    <SelectValue placeholder="Choose a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex h-6 items-center" aria-hidden />
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex h-5 items-center justify-between gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                  <button type="button" className="text-xs text-primary hover:underline shrink-0">
                    Cc/Bcc
                  </button>
                </div>
                <Input
                  className="h-10 w-full py-0"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                <label className="flex h-6 items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={form.sendLater}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, sendLater: v === true }))
                    }
                  />
                  Send later
                </label>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 lg:gap-4">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Payment date</Label>
                <Input
                  className="h-10 py-0"
                  value={form.paymentDate}
                  onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Payment method</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}
                >
                  <SelectTrigger className="h-10 w-full py-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m.id} value={m.name}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Reference no.</Label>
                <Input
                  className="h-10 py-0"
                  value={form.referenceNo}
                  onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Deposit To</Label>
                <ChartAccountDepositSelect
                  value={form.depositToId}
                  onValueChange={(v) => setForm((f) => ({ ...f, depositToId: v }))}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Amount received</Label>
                <Input
                  className="h-10 w-full px-3 py-0 tabular-nums font-medium"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amountReceived || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      amountReceived: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8"
                    placeholder="Find Invoice No."
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" className="h-9">
                  Filter
                </Button>
                <Button type="button" variant="link" size="sm" className="h-9 px-2">
                  All
                </Button>
              </div>

              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="w-10 px-3 py-2" />
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">Due date</th>
                      <th className="px-3 py-2 font-medium text-right">Original amount</th>
                      <th className="px-3 py-2 font-medium text-right">Open balance</th>
                      <th className="w-28 px-2 py-2 font-medium text-center">Payment</th>
                      <th className="w-10 px-2 py-2">
                        <Settings2 className="h-4 w-4 opacity-60" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLines.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-muted-foreground"
                        >
                          There are no transactions matching the criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredLines.map((line) => (
                        <tr key={line.id} className="border-b border-border/50">
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={line.selected}
                              onCheckedChange={(v) => {
                                const selected = v === true;
                                updateLine(line.id, {
                                  selected,
                                  payment: selected ? line.openBalance : 0,
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">{line.description}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {line.dueDate}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatPHP(line.originalAmount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatPHP(line.openBalance)}
                          </td>
                          <td className="w-28 px-2 py-1.5">
                            <Input
                              className="mx-auto block h-8 w-28 min-w-0 py-0 px-2 text-sm text-right tabular-nums"
                              type="number"
                              min={0}
                              step="0.01"
                              value={line.payment || ""}
                              onChange={(e) =>
                                updateLine(line.id, {
                                  payment: Number.parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td />
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Memo</Label>
                  <Textarea
                    className="min-h-[72px] resize-y"
                    value={form.memo}
                    onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Attachments</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleAttachments(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground hover:bg-muted/30"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <Paperclip className="h-5 w-5 text-primary" />
                    <span className="text-primary font-medium">Add attachment</span>
                    <span className="text-xs text-muted-foreground">Max file size: 20 MB</span>
                  </div>
                  {attachments.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline w-fit"
                      onClick={() => setShowExistingAttachments((v) => !v)}
                    >
                      {showExistingAttachments ? "Hide existing" : "Show existing"}
                    </button>
                  )}
                  {attachments.length > 0 && (
                    <ul
                      className={cn(
                        "rounded-md border bg-muted/20 px-3 py-2 text-xs space-y-1",
                        !showExistingAttachments && "sr-only",
                      )}
                    >
                      {attachments.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex justify-between gap-2">
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setAttachments((prev) => prev.filter((_, i) => i !== index))
                            }
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 text-sm items-end">
                <dl className="grid grid-cols-[auto_38] gap-x-6 gap-y-2">
                  <dt className="text-muted-foreground whitespace-nowrap">Amount to Apply</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {formatPHP(amountToApply)}
                  </dd>
                  <dt className="text-muted-foreground whitespace-nowrap">Amount to Credit</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {formatPHP(amountToCredit)}
                  </dd>
                </dl>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-emerald-600 text-emerald-700 lg:w-auto"
                  onClick={clearPayments}
                >
                  Clear Payment
                </Button>
                {amountToCredit > 0 && (
                  <p className="text-xs text-muted-foreground text-right max-w-[280px]">
                    This transaction will create an additional credit in the amount of{" "}
                    {formatPHP(amountToCredit)}.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t bg-background px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm">
              Print
            </Button>
            <Button type="button" variant="ghost" size="sm">
              More
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {!canSave ? (
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => handleSave(false)}>
                  Save
                </Button>
                <Button type="button" onClick={() => handleSave(true)}>
                  Save and close
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
