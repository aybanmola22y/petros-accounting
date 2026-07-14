"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ImageIcon,
  Package,
  PackageX,
  Printer,
  Search,
  Settings2,
} from "lucide-react";
import { ProductServiceRowMenu } from "@/components/product-service-row-menu";
import { ProductServicesFilterPopover } from "@/components/product-services-filter-popover";
import { ProductServiceCreateFlow } from "@/components/product-service-create-flow";
import { SplitActionButton } from "@/components/split-action-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useProductServices } from "@/hooks/use-product-services";
import {
  computeProductStockSummary,
  formatProductItemType,
  groupProductsByCategory,
  type MockProductService,
} from "@/lib/mock-data";
import { formatPHP } from "@/views/financial-report-shared";
import {
  DEFAULT_PRODUCT_SERVICE_LIST_FILTERS,
  productServiceMatchesListFilters,
  type ProductServiceListFilters,
  type ProductServiceStockStatusFilter,
} from "@/lib/product-services/filters";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

function formatListPrice(amount?: number) {
  if (amount === undefined || Number.isNaN(amount)) return "";
  return formatPHP(amount);
}

function matchesSearch(product: MockProductService, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    product.name.toLowerCase().includes(q) ||
    (product.sku?.toLowerCase().includes(q) ?? false) ||
    (product.salesDescription?.toLowerCase().includes(q) ?? false) ||
    (product.category?.toLowerCase().includes(q) ?? false)
  );
}

export function ProductsServices() {
  const { toast } = useToast();
  const { productServices: products, refresh } = useProductServices();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [nameSortAsc, setNameSortAsc] = useState(true);
  const [listFilters, setListFilters] = useState<ProductServiceListFilters>(
    DEFAULT_PRODUCT_SERVICE_LIST_FILTERS,
  );

  const filtered = useMemo(() => {
    const list = products.filter(
      (p) => matchesSearch(p, search) && productServiceMatchesListFilters(p, listFilters),
    );
    return [...list].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return nameSortAsc ? cmp : -cmp;
    });
  }, [products, search, nameSortAsc, listFilters]);

  const grouped = useMemo(() => groupProductsByCategory(filtered), [filtered]);
  const flatRows = useMemo(
    () =>
      grouped.flatMap((group) =>
        group.items.map((item) => ({ ...item, category: group.category })),
      ),
    [grouped],
  );

  const totalPages = Math.max(1, Math.ceil(flatRows.length / PAGE_SIZE));
  const pageRows = flatRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageGroups = useMemo(() => {
    const map = new Map<string, MockProductService[]>();
    for (const row of pageRows) {
      const cat = row.category ?? "Uncategorized";
      const list = map.get(cat) ?? [];
      list.push(row);
      map.set(cat, list);
    }
    return grouped.filter((g) => map.has(g.category)).map((g) => ({
      category: g.category,
      items: map.get(g.category) ?? [],
    }));
  }, [grouped, pageRows]);

  const stock = useMemo(() => computeProductStockSummary(products), [products]);
  const rangeStart = flatRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, flatRows.length);
  const allPageSelected =
    pageRows.length > 0 && pageRows.every((row) => selected.has(row.id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageRows.forEach((r) => next.delete(r.id));
      else pageRows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function applyStockStatusFilter(stockStatus: ProductServiceStockStatusFilter) {
    if (stockStatus === "All") return;
    setListFilters((prev) => ({
      ...prev,
      stockStatus: prev.stockStatus === stockStatus ? "All" : stockStatus,
    }));
    setPage(1);
  }

  const lowStockFilterActive = listFilters.stockStatus === "Low stock";
  const outOfStockFilterActive = listFilters.stockStatus === "Out of stock";

  function exportCsv() {
    const headers = [
      "Name",
      "SKU",
      "Type",
      "Category",
      "Sales description",
      "Sales price",
      "Cost",
      "Qty on hand",
      "Reorder point",
    ];
    const lines = filtered.map((p) =>
      [
        p.name,
        p.sku ?? "",
        formatProductItemType(p.itemType),
        p.category ?? "",
        p.salesDescription ?? "",
        p.salesPrice ?? "",
        p.cost ?? "",
        p.qtyOnHand ?? "",
        p.reorderPoint ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `products-services-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-foreground">
            Products and services
          </h1>
          <Link
            href="/"
            className="inline-flex text-sm font-medium text-primary hover:underline"
          >
            &lt; All Lists
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                More
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={exportCsv}>Export to Excel</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  toast({
                    title: "Import",
                    description: "Product import will be available in a future update.",
                  })
                }
              >
                Import products
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => window.print()}
              >
                Print list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <SplitActionButton
            label="New product/service"
            onClick={() => setCreateOpen(true)}
            className="bg-emerald-700 hover:bg-emerald-800"
            menuItems={[
              {
                label: "New category",
                onClick: () =>
                  toast({
                    title: "New category",
                    description: "Add categories from the product form.",
                  }),
              },
              {
                label: "New bundle",
                onClick: () => setCreateOpen(true),
              },
            ]}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex w-full items-center justify-between px-5 py-4">
          {summaryOpen ? (
            <div className="flex flex-1 items-center justify-center gap-12 sm:gap-20">
              <button
                type="button"
                disabled={stock.lowStock === 0}
                onClick={() => applyStockStatusFilter("Low stock")}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 transition-colors",
                  stock.lowStock > 0 && "hover:bg-muted/30 cursor-pointer",
                  stock.lowStock === 0 && "cursor-default opacity-80",
                  lowStockFilterActive && "bg-amber-50 ring-2 ring-amber-200/80",
                )}
                aria-pressed={lowStockFilterActive}
                aria-label={`${stock.lowStock} low stock items. Click to filter list.`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Package className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-semibold tabular-nums leading-none">
                    {stock.lowStock}
                  </p>
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground mt-1">
                    LOW STOCK
                  </p>
                </div>
              </button>
              <button
                type="button"
                disabled={stock.outOfStock === 0}
                onClick={() => applyStockStatusFilter("Out of stock")}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-1 -mx-2 transition-colors",
                  stock.outOfStock > 0 && "hover:bg-muted/30 cursor-pointer",
                  stock.outOfStock === 0 && "cursor-default opacity-80",
                  outOfStockFilterActive && "bg-red-50 ring-2 ring-red-200/80",
                )}
                aria-pressed={outOfStockFilterActive}
                aria-label={`${stock.outOfStock} out of stock items. Click to filter list.`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <PackageX className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-2xl font-semibold tabular-nums leading-none">
                    {stock.outOfStock}
                  </p>
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground mt-1">
                    OUT OF STOCK
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              Stock summary ({stock.lowStock}{" "}
              <button
                type="button"
                disabled={stock.lowStock === 0}
                onClick={() => applyStockStatusFilter("Low stock")}
                className={cn(
                  "font-medium",
                  stock.lowStock > 0 && "text-primary hover:underline",
                  lowStockFilterActive && "underline",
                )}
              >
                low
              </button>
              {" · "}
              <button
                type="button"
                disabled={stock.outOfStock === 0}
                onClick={() => applyStockStatusFilter("Out of stock")}
                className={cn(
                  "font-medium tabular-nums",
                  stock.outOfStock > 0 && "text-primary hover:underline",
                  outOfStockFilterActive && "underline",
                )}
              >
                {stock.outOfStock} out
              </button>
              )
            </span>
          )}
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/30 transition-colors"
            onClick={() => setSummaryOpen((v) => !v)}
            aria-expanded={summaryOpen}
            aria-label={summaryOpen ? "Collapse stock summary" : "Expand stock summary"}
          >
            <ChevronDown
              className={cn(
                "h-5 w-5 shrink-0 transition-transform",
                summaryOpen && "rotate-180",
              )}
            />
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                placeholder="Find products and services"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <ProductServicesFilterPopover
              products={products}
              appliedFilters={listFilters}
              onApply={(filters) => {
                setListFilters(filters);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={exportCsv}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={() =>
                toast({
                  title: "Table settings",
                  description: "Customize columns in a future update.",
                })
              }
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground ml-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="tabular-nums px-1">
                {rangeStart}-{rangeEnd}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={togglePage}
                    aria-label="Select all on page"
                  />
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-muted-foreground min-w-[220px]">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => setNameSortAsc((v) => !v)}
                  >
                    NAME
                    {nameSortAsc ? (
                      <ArrowUp className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </button>
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-muted-foreground">SKU</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-muted-foreground">TYPE</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-muted-foreground min-w-[160px]">
                  SALES DESCRIPTION
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-muted-foreground text-right">
                  SALES PRICE
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-muted-foreground text-right">
                  COST
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-muted-foreground text-right">
                  QTY ON HAND
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-muted-foreground text-right">
                  REORDER POINT
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-muted-foreground">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {pageGroups.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-muted-foreground">
                    No products or services match your search or filters.
                  </td>
                </tr>
              ) : (
                pageGroups.map((group) => (
                  <Fragment key={`cat-${group.category}`}>
                    <tr className="border-b bg-muted/15">
                      <td colSpan={10} className="px-4 py-2.5 font-semibold text-foreground">
                        {group.category}
                      </td>
                    </tr>
                    {group.items.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-3 py-2.5 align-middle">
                          <Checkbox
                            checked={selected.has(product.id)}
                            onCheckedChange={() => toggleRow(product.id)}
                            aria-label={`Select ${product.name}`}
                          />
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-muted/40 text-muted-foreground">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                            <span className="font-medium truncate">{product.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground">
                          {product.sku || ""}
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          {formatProductItemType(product.itemType)}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground max-w-[200px] truncate">
                          {product.salesDescription || ""}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-right tabular-nums font-medium">
                          {formatListPrice(product.salesPrice)}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-right tabular-nums text-muted-foreground">
                          {formatListPrice(product.cost)}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-right tabular-nums">
                          {product.qtyOnHand !== undefined ? product.qtyOnHand : ""}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-right tabular-nums text-muted-foreground">
                          {product.reorderPoint !== undefined ? product.reorderPoint : ""}
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <ProductServiceRowMenu product={product} onChanged={refresh} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3 text-sm text-muted-foreground sm:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="tabular-nums">
            {rangeStart}-{rangeEnd} of {flatRows.length}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ProductServiceCreateFlow
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setPage(1);
          toast({
            title: "Product saved",
            description: "The item was added to your products and services list.",
          });
        }}
      />
    </div>
  );
}
