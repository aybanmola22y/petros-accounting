"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  HelpCircle,
  Landmark,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateChartAccounts,
  type MockChartAccount,
} from "@/lib/mock-data";
import { useChartAccounts } from "@/hooks/use-chart-accounts";
import { ImportGeneralLedgerDialog } from "@/components/import-general-ledger-dialog";
import { accountQuickReportHref } from "@/lib/account-quick-report-navigation";
import {
  CHART_ACCOUNT_VIEW_FILTERS,
  isProfitAndLossChartAccount,
  matchesChartAccountViewFilter,
  type ChartAccountViewFilter,
} from "@/lib/chart-of-accounts/account-filters";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

const NEW_ACCOUNT_TYPE_OPTIONS = [
  "Cash and cash equivalents",
  "Accounts receivable",
  "Other current assets",
  "Fixed assets",
  "Accounts payable",
  "Credit card",
  "Other current liabilities",
  "Equity",
  "Income",
  "Expenses",
] as const;

const DETAIL_TYPES_BY_ACCOUNT: Record<string, string[]> = {
  "Cash and cash equivalents": ["Bank", "Cash on hand", "Savings", "Money market"],
  "Accounts receivable": ["Accounts receivable", "Allowance for bad debts"],
  "Other current assets": ["Inventory", "Prepaid expenses", "Other current assets"],
  "Fixed assets": ["Buildings", "Machinery and equipment", "Vehicles", "Accumulated depreciation"],
  "Accounts payable": ["Accounts payable", "Trade payables"],
  "Credit card": ["Credit card"],
  "Other current liabilities": ["Payroll liabilities", "Sales tax payable", "Other current liabilities"],
  Equity: ["Owner's equity", "Retained earnings", "Share capital"],
  Income: ["Service revenue", "Sales of product income", "Other income"],
  Expenses: ["Office supplies", "Rent expense", "Utilities", "Payroll expense", "Other expense"],
};

const PAGE_SIZE = 75;

type SortKey = "sortOrder" | "number" | "name" | "accountType" | "ledgerBalance" | "bankBalance";
type SortDir = "asc" | "desc";

type ColumnKey = "tax" | "bankBalance";

function exportAccountsCsv(rows: MockChartAccount[]) {
  const headers = ["Account number", "Account name", "Account type", "Detail type"];
  const lines = rows.map((a) =>
    [a.number, a.name, a.accountType, a.detailType ?? "", a.currency, a.tax, a.ledgerBalance]
      .slice(0, 4)
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function SortableHead({
  label,
  active,
  direction,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  direction: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors",
        className,
      )}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
      )}
    </button>
  );
}

function isInteractiveRowTarget(target: EventTarget | null): boolean {
  return Boolean(
    target instanceof Element &&
      target.closest('button, a, input, label, [role="checkbox"], [data-radix-collection-item]'),
  );
}

export function ChartOfAccounts() {
  const router = useRouter();
  const { toast } = useToast();
  const { accounts, loading, error, refresh } = useChartAccounts();
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<ChartAccountViewFilter>("All");
  const [showInactive, setShowInactive] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    tax: true,
    bankBalance: true,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("sortOrder");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newAccountType, setNewAccountType] = useState("");
  const [newDetailType, setNewDetailType] = useState("");
  const [newIsSubaccount, setNewIsSubaccount] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newLockAccount, setNewLockAccount] = useState(false);

  const detailTypeOptions = newAccountType
    ? DETAIL_TYPES_BY_ACCOUNT[newAccountType] ?? []
    : [];

  function resetNewAccountForm() {
    setNewAccountName("");
    setNewAccountNumber("");
    setNewAccountType("");
    setNewDetailType("");
    setNewIsSubaccount(false);
    setNewDescription("");
    setNewLockAccount(false);
  }

  function handleNewAccountOpenChange(open: boolean) {
    setNewAccountOpen(open);
    if (!open) resetNewAccountForm();
  }

  function openAccountQuickReport(accountId: string) {
    router.push(accountQuickReportHref(accountId));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.number.toLowerCase().includes(q);
      const matchesView = matchesChartAccountViewFilter(a, viewFilter, accounts);
      const matchesActive = showInactive || a.isActive;
      return matchesSearch && matchesView && matchesActive;
    });
  }, [accounts, search, viewFilter, showInactive]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "sortOrder") {
        cmp = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
        if (cmp === 0) cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "ledgerBalance" || sortKey === "bankBalance") {
        cmp = (a[sortKey] ?? 0) - (b[sortKey] ?? 0);
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = sorted.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, sorted.length);

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((a) => selected.has(a.id));

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageItems.forEach((a) => next.delete(a.id));
      } else {
        pageItems.forEach((a) => next.add(a.id));
      }
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCount = selected.size;

  function handleBatchEdit() {
    if (selectedCount === 0) {
      toast({
        title: "Select accounts first",
        description: "Choose one or more rows, then run batch edit.",
      });
      return;
    }
    toast({
      title: "Batch edit",
      description: `Editing ${selectedCount} account${selectedCount === 1 ? "" : "s"}.`,
    });
  }

  function handleExport() {
    exportAccountsCsv(sorted);
    toast({
      title: "Export started",
      description: `Downloaded ${sorted.length} account${sorted.length === 1 ? "" : "s"} as CSV.`,
    });
  }

  function handlePrint() {
    window.print();
    toast({ title: "Print", description: "Opening print dialog…" });
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refresh({ syncGl: true });
      toast({
        title: "Accounts refreshed",
        description: "Chart of accounts synced with general ledger.",
      });
    } catch {
      toast({
        title: "Refresh failed",
        description: "Could not reload chart of accounts.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleCreateAccount(andClose = true) {
    const name = newAccountName.trim();
    const number = newAccountNumber.trim() || `AUTO-${Date.now().toString().slice(-6)}`;
    if (!name || !newAccountType || !newDetailType) {
      toast({
        title: "Missing required fields",
        description: "Account name, account type, and detail type are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/chart-of-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number,
          name: newIsSubaccount ? `↳ ${name}` : name,
          accountType: newAccountType,
          detailType: newDetailType,
          currency: "PHP",
          tax: "",
          ledgerBalance: 0,
          isActive: !newLockAccount,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to save account.");

      await refresh();
      toast({ title: "Account saved", description: `${name} was added to your chart of accounts.` });
      if (andClose) {
        handleNewAccountOpenChange(false);
      } else {
        resetNewAccountForm();
      }
    } catch (err) {
      toast({
        title: "Could not save account",
        description: err instanceof Error ? err.message : "Save failed.",
        variant: "destructive",
      });
    }
  }

  async function toggleAccountActive(id: string) {
    const account = accounts.find((a) => a.id === id);
    if (!account) return;

    try {
      const response = await fetch(`/api/chart-of-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Update failed.");
      await refresh();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Could not update account.",
        variant: "destructive",
      });
    }
  }

  function syncBankFeed(id: string) {
    const account = accounts.find((a) => a.id === id);
    if (!account?.bankConnected) return;
    toast({
      title: "Bank balance comes from import",
      description: "Re-import the QuickBooks Chart of Accounts list export to refresh bank balances.",
    });
  }

  const colSpan =
    8 + (visibleColumns.tax ? 1 : 0) + (visibleColumns.bankBalance ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Accounting
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Manage your account structure, balances, and bank connections in one place.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setImportHistoryOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Import account history
          </Button>
          <Button className="gap-2 shadow-sm" onClick={() => setNewAccountOpen(true)}>
            <Plus className="h-4 w-4" />
            New account
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Loading chart of accounts from Supabase…
        </div>
      ) : null}

      <ImportGeneralLedgerDialog
        open={importHistoryOpen}
        onOpenChange={setImportHistoryOpen}
        onImported={() => void refresh()}
      />

      <Dialog open={newAccountOpen} onOpenChange={handleNewAccountOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b px-6 py-5">
            <DialogTitle className="text-xl font-semibold">New account</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="acct-name" className="text-sm font-medium">
                  Account name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="acct-name"
                  className="h-10"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                />
              </div>
              <div className="grid gap-2 sm:col-span-1">
                <Label htmlFor="acct-number" className="text-sm font-medium">
                  Account number
                </Label>
                <Input
                  id="acct-number"
                  className="h-10"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="acct-type" className="text-sm font-medium">
                    Account type <span className="text-destructive">*</span>
                  </Label>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="About account types"
                    title="Choose the category that best matches how this account is used in reports."
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>
                <Select
                  value={newAccountType}
                  onValueChange={(v) => {
                    setNewAccountType(v);
                    setNewDetailType("");
                  }}
                >
                  <SelectTrigger id="acct-type" className="h-10">
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    {NEW_ACCOUNT_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="detail-type" className="text-sm font-medium">
                  Detail type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={newDetailType}
                  onValueChange={setNewDetailType}
                  disabled={!newAccountType}
                >
                  <SelectTrigger id="detail-type" className="h-10">
                    <SelectValue placeholder="Select detail type" />
                  </SelectTrigger>
                  <SelectContent>
                    {detailTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="subaccount"
                checked={newIsSubaccount}
                onCheckedChange={(v) => setNewIsSubaccount(v === true)}
              />
              <Label htmlFor="subaccount" className="text-sm font-normal cursor-pointer">
                Make this a subaccount
              </Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="acct-description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="acct-description"
                className="min-h-[80px] resize-y"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>

            <Separator />

            <div className="flex flex-wrap items-center gap-3">
              <span
                className="text-sm font-medium border-b border-dotted border-muted-foreground/60 cursor-help"
                title="Locked accounts cannot be edited in registers without unlocking."
              >
                Lock account
              </span>
              <div
                className="inline-flex rounded-lg border bg-muted/30 p-0.5"
                role="group"
                aria-label="Lock account"
              >
                <button
                  type="button"
                  onClick={() => setNewLockAccount(false)}
                  className={cn(
                    "inline-flex h-9 w-10 items-center justify-center rounded-md transition-colors",
                    !newLockAccount
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label="Unlocked"
                  aria-pressed={!newLockAccount}
                >
                  <LockOpen className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setNewLockAccount(true)}
                  className={cn(
                    "inline-flex h-9 w-10 items-center justify-center rounded-md transition-colors",
                    newLockAccount
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label="Locked"
                  aria-pressed={newLockAccount}
                >
                  <Lock className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 flex-row items-center justify-end gap-3 border-t bg-muted/30 px-6 py-4">
            <Button variant="outline" onClick={() => handleNewAccountOpenChange(false)}>
              Cancel
            </Button>
            <div className="flex overflow-hidden rounded-md shadow-sm">
              <Button className="rounded-r-none px-6" onClick={() => handleCreateAccount(true)}>
                Save
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="default"
                    className="rounded-l-none border-l border-primary-foreground/25 px-2.5"
                    aria-label="More save options"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleCreateAccount(true)}>
                    Save and close
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCreateAccount(false)}>
                    Save and new
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Total accounts</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {loading ? "—" : accounts.length}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Bank-connected</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {loading ? "—" : accounts.filter((a) => a.bankConnected).length}
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Showing</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {loading ? "—" : filtered.length}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {selectedCount > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2">
                    Batch actions ({selectedCount})
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={handleBatchEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Batch edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      updateChartAccounts((prev) =>
                        prev.map((a) =>
                          selected.has(a.id) ? { ...a, isActive: false } : a,
                        ),
                      );
                      setSelected(new Set());
                      toast({ title: "Accounts deactivated", description: `${selectedCount} updated.` });
                    }}
                  >
                    Make inactive
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      toast({
                        title: "Tax code",
                        description: `Assign tax to ${selectedCount} selected account(s).`,
                      })
                    }
                  >
                    Assign tax code
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <div className="relative min-w-[200px] flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by name or number"
                className="h-9 pl-9 bg-background"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <Select
              value={viewFilter}
              onValueChange={(v) => {
                setViewFilter(v as ChartAccountViewFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[240px] bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                {CHART_ACCOUNT_VIEW_FILTERS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              disabled={selectedCount === 0}
              onClick={handleBatchEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
              Batch edit
            </Button>

            <Separator orientation="vertical" className="hidden h-6 sm:block" />

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Export to CSV"
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Print"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    aria-label="Table settings"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuCheckboxItem
                    checked={showInactive}
                    onCheckedChange={setShowInactive}
                  >
                    Show inactive accounts
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.tax}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((c) => ({ ...c, tax: checked }))
                    }
                  >
                    Tax column
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.bankBalance}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((c) => ({ ...c, bankBalance: checked }))
                    }
                  >
                    Bank balance column
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Refresh balances"
                disabled={isRefreshing}
                onClick={handleRefresh}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="group border-b bg-muted/30">
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleAllOnPage}
                    aria-label="Select all on page"
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortableHead
                    label="Number"
                    active={sortKey === "number"}
                    direction={sortDir}
                    onClick={() => toggleSort("number")}
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortableHead
                    label="Name"
                    active={sortKey === "name"}
                    direction={sortDir}
                    onClick={() => toggleSort("name")}
                  />
                </th>
                <th className="px-4 py-3 text-left min-w-[200px]">
                  <SortableHead
                    label="Account type"
                    active={sortKey === "accountType"}
                    direction={sortDir}
                    onClick={() => toggleSort("accountType")}
                  />
                </th>
                <th className="px-4 py-3 text-left min-w-[180px]">Detail type</th>
                <th className="px-4 py-3 text-left">Currency</th>
                {visibleColumns.tax && (
                  <th className="px-4 py-3 text-left">Tax</th>
                )}
                <th className="px-4 py-3 text-center">
                  <SortableHead
                    label="Quickbooks Balance"
                    active={sortKey === "ledgerBalance"}
                    direction={sortDir}
                    onClick={() => toggleSort("ledgerBalance")}
                    className="mx-auto"
                  />
                </th>
                {visibleColumns.bankBalance && (
                  <th className="px-4 py-3 text-right">
                    <SortableHead
                      label="Bank balance"
                      active={sortKey === "bankBalance"}
                      direction={sortDir}
                      onClick={() => toggleSort("bankBalance")}
                      className="ml-auto"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-right min-w-[200px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-16 text-center text-muted-foreground">
                    No accounts match your filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((account, index) => {
                  const isSelected = selected.has(account.id);
                  const stripe = index % 2 === 0 ? "bg-background" : "bg-muted/15";
                  return (
                    <tr
                      key={account.id}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-muted/30 cursor-pointer",
                        stripe,
                        isSelected && "bg-primary/5",
                      )}
                      onDoubleClick={(event) => {
                        if (isInteractiveRowTarget(event.target)) return;
                        openAccountQuickReport(account.id);
                      }}
                      title="Double-click to open account history"
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(account.id)}
                          aria-label={`Select ${account.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {account.number}
                      </td>
                      <td className="px-4 py-3 font-medium">{account.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">{account.accountType}</span>
                          {account.bankConnected && (
                            <button
                              type="button"
                              onClick={() => syncBankFeed(account.id)}
                              className="inline-flex"
                            >
                              <Badge
                                variant="outline"
                                className="gap-1.5 font-normal text-primary border-primary/30 cursor-pointer hover:bg-primary/5"
                              >
                                <RefreshCw className="h-3 w-3" />
                                Bank feed
                              </Badge>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {account.detailType || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{account.currency}</td>
                      {visibleColumns.tax && (
                        <td className="px-4 py-3 text-muted-foreground">
                          {account.tax || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center tabular-nums font-medium">
                        {isProfitAndLossChartAccount(account)
                          ? ""
                          : formatPHP(account.ledgerBalance)}
                      </td>
                      {visibleColumns.bankBalance && (
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {account.bankBalance !== undefined
                            ? formatPHP(account.bankBalance)
                            : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto px-0 text-primary font-medium"
                            onClick={() => openAccountQuickReport(account.id)}
                          >
                            Account history
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">More actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  toast({
                                    title: "Edit account",
                                    description: `Editing ${account.name}.`,
                                  })
                                }
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit account
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => syncBankFeed(account.id)}>
                                <Landmark className="mr-2 h-4 w-4" />
                                Refresh bank balance from import
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  toggleAccountActive(account.id);
                                  toast({
                                    title: account.isActive ? "Made inactive" : "Made active",
                                    description: account.name,
                                  });
                                }}
                              >
                                {account.isActive ? "Make inactive" : "Make active"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openAccountQuickReport(account.id)}
                              >
                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                Run report
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {sorted.length === 0
              ? "No results"
              : `${rangeStart}–${rangeEnd} of ${sorted.length} accounts`}
            {selectedCount > 0 && ` · ${selectedCount} selected`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums px-1">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
