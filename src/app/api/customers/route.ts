import { NextResponse } from "next/server";
import {
  createCustomerInDb,
  importCustomersInDb,
  listCustomersFromDb,
  type ParsedCustomerImportPayload,
} from "@/lib/customers/repository";
import { normalizeCustomerCurrency } from "@/lib/customers/types";
import { replaceCustomersInStore } from "@/lib/mock-data/store";

export async function GET() {
  try {
    const customers = await listCustomersFromDb();
    replaceCustomersInStore(customers);
    return NextResponse.json({ customers, count: customers.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load customers." },
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
      currency?: string;
      email?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
    }

    const customer = await createCustomerInDb({
      name: body.name,
      companyName: body.companyName ?? "None",
      phone: body.phone ?? "",
      currency: normalizeCustomerCurrency(body.currency),
      email: body.email,
    });
    const customers = await listCustomersFromDb();
    replaceCustomersInStore(customers);
    return NextResponse.json({ customer, customers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create customer." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      replace?: boolean;
      rows?: ParsedCustomerImportPayload[];
    };

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }

    const result = await importCustomersInDb(body.rows, { replace: body.replace });
    const customers = await listCustomersFromDb();
    replaceCustomersInStore(customers);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 },
    );
  }
}
