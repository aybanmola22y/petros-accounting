import { NextResponse } from "next/server";
import type { ImportedArAgingSummarySnapshot } from "@/lib/ar-aging-summary-import";
import {
  listArAgingSummaryRowsFromDb,
  replaceArAgingSummaryRowsInDb,
} from "@/lib/ar-aging-summary/repository";

export async function GET() {
  try {
    const snapshot = await listArAgingSummaryRowsFromDb();
    return NextResponse.json({
      snapshot,
      count: snapshot?.rows.length ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load AR ageing summary." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ImportedArAgingSummarySnapshot;

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No summary rows to import." }, { status: 400 });
    }

    const saved = await replaceArAgingSummaryRowsInDb(body);

    return NextResponse.json({
      saved,
      count: body.rows.length,
      snapshot: body,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import AR ageing summary." },
      { status: 500 },
    );
  }
}
