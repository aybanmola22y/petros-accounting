import { NextResponse } from "next/server";
import { restoreBackupSnapshot } from "@/lib/backup/restore-backup";
import { isBackupSnapshot } from "@/lib/backup/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!isBackupSnapshot(body)) {
      return NextResponse.json(
        { error: "Invalid backup file. Choose a Petrosphere backup JSON." },
        { status: 400 },
      );
    }

    const result = await restoreBackupSnapshot(body);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.errors[0] ?? "Restore failed.",
          restored: result.restored,
          errors: result.errors,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      restored: result.restored,
      message: "Backup restored successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to restore backup.",
      },
      { status: 500 },
    );
  }
}
