import { replaceCustomersInStore } from "@/lib/mock-data/store";
import type { MockCustomer } from "@/lib/mock-data/types";

export type CreateCustomerInput = {
  name: string;
  companyName: string;
  phone: string;
  currency: string;
  email?: string;
};

/** Create a customer in Supabase and refresh the in-memory store. */
export async function createCustomerViaApi(input: CreateCustomerInput): Promise<MockCustomer> {
  const response = await fetch("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      companyName: input.companyName,
      phone: input.phone,
      currency: input.currency,
      email: input.email,
    }),
  });

  const payload = (await response.json()) as {
    customer?: MockCustomer;
    customers?: MockCustomer[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to create customer.");
  }

  if (!payload.customer) {
    throw new Error("Customer was not returned from the server.");
  }

  if (payload.customers) {
    replaceCustomersInStore(payload.customers);
  }

  return payload.customer;
}
