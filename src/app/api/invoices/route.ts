import { NextResponse } from "next/server";
import {
  createInvoiceInDb,
  deleteInvoiceInDb,
  listInvoicesFromDb,
  updateInvoiceInDb,
} from "@/lib/invoices/repository";
import { deleteSalesTransactions, replaceInvoicesInStore } from "@/lib/mock-data/store";
import type { MockInvoice } from "@/lib/mock-data/types";

export async function GET() {
  try {
    const invoices = await listInvoicesFromDb();
    replaceInvoicesInStore(invoices);
    return NextResponse.json({ invoices, count: invoices.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load invoices." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { invoice?: Omit<MockInvoice, "id"> };
    if (!body.invoice) {
      return NextResponse.json({ error: "Invoice payload is required." }, { status: 400 });
    }

    const invoice = await createInvoiceInDb(body.invoice);
    const invoices = await listInvoicesFromDb();
    replaceInvoicesInStore(invoices);
    return NextResponse.json({ invoice, invoices });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create invoice." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      patch?: Partial<MockInvoice>;
    };

    if (!body.id || !body.patch) {
      return NextResponse.json({ error: "Invoice id and patch are required." }, { status: 400 });
    }

    const invoice = await updateInvoiceInDb(body.id, body.patch);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    const invoices = await listInvoicesFromDb();
    replaceInvoicesInStore(invoices);
    return NextResponse.json({ invoice, invoices });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update invoice." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Invoice id is required." }, { status: 400 });
    }

    const result = await deleteInvoiceInDb(body.id);
    if (!result.deleted) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    if (result.deletedSalesIds.length > 0) {
      deleteSalesTransactions(result.deletedSalesIds);
    }

    const invoices = await listInvoicesFromDb();
    replaceInvoicesInStore(invoices);
    return NextResponse.json({
      ok: true,
      invoices,
      deletedSalesIds: result.deletedSalesIds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete invoice." },
      { status: 500 },
    );
  }
}
