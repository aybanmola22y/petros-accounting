import type { MockCustomer, CustomerProfile } from "@/lib/mock-data/types";

export type CustomerRow = {
  id: string;
  customer_name: string;
  company_name: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  attachment_count: number;
  open_balance: number | string;
  sort_order: number;
  source_row_number: number | null;
  created_at: string;
  updated_at: string;
};

export type CustomerInsert = {
  customer_name: string;
  company_name?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
  currency?: string;
  attachment_count?: number;
  open_balance?: number;
  sort_order?: number;
  source_row_number?: number | null;
};

/** Map form/import shorthand to the currency labels stored in Supabase. */
export function normalizeCustomerCurrency(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "Philippine Peso";
  const upper = trimmed.toUpperCase();
  if (upper === "PHP" || trimmed === "PHP Philippine Peso") return "Philippine Peso";
  if (upper === "USD" || trimmed === "USD US Dollar") return "US Dollar";
  return trimmed;
}

function normalizeCompanyName(value: string | null | undefined, fallbackName: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.toLowerCase() === "none") return fallbackName;
  return trimmed;
}

export function customerRowToMock(row: CustomerRow): MockCustomer {
  const name = row.customer_name.trim();
  const companyName = normalizeCompanyName(row.company_name, name);
  const street = row.street_address?.trim();
  const city = row.city?.trim();
  const state = row.state?.trim();
  const country = row.country?.trim();
  const zip = row.zip?.trim();
  const hasAddress = Boolean(street || city || state || country || zip);

  const profile: CustomerProfile | undefined = hasAddress
    ? {
        street1: street || undefined,
        city: city || undefined,
        province: state || undefined,
        country: country || undefined,
        zip: zip || undefined,
      }
    : undefined;

  return {
    id: row.id,
    name,
    companyName,
    phone: row.phone?.trim() ?? "",
    email: row.email?.trim() || undefined,
    currency: row.currency?.trim() || "Philippine Peso",
    openBalance: Number(row.open_balance) || 0,
    attachmentCount: Number(row.attachment_count) || 0,
    profile,
  };
}

export function parsedCustomerToInsert(row: {
  rowNumber: number;
  name: string;
  companyName: string;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  phone: string;
  email: string;
  attachmentCount: number;
  openBalance: number;
  sortOrder?: number;
}): CustomerInsert {
  const name = row.name.trim();
  const company = row.companyName.trim();
  return {
    customer_name: name,
    company_name:
      company && company.toLowerCase() !== "none" ? company : null,
    street_address: row.streetAddress.trim() || null,
    city: row.city.trim() || null,
    state: row.state.trim() || null,
    country: row.country.trim() || null,
    zip: row.zip.trim() || null,
    phone: row.phone.trim() || null,
    email: row.email.trim() || null,
    currency: "Philippine Peso",
    attachment_count: row.attachmentCount,
    open_balance: row.openBalance,
    sort_order: row.sortOrder ?? row.rowNumber,
    source_row_number: row.rowNumber,
  };
}
