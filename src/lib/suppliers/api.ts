import { replaceSuppliersInStore } from "@/lib/mock-data/store";
import type { MockSupplier, SupplierProfile } from "@/lib/mock-data/suppliers";

export type SupplierFormInput = {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  currency?: string;
  openingBalance?: number;
  profile?: SupplierProfile;
};

type SupplierListResponse = {
  suppliers?: MockSupplier[];
  supplier?: MockSupplier;
  error?: string;
};

async function readSupplierResponse(response: Response): Promise<SupplierListResponse> {
  return (await response.json()) as SupplierListResponse;
}

function syncSuppliers(payload: SupplierListResponse) {
  if (payload.suppliers) {
    replaceSuppliersInStore(payload.suppliers);
  }
}

export async function createSupplierViaApi(input: SupplierFormInput): Promise<MockSupplier> {
  const response = await fetch("/api/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await readSupplierResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to create supplier.");
  }
  if (!payload.supplier) {
    throw new Error("Supplier was not returned from the server.");
  }
  syncSuppliers(payload);
  return payload.supplier;
}

export async function updateSupplierViaApi(
  id: string,
  input: SupplierFormInput,
): Promise<MockSupplier> {
  const response = await fetch("/api/suppliers", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...input }),
  });
  const payload = await readSupplierResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to update supplier.");
  }
  if (!payload.supplier) {
    throw new Error("Supplier was not returned from the server.");
  }
  syncSuppliers(payload);
  return payload.supplier;
}
