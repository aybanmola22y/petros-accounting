import { Building2, Contact2, FileText, Users, type LucideIcon } from "lucide-react";
import type { NavItem } from "@/lib/app-navigation";
import { flattenNavItems } from "@/lib/app-navigation";
import { CUSTOMERS_LIST_PATH } from "@/lib/customer-navigation";
import { INVOICES_PATH, INVOICE_ID_SEARCH_PARAM } from "@/lib/invoice-navigation";
import type { InvoiceViewRow } from "@/lib/mock-data";
import type { MockCustomer, MockLead } from "@/lib/mock-data/types";
import type { MockSupplier } from "@/lib/mock-data/suppliers";

export const GLOBAL_SEARCH_PARAM = "q";

const RESULT_LIMIT = 6;

export type GlobalSearchResultKind = "page" | "invoice" | "customer" | "lead" | "supplier";

export type GlobalSearchResult = {
  id: string;
  kind: GlobalSearchResultKind;
  label: string;
  sublabel?: string;
  href: string;
  icon: LucideIcon;
};

function matchesQuery(query: string, ...parts: (string | undefined)[]) {
  return parts.some((part) => part?.toLowerCase().includes(query));
}

function appendSearchParam(href: string, query: string) {
  const url = new URL(href, "http://local");
  url.searchParams.set(GLOBAL_SEARCH_PARAM, query);
  return `${url.pathname}${url.search}`;
}

export function invoiceSearchHref(invoiceId: string, query?: string) {
  const params = new URLSearchParams();
  params.set(INVOICE_ID_SEARCH_PARAM, invoiceId);
  if (query?.trim()) params.set(GLOBAL_SEARCH_PARAM, query.trim());
  return `${INVOICES_PATH}?${params.toString()}`;
}

export function customersSearchHref(query: string) {
  return appendSearchParam(CUSTOMERS_LIST_PATH, query);
}

export function suppliersSearchHref(query: string) {
  return appendSearchParam("/expenses/suppliers", query);
}

export function buildGlobalSearchResults(
  rawQuery: string,
  data: {
    navItems?: NavItem[];
    invoices: InvoiceViewRow[];
    customers: MockCustomer[];
    leads: MockLead[];
    suppliers: MockSupplier[];
  },
): GlobalSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  const navItems = data.navItems ?? flattenNavItems();
  const results: GlobalSearchResult[] = [];

  for (const item of navItems) {
    if (!query || matchesQuery(query, item.label, item.href)) {
      results.push({
        id: `page:${item.href}`,
        kind: "page",
        label: item.label,
        sublabel: item.href === "/" ? "Overview" : undefined,
        href: item.href,
        icon: item.icon,
      });
    }
  }

  if (query) {
    for (const inv of data.invoices) {
      if (
        matchesQuery(query, inv.number, inv.customer, inv.id) &&
        results.filter((r) => r.kind === "invoice").length < RESULT_LIMIT
      ) {
        results.push({
          id: `invoice:${inv.id}`,
          kind: "invoice",
          label: inv.number,
          sublabel: inv.customer,
          href: invoiceSearchHref(inv.id, query),
          icon: FileText,
        });
      }
    }

    for (const customer of data.customers) {
      if (
        matchesQuery(query, customer.name, customer.companyName, customer.email, customer.phone) &&
        results.filter((r) => r.kind === "customer").length < RESULT_LIMIT
      ) {
        results.push({
          id: `customer:${customer.id}`,
          kind: "customer",
          label: customer.name,
          sublabel: customer.companyName !== "None" ? customer.companyName : customer.email,
          href: customersSearchHref(query),
          icon: Contact2,
        });
      }
    }

    for (const lead of data.leads) {
      if (
        matchesQuery(query, lead.name, lead.companyName, lead.email, lead.phone, lead.source) &&
        results.filter((r) => r.kind === "lead").length < RESULT_LIMIT
      ) {
        results.push({
          id: `lead:${lead.id}`,
          kind: "lead",
          label: lead.name,
          sublabel: lead.companyName,
          href: customersSearchHref(query),
          icon: Users,
        });
      }
    }

    for (const supplier of data.suppliers) {
      if (
        matchesQuery(query, supplier.name, supplier.companyName, supplier.email, supplier.phone) &&
        results.filter((r) => r.kind === "supplier").length < RESULT_LIMIT
      ) {
        results.push({
          id: `supplier:${supplier.id}`,
          kind: "supplier",
          label: supplier.name,
          sublabel: supplier.companyName,
          href: suppliersSearchHref(query),
          icon: Building2,
        });
      }
    }
  }

  const pageResults = results.filter((r) => r.kind === "page").slice(0, RESULT_LIMIT);
  const entityResults = results.filter((r) => r.kind !== "page");
  return [...pageResults, ...entityResults];
}

export function groupGlobalSearchResults(results: GlobalSearchResult[]) {
  const groups: { heading: string; items: GlobalSearchResult[] }[] = [];
  const pages = results.filter((r) => r.kind === "page");
  const invoices = results.filter((r) => r.kind === "invoice");
  const customers = results.filter((r) => r.kind === "customer" || r.kind === "lead");
  const suppliers = results.filter((r) => r.kind === "supplier");

  if (pages.length) groups.push({ heading: "Pages", items: pages });
  if (invoices.length) groups.push({ heading: "Invoices", items: invoices });
  if (customers.length) groups.push({ heading: "Customers & Leads", items: customers });
  if (suppliers.length) groups.push({ heading: "Suppliers", items: suppliers });
  return groups;
}
