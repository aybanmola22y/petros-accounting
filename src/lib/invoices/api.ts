import { replaceInvoicesInStore, deleteSalesTransactions } from "@/lib/mock-data/store";
import type { MockInvoice } from "@/lib/mock-data/types";

type InvoiceListResponse = {
  invoices?: MockInvoice[];
  invoice?: MockInvoice;
  deletedSalesIds?: string[];
  error?: string;
};

async function readInvoiceResponse(response: Response): Promise<InvoiceListResponse> {
  return (await response.json()) as InvoiceListResponse;
}

function syncInvoices(payload: InvoiceListResponse) {
  if (payload.invoices) {
    replaceInvoicesInStore(payload.invoices);
  }
}

/** Load invoices from Supabase into the in-memory store. */
export async function fetchInvoicesFromApi(): Promise<MockInvoice[]> {
  const response = await fetch("/api/invoices");
  const payload = await readInvoiceResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load invoices.");
  }
  const invoices = payload.invoices ?? [];
  replaceInvoicesInStore(invoices);
  return invoices;
}

export type CreateInvoiceInput = Omit<MockInvoice, "id">;

export async function createInvoiceViaApi(input: CreateInvoiceInput): Promise<MockInvoice> {
  const response = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoice: input }),
  });
  const payload = await readInvoiceResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to create invoice.");
  }
  if (!payload.invoice) {
    throw new Error("Invoice was not returned from the server.");
  }
  syncInvoices(payload);
  return payload.invoice;
}

export async function updateInvoiceViaApi(
  id: string,
  patch: Partial<MockInvoice>,
): Promise<MockInvoice> {
  const response = await fetch("/api/invoices", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, patch }),
  });
  const payload = await readInvoiceResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to update invoice.");
  }
  if (!payload.invoice) {
    throw new Error("Invoice was not returned from the server.");
  }
  syncInvoices(payload);
  return payload.invoice;
}

export async function deleteInvoiceViaApi(id: string): Promise<void> {
  const response = await fetch("/api/invoices", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const payload = await readInvoiceResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to delete invoice.");
  }
  if (payload.deletedSalesIds?.length) {
    deleteSalesTransactions(payload.deletedSalesIds);
  }
  syncInvoices(payload);
}

export async function voidInvoiceViaApi(id: string): Promise<MockInvoice> {
  return updateInvoiceViaApi(id, { voided: true, balanceDue: 0 });
}
