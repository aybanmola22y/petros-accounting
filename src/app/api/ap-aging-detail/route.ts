import { NextResponse } from "next/server";
import type { ImportedApAgingDetailSnapshot } from "@/lib/ap-aging-detail-import";
import {
  listApAgingDetailLinesFromDb,
  replaceApAgingDetailLinesInDb,
} from "@/lib/ap-aging-detail/repository";

export async function GET() {
  try {
    const snapshot = await listApAgingDetailLinesFromDb();
    return NextResponse.json({
      asOf: snapshot.asOf,
      lines: snapshot.lines,
      totalAmount: snapshot.totalAmount,
      totalOpenBalance: snapshot.totalOpenBalance,
      count: snapshot.lines.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load A/P ageing detail." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ImportedApAgingDetailSnapshot;
    const lines = body.lines ?? [];
    if (!lines.length) {
      return NextResponse.json({ error: "No A/P ageing detail rows to import." }, { status: 400 });
    }

    const saved = await replaceApAgingDetailLinesInDb({
      asOf: body.asOf?.trim() ?? "",
      lines,
      totalAmount: body.totalAmount,
      totalOpenBalance: body.totalOpenBalance,
    });

    return NextResponse.json({
      saved,
      count: lines.length,
      asOf: body.asOf?.trim() ?? "",
      lines,
      totalAmount: body.totalAmount,
      totalOpenBalance: body.totalOpenBalance,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import A/P ageing detail." },
      { status: 500 },
    );
  }
}
