import { NextResponse } from "next/server";
import {
  createUnpaidBillInDb,
  importUnpaidBillsInDb,
  listUnpaidBillsFromDb,
  type ParsedUnpaidBillImportPayload,
} from "@/lib/unpaid-bills/repository";
import { replaceUnpaidBillsInStore } from "@/lib/mock-data/store";

export async function GET() {
  try {
    const unpaidBills = await listUnpaidBillsFromDb();
    replaceUnpaidBillsInStore(unpaidBills);
    return NextResponse.json({ unpaidBills, count: unpaidBills.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load unpaid bills." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      replace?: boolean;
      rows?: ParsedUnpaidBillImportPayload[];
    };

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }

    const result = await importUnpaidBillsInDb(body.rows, { replace: body.replace });
    const unpaidBills = await listUnpaidBillsFromDb();
    replaceUnpaidBillsInStore(unpaidBills);

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
      supplierName?: string;
      dueDate?: string;
      billAmount?: number;
      openBalance?: number;
      status?: string;
      supplierId?: string | null;
    };

    if (!body.supplierName?.trim()) {
      return NextResponse.json({ error: "Supplier name is required." }, { status: 400 });
    }
    if (!body.dueDate?.trim()) {
      return NextResponse.json({ error: "Due date is required." }, { status: 400 });
    }
    if (body.billAmount == null || body.billAmount <= 0) {
      return NextResponse.json({ error: "Bill amount must be greater than zero." }, { status: 400 });
    }

    const unpaidBill = await createUnpaidBillInDb({
      supplierName: body.supplierName,
      dueDate: body.dueDate,
      billAmount: body.billAmount,
      openBalance: body.openBalance,
      status: body.status,
      supplierId: body.supplierId,
    });
    const unpaidBills = await listUnpaidBillsFromDb();
    replaceUnpaidBillsInStore(unpaidBills);
    return NextResponse.json({ unpaidBill, unpaidBills });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create unpaid bill." },
      { status: 500 },
    );
  }
}
