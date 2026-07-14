import { NextResponse } from "next/server";
import {
  importLeadsInDb,
  listLeadsFromDb,
  type ParsedLeadImportPayload,
} from "@/lib/leads/repository";
import { replaceLeadsInStore } from "@/lib/mock-data/store";

export async function GET() {
  try {
    const leads = await listLeadsFromDb();
    replaceLeadsInStore(leads);
    return NextResponse.json({ leads, count: leads.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load leads." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      replace?: boolean;
      rows?: ParsedLeadImportPayload[];
    };

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }

    const result = await importLeadsInDb(body.rows, { replace: body.replace });
    const leads = await listLeadsFromDb();
    replaceLeadsInStore(leads);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 },
    );
  }
}
