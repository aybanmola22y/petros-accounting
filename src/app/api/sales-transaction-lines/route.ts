import { NextResponse } from "next/server";
import {
  listSalesTransactionLinesFromDb,
  replaceSalesTransactionLinesInDb,
  type SalesTransactionLineInsert,
} from "@/lib/sales-transactions/lines-repository";

type ImportLinePayload = {
  referenceNumber: string;
  productService?: string;
  description?: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  sortOrder?: number;
};

export async function GET() {
  try {
    const lines = await listSalesTransactionLinesFromDb();
    const invoiceCount = Object.keys(lines).length;
    return NextResponse.json({ lines, invoiceCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load invoice lines." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { rows?: ImportLinePayload[] };
    if (!body.rows?.length) {
      return NextResponse.json({ error: "No line items to import." }, { status: 400 });
    }

    const rows: SalesTransactionLineInsert[] = body.rows
      .filter((row) => row.referenceNumber?.trim())
      .map((row, index) => ({
        reference_number: row.referenceNumber.trim(),
        sort_order: row.sortOrder ?? index,
        product_service: row.productService?.trim() || null,
        description: row.description?.trim() || null,
        quantity: row.quantity == null ? null : Number(row.quantity),
        rate: row.rate == null ? null : Number(row.rate),
        amount: row.amount == null ? null : Number(row.amount),
      }));

    const inserted = await replaceSalesTransactionLinesInDb(rows);
    const lines = await listSalesTransactionLinesFromDb();

    return NextResponse.json({
      inserted,
      invoiceCount: Object.keys(lines).length,
      lines,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 },
    );
  }
}
