import { NextResponse } from "next/server";
import { buildBackupSnapshot } from "@/lib/backup/export-backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const snapshot = await buildBackupSnapshot();
    const stamp = snapshot.createdAt.slice(0, 10);
    return NextResponse.json(snapshot, {
      headers: {
        "Content-Disposition": `attachment; filename="petrosphere-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create backup.",
      },
      { status: 500 },
    );
  }
}
