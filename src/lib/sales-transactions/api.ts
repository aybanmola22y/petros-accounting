import {
  deleteSalesTransactions,
  upsertSalesTransactionInStore,
} from "@/lib/mock-data/store";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";

type SalesTransactionMutationResponse = {
  salesTransaction?: MockSalesTransaction;
  ids?: string[];
  error?: string;
};

async function readSalesResponse(response: Response): Promise<SalesTransactionMutationResponse> {
  return (await response.json()) as SalesTransactionMutationResponse;
}

export async function createSalesTransactionViaApi(
  input: Omit<MockSalesTransaction, "id"> & { id?: string },
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
  upsertSalesTransactionInStore(payload.salesTransaction);
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
  upsertSalesTransactionInStore(payload.salesTransaction);
  return payload.salesTransaction;
}

export async function deleteSalesTransactionsViaApi(ids: string[]): Promise<void> {
  const response = await fetch("/api/sales-transactions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const payload = await readSalesResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to delete sales transactions.");
  }
  deleteSalesTransactions(payload.ids ?? ids);
}
