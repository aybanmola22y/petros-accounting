import { NextResponse } from "next/server";
import { listChartAccountsFromDb } from "@/lib/chart-of-accounts/repository";
import { listBankAccountActivity } from "@/lib/general-ledger/repository";
import { buildDashboardBankAccountRows } from "@/lib/mock-data/bank-accounts";

export async function GET() {
  try {
    const chartAccounts = await listChartAccountsFromDb();
    const bankRows = buildDashboardBankAccountRows(chartAccounts);
    const activity = await listBankAccountActivity(bankRows.map((row) => row.id));
    return NextResponse.json({ activity });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load bank account activity.",
      },
      { status: 500 },
    );
  }
}
