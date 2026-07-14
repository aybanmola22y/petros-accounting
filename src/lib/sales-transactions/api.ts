import { replaceSalesTransactionsInStore } from "@/lib/mock-data/store";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";

type SalesTransactionListResponse = {
  salesTransactions?: MockSalesTransaction[];
  salesTransaction?: MockSalesTransaction;
  error?: string;
};

async function readSalesResponse(response: Response): Promise<SalesTransactionListResponse> {
  return (await response.json()) as SalesTransactionListResponse;
}

function syncSalesTransactions(payload: SalesTransactionListResponse) {
  if (payload.salesTransactions) {
    replaceSalesTransactionsInStore(payload.salesTransactions);
  }
}

export async function createSalesTransactionViaApi(
  input: Omit<MockSalesTransaction, "id">,
): Promise<MockSalesTransaction> {
  const response = await fetch("/api/sales-transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: input }),
  });
  const payload = await readSalesResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to create sales transaction.");
  }
  if (!payload.salesTransaction) {
    throw new Error("Sales transaction was not returned from the server.");
  }
  syncSalesTransactions(payload);
  return payload.salesTransaction;
}

export async function updateSalesTransactionViaApi(
  id: string,
  patch: Partial<Omit<MockSalesTransaction, "id">>,
): Promise<MockSalesTransaction> {
  const response = await fetch("/api/sales-transactions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, patch }),
  });
  const payload = await readSalesResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to update sales transaction.");
  }
  if (!payload.salesTransaction) {
    throw new Error("Sales transaction was not returned from the server.");
  }
  syncSalesTransactions(payload);
  return payload.salesTransaction;
}
