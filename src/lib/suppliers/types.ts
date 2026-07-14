import type { MockSupplier, SupplierProfile } from "@/lib/mock-data/suppliers";

export type SupplierRow = {
  id: string;
  supplier_name: string;
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

export type SupplierInsert = {
  supplier_name: string;
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

export type SupplierUpdate = Partial<SupplierInsert>;

/** Map form shorthand to the currency labels stored in Supabase. */
export function normalizeSupplierCurrency(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "Philippine Peso";
  const upper = trimmed.toUpperCase();
  if (upper === "PHP" || trimmed === "PHP Philippine Peso") return "Philippine Peso";
  if (upper === "USD" || trimmed === "USD US Dollar") return "US Dollar";
  return trimmed;
}

function profileToAddressFields(profile?: SupplierProfile) {
  return {
    street_address: profile?.street1?.trim() || null,
    city: profile?.city?.trim() || null,
    state: profile?.province?.trim() || null,
    country: profile?.country?.trim() || null,
    zip: profile?.zip?.trim() || null,
  };
}

export function supplierFormToInsert(
  input: {
    name: string;
    companyName?: string;
    phone?: string;
    email?: string;
    currency?: string;
    openingBalance?: number;
    profile?: SupplierProfile;
    sortOrder: number;
  },
): SupplierInsert {
  const name = input.name.trim();
  return {
    supplier_name: name,
    company_name: input.companyName?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    currency: normalizeSupplierCurrency(input.currency),
    open_balance: input.openingBalance ?? 0,
    ...profileToAddressFields(input.profile),
    sort_order: input.sortOrder,
    source_row_number: null,
  };
}

export function supplierFormToUpdate(input: {
  name?: string;
  companyName?: string;
  phone?: string;
  email?: string;
  currency?: string;
  openingBalance?: number;
  profile?: SupplierProfile;
}): SupplierUpdate {
  const update: SupplierUpdate = {};
  if (input.name !== undefined) update.supplier_name = input.name.trim();
  if (input.companyName !== undefined) {
    update.company_name = input.companyName.trim() || null;
  }
  if (input.phone !== undefined) update.phone = input.phone.trim() || null;
  if (input.email !== undefined) update.email = input.email.trim() || null;
  if (input.currency !== undefined) {
    update.currency = normalizeSupplierCurrency(input.currency);
  }
  if (input.openingBalance !== undefined) update.open_balance = input.openingBalance;
  if (input.profile !== undefined) {
    Object.assign(update, profileToAddressFields(input.profile));
  }
  return update;
}

export function supplierRowToMock(row: SupplierRow): MockSupplier {
  const name = row.supplier_name.trim();
  const companyName = row.company_name?.trim() || name;
  const street = row.street_address?.trim();
  const city = row.city?.trim();
  const state = row.state?.trim();
  const country = row.country?.trim();
  const zip = row.zip?.trim();

  const hasAddress = Boolean(street || city || state || country || zip);

  return {
    id: row.id,
    name,
    companyName,
    phone: row.phone?.trim() ?? "",
    email: row.email?.trim() ?? "",
    currency: row.currency?.trim() || "Philippine Peso",
    openBalance: Number(row.open_balance) || 0,
    isCustom: row.source_row_number == null,
    profile: hasAddress
      ? {
          street1: street || undefined,
          city: city || undefined,
          province: state || undefined,
          country: country || undefined,
          zip: zip || undefined,
        }
      : undefined,
  };
}

export function parsedSupplierToInsert(row: {
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
  currency: string;
  attachmentCount: number;
  openingBalance: number;
  sortOrder?: number;
}): SupplierInsert {
  return {
    supplier_name: row.name.trim(),
    company_name: row.companyName.trim() || null,
    street_address: row.streetAddress.trim() || null,
    city: row.city.trim() || null,
    state: row.state.trim() || null,
    country: row.country.trim() || null,
    zip: row.zip.trim() || null,
    phone: row.phone.trim() || null,
    email: row.email.trim() || null,
    currency: row.currency.trim() || "Philippine Peso",
    attachment_count: row.attachmentCount,
    open_balance: row.openingBalance,
    sort_order: row.sortOrder ?? row.rowNumber,
    source_row_number: row.rowNumber,
  };
}
