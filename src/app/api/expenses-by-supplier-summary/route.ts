import { NextResponse } from "next/server";
import type { ImportedExpensesBySupplierSnapshot } from "@/lib/expenses-by-supplier-summary-import";
import {
  listExpensesBySupplierSummaryFromDb,
  replaceExpensesBySupplierSummaryInDb,
} from "@/lib/expenses-by-supplier-summary/repository";

export async function GET() {
  try {
    const snapshot = await listExpensesBySupplierSummaryFromDb();
    return NextResponse.json({
      periodLabel: snapshot.periodLabel,
      rows: snapshot.rows,
      totalAmount: snapshot.totalAmount,
      count: snapshot.rows.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Expenses by Supplier Summary.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ImportedExpensesBySupplierSnapshot;
    const rows = body.rows ?? [];
    if (!rows.length) {
      return NextResponse.json(
        { error: "No Expenses by Supplier Summary rows to import." },
        { status: 400 },
      );
    }

    const saved = await replaceExpensesBySupplierSummaryInDb({
      periodLabel: body.periodLabel?.trim() ?? "",
      rows,
      totalAmount: body.totalAmount,
    });

    return NextResponse.json({
      saved,
      count: rows.length,
      periodLabel: body.periodLabel?.trim() ?? "",
      rows,
      totalAmount: body.totalAmount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import Expenses by Supplier Summary.",
      },
      { status: 500 },
    );
  }
}
