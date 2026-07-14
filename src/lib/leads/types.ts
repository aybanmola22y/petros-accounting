import type { MockLead } from "@/lib/mock-data/types";

export type LeadRow = {
  id: string;
  lead_name: string;
  company_name: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  lead_source: string | null;
  attachment_count: number;
  status: string;
  converted_customer_id: string | null;
  sort_order: number;
  source_row_number: number | null;
  created_at: string;
  updated_at: string;
};

export type LeadInsert = {
  lead_name: string;
  company_name?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
  lead_source?: string | null;
  attachment_count?: number;
  status?: string;
  sort_order?: number;
  source_row_number?: number | null;
};

export function leadRowToMock(row: LeadRow): MockLead {
  const name = row.lead_name.trim();
  const company = row.company_name?.trim();
  return {
    id: row.id,
    name,
    companyName: company && company.toLowerCase() !== "none" ? company : name,
    phone: row.phone?.trim() ?? "",
    email: row.email?.trim() || undefined,
    source: row.lead_source?.trim() || "—",
    status: row.status?.trim() || "open",
  };
}

export function parsedLeadToInsert(row: {
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
  leadSource: string;
  attachmentCount: number;
  sortOrder?: number;
}): LeadInsert {
  const name = row.name.trim();
  const company = row.companyName.trim();
  return {
    lead_name: name,
    company_name:
      company && company.toLowerCase() !== "none" ? company : null,
    street_address: row.streetAddress.trim() || null,
    city: row.city.trim() || null,
    state: row.state.trim() || null,
    country: row.country.trim() || null,
    zip: row.zip.trim() || null,
    phone: row.phone.trim() || null,
    email: row.email.trim() || null,
    lead_source: row.leadSource.trim() || null,
    attachment_count: row.attachmentCount,
    status: "open",
    sort_order: row.sortOrder ?? row.rowNumber,
    source_row_number: row.rowNumber,
  };
}
