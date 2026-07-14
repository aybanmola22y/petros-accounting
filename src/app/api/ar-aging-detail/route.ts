import { NextResponse } from "next/server";
import type { ImportedArAgingDetailSnapshot } from "@/lib/ar-aging-detail-import";
import {
  listArAgingDetailLinesFromDb,
  replaceArAgingDetailLinesInDb,
} from "@/lib/ar-aging-detail/repository";
import { importedArAgingDetailToLocationMap } from "@/lib/ar-aging-detail-import";
import { upsertSalesTransactionLocationsInDb } from "@/lib/sales-transactions/locations-repository";
import {
  listSalesTransactionsFromDb,
} from "@/lib/sales-transactions/repository";
import { replaceSalesTransactionsInStore } from "@/lib/mock-data/store";

export async function GET() {
  try {
    const { asOf, lines } = await listArAgingDetailLinesFromDb();
    return NextResponse.json({ asOf, lines, count: lines.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load AR ageing detail." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ImportedArAgingDetailSnapshot & {
      lines?: ImportedArAgingDetailSnapshot["lines"];
    };

    const lines = body.lines ?? [];
    if (!lines.length) {
      return NextResponse.json({ error: "No AR ageing detail rows to import." }, { status: 400 });
    }

    const asOf = body.asOf?.trim() ?? "";
    const saved = await replaceArAgingDetailLinesInDb({ asOf, lines });
    await upsertSalesTransactionLocationsInDb(importedArAgingDetailToLocationMap(lines));

    const salesTransactions = await listSalesTransactionsFromDb();
    replaceSalesTransactionsInStore(salesTransactions);

    return NextResponse.json({
      saved,
      count: lines.length,
      asOf,
      lines,
      salesTransactions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import AR ageing detail." },
      { status: 500 },
    );
  }
}
