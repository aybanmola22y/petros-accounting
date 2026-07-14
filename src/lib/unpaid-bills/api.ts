import { replaceUnpaidBillsInStore } from "@/lib/mock-data/store";
import type { UnpaidBill } from "@/lib/mock-data/unpaid-bills";

type UnpaidBillListResponse = {
  unpaidBills?: UnpaidBill[];
  unpaidBill?: UnpaidBill;
  error?: string;
};

async function readUnpaidBillResponse(response: Response): Promise<UnpaidBillListResponse> {
  return (await response.json()) as UnpaidBillListResponse;
}

function syncUnpaidBills(payload: UnpaidBillListResponse) {
  if (payload.unpaidBills) {
    replaceUnpaidBillsInStore(payload.unpaidBills);
  }
}

export async function createUnpaidBillViaApi(input: {
  supplierName: string;
  dueDate: string;
  billAmount: number;
  openBalance?: number;
  status?: string;
  supplierId?: string | null;
}): Promise<UnpaidBill> {
  const response = await fetch("/api/unpaid-bills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await readUnpaidBillResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to create unpaid bill.");
  }
  if (!payload.unpaidBill) {
    throw new Error("Unpaid bill was not returned from the server.");
  }
  syncUnpaidBills(payload);
  return payload.unpaidBill;
}
