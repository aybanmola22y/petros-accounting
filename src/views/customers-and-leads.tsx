"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Plus,
  Printer,
  Receipt,
  Search,
  Settings2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomerFormDialog, type CustomerFormValues } from "@/components/customer-form-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMockReceivables } from "@/hooks/use-mock-receivables";
import { useMockSales } from "@/hooks/use-mock-sales";
import { useCustomersAndLeadsBootstrap } from "@/hooks/use-customers-and-leads-bootstrap";
import { useToast } from "@/hooks/use-toast";
import {
  CUSTOMERS_LIST_PATH,
  NEW_CUSTOMER_SEARCH_PARAM,
} from "@/lib/customer-navigation";
import { invoicesHref } from "@/lib/invoice-navigation";
import { createCustomerViaApi } from "@/lib/customers/api";
import type { CustomerWithBalance, MockLead } from "@/lib/mock-data";
import { formatPHP } from "@/views/financial-report-shared";
import { cn } from "@/lib/utils";

type SortKey = "name" | "companyName" | "openBalance";
const PAGE_SIZE = 10;

export function CustomersAndLeads() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  useCustomersAndLeadsBootstrap();
  useMockSales();
  const { kpiSegments, customers, leads } = useMockReceivables();
  const [tab, setTab] = useState<"customers" | "leads">("customers");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    phone: true,
    company: true,
    email: true,
  });

  useEffect(() => {
    if (searchParams.get(NEW_CUSTOMER_SEARCH_PARAM) === "1") {
      setTab("customers");
      setNewCustomerOpen(true);
      router.replace(CUSTOMERS_LIST_PATH, { scroll: false });
    }
  }, [searchParams, router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list: (CustomerWithBalance | MockLead)[] = tab === "customers" ? customers : leads;
    if (!q) return list;
    return list.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        ("companyName" in row && row.companyName.toLowerCase().includes(q)) ||
        ("phone" in row && row.phone.includes(q)) ||
        ("email" in row && (row.email ?? "").toLowerCase().includes(q)),
    );
  }, [customers, leads, search, tab]);

  const sorted = useMemo(() => {
    if (tab === "leads") return filtered as MockLead[];
    const list = [...(filtered as CustomerWithBalance[])];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "openBalance") cmp = a.openBalance - b.openBalance;
      else cmp = a[sortKey].localeCompare(b[sortKey]);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir, tab]);

  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const rangeStart = sorted.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, sorted.length);

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((r) => selected.has(r.id));

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return null;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  }

  async function handleCreateCustomer(values: CustomerFormValues) {
    try {
      await createCustomerViaApi(values);
      toast({ title: "Customer added", description: values.name });
    } catch (error) {
      toast({
        title: "Could not save customer",
        description: error instanceof Error ? error.message : "Save failed.",
        variant: "destructive",
      });
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Customers & Leads
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Customers & leads</h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-1 shrink-0">
              New customer
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setNewCustomerOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add customer
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                toast({ title: "Import", description: "Customer import coming soon." })
              }
            >
              Import customers
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex gap-6 border-b">
        {(["customers", "leads"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setPage(1);
              setSelected(new Set());
            }}
            className={cn(
              "pb-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <section className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0">
          {kpiSegments.map((seg) => (
            <div key={seg.label} className="px-4 py-4 space-y-2">
              <p className={cn("text-lg font-semibold tabular-nums", seg.textClass)}>
                {formatPHP(seg.amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {seg.count > 0 ? (
                  <>
                    {seg.count} {seg.label}
                  </>
                ) : (
                  seg.label
                )}
              </p>
              <div className={cn("h-2 w-full shrink-0", seg.barClass)} />
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tab === "customers" ? "Search customers" : "Search leads"}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => toast({ title: "Export", description: "CSV export started." })}>
            <Download className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={visibleColumns.company}
                onCheckedChange={(v) => setVisibleColumns((c) => ({ ...c, company: !!v }))}
              >
                Company name
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.phone}
                onCheckedChange={(v) => setVisibleColumns((c) => ({ ...c, phone: !!v }))}
              >
                Phone
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visibleColumns.email}
                onCheckedChange={(v) => setVisibleColumns((c) => ({ ...c, email: !!v }))}
              >
                Email
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <section className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-3 py-3">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={() => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (allPageSelected) pageItems.forEach((r) => next.delete(r.id));
                        else pageItems.forEach((r) => next.add(r.id));
                        return next;
                      });
                    }}
                  />
                </th>
                {tab === "customers" ? (
                  <>
                    <th className="px-4 py-3 text-left font-medium">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("name")}>
                        Name <SortIcon column="name" />
                      </button>
                    </th>
                    {visibleColumns.company && (
                      <th className="px-4 py-3 text-left font-medium">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("companyName")}>
                          Company name <SortIcon column="companyName" />
                        </button>
                      </th>
                    )}
                    {visibleColumns.phone && <th className="px-4 py-3 text-left font-medium">Phone</th>}
                    {visibleColumns.email && <th className="px-4 py-3 text-left font-medium">Email</th>}
                    <th className="px-4 py-3 text-left font-medium">Currency</th>
                    <th className="px-4 py-3 text-left font-medium">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("openBalance")}>
                        Open balance <SortIcon column="openBalance" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium w-[1%] whitespace-nowrap">Action</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Company</th>
                    <th className="px-4 py-3 text-left font-medium">Phone</th>
                    <th className="px-4 py-3 text-left font-medium">Source</th>
                    <th className="px-4 py-3 text-left font-medium w-[1%] whitespace-nowrap">Action</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {tab === "customers" &&
                (pageItems as CustomerWithBalance[]).map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-3">
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">{row.name}</td>
                    {visibleColumns.company && (
                      <td className="px-4 py-3 text-muted-foreground">{row.companyName || "None"}</td>
                    )}
                    {visibleColumns.phone && (
                      <td className="px-4 py-3 text-muted-foreground">{row.phone || "None"}</td>
                    )}
                    {visibleColumns.email && (
                      <td className="px-4 py-3 text-primary">
                        {row.email ? (
                          <a href={`mailto:${row.email}`} className="hover:underline">
                            {row.email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">{row.currency}</td>
                    <td className="px-4 py-3 tabular-nums font-medium">{formatPHP(row.openBalance)}</td>
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-left">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="link" className="h-auto p-0 gap-1">
                            {row.action === "payment" ? "Receive payment" : "Create invoice"}
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {row.action === "payment" ? (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  toast({ title: "Receive payment", description: row.name })
                                }
                              >
                                <Receipt className="mr-2 h-4 w-4" />
                                Receive payment
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href="/sales/invoices">View invoices</Link>
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem
                                onClick={() => router.push(invoicesHref(true))}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                Create invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href="/sales/overview">Create estimate</Link>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              {tab === "leads" &&
                (pageItems as MockLead[]).map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-3">
                      <Checkbox checked={selected.has(row.id)} onCheckedChange={() => {}} />
                    </td>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.companyName || "None"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.phone || "None"}</td>
                    <td className="px-4 py-3">{row.source}</td>
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-left">
                      <Button
                        variant="link"
                        className="h-auto p-0"
                        onClick={() =>
                          toast({ title: "Convert to customer", description: row.name })
                        }
                      >
                        Convert to customer
                      </Button>
                    </td>
                  </tr>
                ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No {tab} found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {rangeStart}–{rangeEnd} of {sorted.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <CustomerFormDialog
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        onSave={handleCreateCustomer}
      />
    </div>
  );
}
