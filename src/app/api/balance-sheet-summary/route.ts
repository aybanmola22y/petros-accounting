import { NextResponse } from "next/server";
import { listChartAccountsFromDb } from "@/lib/chart-of-accounts/repository";
import { listExpenseTransactionsFromDb } from "@/lib/expense-transactions/repository";
import {
  balanceSheetAsOfRange,
  balanceSheetPeriodLabelToAsOf,
} from "@/lib/balance-sheet-summary/merge-snapshots";
import type { ImportedBalanceSheetSnapshot } from "@/lib/balance-sheet-summary-import";
import {
  listBalanceSheetImportPackageFromDb,
  replaceBalanceSheetImportPackageInDb,
} from "@/lib/balance-sheet-summary/repository";
import { computeBalanceSheetAccountRows } from "@/lib/ledger/compute-balance-sheet";
import { listSalesTransactionsFromDb } from "@/lib/sales-transactions/repository";

async function computeLedgerBaseline(
  periodLabel: string,
): Promise<ImportedBalanceSheetSnapshot> {
  const [salesTransactions, expenses, chartAccounts] = await Promise.all([
    listSalesTransactionsFromDb(),
    listExpenseTransactionsFromDb(),
    listChartAccountsFromDb(),
  ]);

  const asOf = balanceSheetPeriodLabelToAsOf(periodLabel);
  const range = balanceSheetAsOfRange(asOf);
  const baselineRows = computeBalanceSheetAccountRows({
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
    const pkg = await listBalanceSheetImportPackageFromDb();
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
      { error: error instanceof Error ? error.message : "Failed to load Balance Sheet." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ImportedBalanceSheetSnapshot;

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No Balance Sheet rows to import." }, { status: 400 });
    }

    const baseline = await computeLedgerBaseline(body.periodLabel);
    const saved = await replaceBalanceSheetImportPackageInDb(body, baseline);

    return NextResponse.json({
      saved,
      count: body.rows.length,
      snapshot: body,
      baseline,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import Balance Sheet." },
      { status: 500 },
    );
  }
}
