import { NextResponse } from "next/server";
import {
  applyRecurringDetailsMigration,
  recurringTemplateDetailsColumnExists,
} from "@/lib/recurring-templates/migrate";

export async function GET() {
  try {
    const exists = await recurringTemplateDetailsColumnExists();
    return NextResponse.json({
      ok: true,
      detailsColumnExists: exists,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to check migration status.",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  const result = await applyRecurringDetailsMigration();
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 503 });
  }
  return NextResponse.json({ ok: true, message: result.message });
}
