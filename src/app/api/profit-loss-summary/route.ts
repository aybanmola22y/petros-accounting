import { NextResponse } from "next/server";
import { listChartAccountsFromDb } from "@/lib/chart-of-accounts/repository";
import { listExpenseTransactionsFromDb } from "@/lib/expense-transactions/repository";
import { computeProfitLossAccountRows } from "@/lib/ledger/profit-loss-ledger-lines";
import type { ImportedProfitLossSnapshot } from "@/lib/profit-loss-summary-import";
import { profitLossPeriodLabelToRange } from "@/lib/profit-loss-summary/merge-snapshots";
import {
  listProfitLossImportPackageFromDb,
  replaceProfitLossImportPackageInDb,
} from "@/lib/profit-loss-summary/repository";
import { listSalesTransactionsFromDb } from "@/lib/sales-transactions/repository";

async function computeLedgerBaseline(
  periodLabel: string,
): Promise<ImportedProfitLossSnapshot> {
  const [salesTransactions, expenses, chartAccounts] = await Promise.all([
    listSalesTransactionsFromDb(),
    listExpenseTransactionsFromDb(),
    listChartAccountsFromDb(),
  ]);

  const range = profitLossPeriodLabelToRange(periodLabel);
  const baselineRows = computeProfitLossAccountRows({
    salesTransactions,
    expenses,
    chartAccounts,
    range,
    basis: "Accrual",
  });

  return { periodLabel, rows: baselineRows };
}

export async function GET() {
  try {
    const pkg = await listProfitLossImportPackageFromDb();
    if (!pkg) {
      return NextResponse.json({ snapshot: null, baseline: null, count: 0 });
    }

    return NextResponse.json({
      snapshot: pkg.imported,
      baseline: pkg.baseline,
      count: pkg.imported.rows.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Profit and Loss." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ImportedProfitLossSnapshot;

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No P&L rows to import." }, { status: 400 });
    }

    const baseline = await computeLedgerBaseline(body.periodLabel);
    const saved = await replaceProfitLossImportPackageInDb(body, baseline);

    return NextResponse.json({
      saved,
      count: body.rows.length,
      snapshot: body,
      baseline,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import Profit and Loss." },
      { status: 500 },
    );
  }
}
