"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { useChartAccounts } from "@/hooks/use-chart-accounts";
import {
  createBankFeedLine,
  patchBankTransaction,
  useBankTransactions,
  type BankTransactionRow,
  type BankTransactionTab,
} from "@/hooks/use-bank-transactions";
import { accountQuickReportHref } from "@/lib/account-quick-report-navigation";
import { buildDashboardBankAccountRows } from "@/lib/mock-data/bank-accounts";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatPHP } from "@/views/financial-report-shared";

const TABS: Array<{ id: BankTransactionTab; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "posted", label: "Posted" },
  { id: "excluded", label: "Excluded" },
];

const PAGE_SIZE = 15;

function formatAmount(amount: number): string {
  if (amount === 0) return "—";
  return formatPHP(amount);
}

type AddLineForm = {
  txnDate: string;
  bankDescription: string;
  payeeName: string;
  direction: "deposit" | "payment";
  amount: string;
  categoryLabel: string;
};

export function BankTransactions() {
  const { toast } = useToast();
  const { accounts: chartAccounts, loading: accountsLoading } = useChartAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [tab, setTab] = useState<BankTransactionTab>("posted");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categorizeRow, setCategorizeRow] = useState<BankTransactionRow | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [payeeDraft, setPayeeDraft] = useState("");
  const [addForm, setAddForm] = useState<AddLineForm>({
    txnDate: new Date().toISOString().slice(0, 10),
    bankDescription: "",
    payeeName: "",
    direction: "payment",
    amount: "",
    categoryLabel: "",
  });

  const { data, loading, error, refresh } = useBankTransactions({
    accountId: selectedAccountId,
    tab,
    search,
  });

  useEffect(() => {
    if (selectedAccountId || accountsLoading || chartAccounts.length === 0) return;
    const bankAccounts = buildDashboardBankAccountRows(chartAccounts);
    if (bankAccounts.length > 0) {
      setSelectedAccountId(bankAccounts[0]!.id);
    }
  }, [accountsLoading, chartAccounts, selectedAccountId]);

  useEffect(() => {
    setPage(1);
  }, [tab, search, selectedAccountId]);

  const categoryOptions = useMemo(() => {
    return chartAccounts
      .filter((a) => a.isActive)
      .map((a) => a.name)
      .sort((a, b) => a.localeCompare(b));
  }, [chartAccounts]);

  const transactions = data?.transactions ?? [];
  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const pageRows = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = transactions.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, transactions.length);

  const selectedAccount = data?.account ?? data?.accounts.find((a) => a.id === selectedAccountId);

  async function handlePost(row: BankTransactionRow) {
    if (!selectedAccountId) return;
    setSaving(true);
    try {
      await patchBankTransaction(row.id, {
        accountId: selectedAccountId,
        glRowId: row.glRowId,
        action: "post",
        categoryLabel: row.categoryLabel || categoryDraft,
        payeeName: row.payeeName || payeeDraft,
      });
      toast({ title: "Transaction posted", description: "Added to your books." });
      await refresh();
    } catch (err) {
      toast({
        title: "Could not post",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(row: BankTransactionRow, status: BankTransactionTab) {
    if (!selectedAccountId) return;
    setSaving(true);
    try {
      await patchBankTransaction(row.id, {
        accountId: selectedAccountId,
        glRowId: row.glRowId,
        status,
      });
      toast({
        title: status === "excluded" ? "Transaction excluded" : "Status updated",
      });
      await refresh();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndPost() {
    if (!categorizeRow || !selectedAccountId) return;
    setSaving(true);
    try {
      await patchBankTransaction(categorizeRow.id, {
        accountId: selectedAccountId,
        glRowId: categorizeRow.glRowId,
        action: "post",
        categoryLabel: categoryDraft,
        payeeName: payeeDraft,
      });
      toast({ title: "Posted", description: "Transaction categorized and posted." });
      setCategorizeRow(null);
      await refresh();
    } catch (err) {
      toast({
        title: "Could not post",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }
  async function handleSaveCategory() {
    if (!categorizeRow || !selectedAccountId) return;
    setSaving(true);
    try {
      await patchBankTransaction(categorizeRow.id, {
        accountId: selectedAccountId,
        glRowId: categorizeRow.glRowId,
        categoryLabel: categoryDraft,
        payeeName: payeeDraft,
        status: "pending",
      });
      toast({ title: "Saved", description: "Category and payee updated." });
      setCategorizeRow(null);
      await refresh();
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLine() {
    if (!selectedAccountId) return;
    const amount = Number(addForm.amount);
    if (!addForm.bankDescription.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast({
        title: "Missing fields",
        description: "Description and a positive amount are required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await createBankFeedLine({
        accountId: selectedAccountId,
        txnDate: addForm.txnDate,
        bankDescription: addForm.bankDescription.trim(),
        payeeName: addForm.payeeName.trim(),
        categoryLabel: addForm.categoryLabel.trim(),
        direction: addForm.direction,
        amount,
      });
      toast({ title: "Bank line added", description: "Review it under Pending." });
      setAddOpen(false);
      setTab("pending");
      setAddForm({
        txnDate: new Date().toISOString().slice(0, 10),
        bankDescription: "",
        payeeName: "",
        direction: "payment",
        amount: "",
        categoryLabel: "",
      });
      await refresh();
    } catch (err) {
      toast({
        title: "Could not add line",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bank transactions
          </h1>
          <p className="text-sm text-muted-foreground">
            Review bank activity, categorize lines, and post them to your books.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 gap-2"
            disabled={!selectedAccountId}
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add bank line
          </Button>
        </div>
      </div>

      {accountsLoading || (loading && !data) ? (
        <div className="rounded-xl border bg-white px-6 py-16 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
          Loading bank accounts…
        </div>
      ) : null}

      {!accountsLoading && (data?.accounts.length ?? 0) === 0 ? (
        <div className="rounded-xl border bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No bank accounts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Import your Chart of Accounts from QuickBooks to see bank registers here.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4 gap-2">
            <Link href="/settings?tab=import">
              <Upload className="h-3.5 w-3.5" />
              Go to Import
            </Link>
          </Button>
        </div>
      ) : null}

      {data && data.accounts.length > 0 ? (
        <>
          <section className="overflow-hidden rounded-xl border border-border/80 bg-white">
            <div className="border-b border-border/70 bg-muted/20 px-4 py-3 sm:px-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Accounts
              </p>
            </div>
            <div className="flex gap-px overflow-x-auto bg-border/60 p-px">
              {data.accounts.map((account) => {
                const active = account.id === selectedAccountId;
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    className={cn(
                      "min-w-[220px] flex-1 px-4 py-4 text-left transition-colors",
                      active ? "bg-white" : "bg-muted/15 hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Landmark className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {account.label}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {account.showBankBalance && account.bankBalance !== undefined ? (
                            <span className="tabular-nums">
                              Bank {formatPHP(account.bankBalance)}
                            </span>
                          ) : null}
                          <span className="tabular-nums">
                            Posted {formatPHP(account.bookBalance)}
                          </span>
                        </div>
                        {account.pendingCount > 0 ? (
                          <span className="inline-flex rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                            {account.pendingCount} pending
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedAccount?.needsAttention ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-foreground">Balances need attention</p>
                <p className="text-muted-foreground">
                  Bank balance and posted balance differ. Review pending lines or re-import from
                  QuickBooks.
                </p>
              </div>
            </div>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-border/80 bg-white">
            <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="inline-flex rounded-lg border border-border/80 bg-muted/20 p-0.5">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      tab === item.id
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                    <span className="ml-1.5 tabular-nums text-xs text-muted-foreground">
                      ({data.counts[item.id]})
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search bank lines…"
                  className="h-9 pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {error ? (
              <div className="px-5 py-8 text-center text-sm text-destructive">{error}</div>
            ) : loading ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Loading transactions…
              </div>
            ) : pageRows.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <p className="text-sm font-medium text-foreground">
                  No {tab} transactions
                  {search.trim() ? " match your search" : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tab === "pending"
                    ? "Add a bank line or import General Ledger to populate this register."
                    : tab === "posted"
                      ? "Posted lines come from your imported General Ledger and sales/expense activity."
                      : "Excluded lines stay out of reports until you restore them."}
                </p>
                {selectedAccountId && tab !== "excluded" ? (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddOpen(true)}
                    >
                      Add bank line
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={accountQuickReportHref(selectedAccountId)}>
                        View account history
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/25 text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-medium">Date</th>
                      <th className="px-4 py-2.5 text-left font-medium">Bank description</th>
                      <th className="px-4 py-2.5 text-right font-medium">Spent</th>
                      <th className="px-4 py-2.5 text-right font-medium">Received</th>
                      <th className="px-4 py-2.5 text-left font-medium">Payee</th>
                      <th className="px-4 py-2.5 text-left font-medium">Category</th>
                      <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {pageRows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/15">
                        <td className="px-4 py-3 tabular-nums whitespace-nowrap">{row.date}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{row.bankDescription}</p>
                          {row.refNumber ? (
                            <p className="text-xs text-muted-foreground">{row.refNumber}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">
                          {formatAmount(row.spent)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                          {formatAmount(row.received)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.payeeName || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {row.categoryLabel ? (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                              {row.categoryLabel}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-700">Needs category</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {tab === "pending" ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={saving}
                                  onClick={() => {
                                    setCategorizeRow(row);
                                    setCategoryDraft(row.categoryLabel);
                                    setPayeeDraft(row.payeeName);
                                  }}
                                >
                                  Categorize
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8"
                                  disabled={saving}
                                  onClick={() => void handlePost(row)}
                                >
                                  Post
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-muted-foreground"
                                  disabled={saving}
                                  onClick={() => void handleStatus(row, "excluded")}
                                >
                                  Exclude
                                </Button>
                              </>
                            ) : tab === "excluded" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8"
                                disabled={saving}
                                onClick={() => void handleStatus(row, "pending")}
                              >
                                Restore
                              </Button>
                            ) : (
                              <Button asChild variant="ghost" size="sm" className="h-8">
                                <Link href={accountQuickReportHref(selectedAccountId!)}>
                                  History
                                </Link>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {transactions.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {rangeStart}–{rangeEnd} of {transactions.length} transaction
                  {transactions.length === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                  >
                    <ChevronFirst className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2 text-xs tabular-nums text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                  >
                    <ChevronLast className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add bank line</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bank-line-date">Date</Label>
                <Input
                  id="bank-line-date"
                  type="date"
                  value={addForm.txnDate}
                  onChange={(e) => setAddForm((f) => ({ ...f, txnDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Direction</Label>
                <Select
                  value={addForm.direction}
                  onValueChange={(value: "deposit" | "payment") =>
                    setAddForm((f) => ({ ...f, direction: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment">Spent (payment)</SelectItem>
                    <SelectItem value="deposit">Received (deposit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-line-desc">Bank description</Label>
              <Input
                id="bank-line-desc"
                placeholder="e.g. CK# 3525 · INTER-BANK TRANSFER"
                value={addForm.bankDescription}
                onChange={(e) => setAddForm((f) => ({ ...f, bankDescription: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bank-line-amount">Amount (PHP)</Label>
                <Input
                  id="bank-line-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={addForm.amount}
                  onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-line-payee">Payee (optional)</Label>
                <Input
                  id="bank-line-payee"
                  value={addForm.payeeName}
                  onChange={(e) => setAddForm((f) => ({ ...f, payeeName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category (optional)</Label>
              <Select
                value={addForm.categoryLabel || "__none__"}
                onValueChange={(value) =>
                  setAddForm((f) => ({
                    ...f,
                    categoryLabel: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Uncategorized</SelectItem>
                  {categoryOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleAddLine()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to Pending"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(categorizeRow)}
        onOpenChange={(open) => {
          if (!open) setCategorizeRow(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Categorize transaction</DialogTitle>
          </DialogHeader>
          {categorizeRow ? (
            <div className="space-y-4 py-1">
              <p className="text-sm text-muted-foreground">{categorizeRow.bankDescription}</p>
              <div className="space-y-1.5">
                <Label>Payee</Label>
                <Input value={payeeDraft} onChange={(e) => setPayeeDraft(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={categoryDraft || "__none__"}
                  onValueChange={(value) => setCategoryDraft(value === "__none__" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Uncategorized</SelectItem>
                    {categoryOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCategorizeRow(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSaveCategory()}>
              Save
            </Button>
            <Button
              type="button"
              disabled={saving || !categoryDraft.trim()}
              onClick={() => void handleSaveAndPost()}
            >
              Save &amp; post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
