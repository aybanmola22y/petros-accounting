import { NextResponse } from "next/server";
import {
  createSupplierInDb,
  importSuppliersInDb,
  listSuppliersFromDb,
  updateSupplierInDb,
  type ParsedSupplierImportPayload,
} from "@/lib/suppliers/repository";
import type { SupplierProfile } from "@/lib/mock-data/suppliers";
import { replaceSuppliersInStore } from "@/lib/mock-data/store";

export async function GET() {
  try {
    const suppliers = await listSuppliersFromDb();
    replaceSuppliersInStore(suppliers);
    return NextResponse.json({ suppliers, count: suppliers.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load suppliers." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      replace?: boolean;
      rows?: ParsedSupplierImportPayload[];
    };

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }

    const result = await importSuppliersInDb(body.rows, { replace: body.replace });
    const suppliers = await listSuppliersFromDb();
    replaceSuppliersInStore(suppliers);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      companyName?: string;
      phone?: string;
      email?: string;
      currency?: string;
      openingBalance?: number;
      profile?: SupplierProfile;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Supplier name is required." }, { status: 400 });
    }

    const supplier = await createSupplierInDb({
      name: body.name,
      companyName: body.companyName,
      phone: body.phone,
      email: body.email,
      currency: body.currency,
      openingBalance: body.openingBalance,
      profile: body.profile,
    });
    const suppliers = await listSuppliersFromDb();
    replaceSuppliersInStore(suppliers);
    return NextResponse.json({ supplier, suppliers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create supplier.";
    const status = message === "Supplier already exists" ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      companyName?: string;
      phone?: string;
      email?: string;
      currency?: string;
      openingBalance?: number;
      profile?: SupplierProfile;
    };

    if (!body.id) {
      return NextResponse.json({ error: "Supplier id is required." }, { status: 400 });
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Supplier name is required." }, { status: 400 });
    }

    const supplier = await updateSupplierInDb(body.id, {
      name: body.name,
      companyName: body.companyName,
      phone: body.phone,
      email: body.email,
      currency: body.currency,
      openingBalance: body.openingBalance,
      profile: body.profile,
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    }

    const suppliers = await listSuppliersFromDb();
    replaceSuppliersInStore(suppliers);
    return NextResponse.json({ supplier, suppliers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update supplier.";
    const status = message === "Supplier already exists" ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
