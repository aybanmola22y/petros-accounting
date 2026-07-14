import { NextResponse } from "next/server";
import {
  importChartAccountsInDb,
  insertChartAccountInDb,
  listChartAccountsFromDb,
} from "@/lib/chart-of-accounts/repository";
import { mockChartAccountToInsert } from "@/lib/chart-of-accounts/types";
import { replaceChartAccountsInStore } from "@/lib/mock-data/store";
import { relinkGeneralLedgerAccountsInDb, syncChartAccountBalancesFromGeneralLedgerInDb } from "@/lib/general-ledger/repository";

export async function GET(request: Request) {
  try {
    const syncGl = new URL(request.url).searchParams.get("syncGl") === "1";
    if (syncGl) {
      await relinkGeneralLedgerAccountsInDb();
      await syncChartAccountBalancesFromGeneralLedgerInDb();
    }

    const accounts = await listChartAccountsFromDb();
    replaceChartAccountsInStore(accounts);
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load chart of accounts.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      number?: string;
      name?: string;
      accountType?: string;
      detailType?: string;
      currency?: string;
      tax?: string;
      ledgerBalance?: number;
      isActive?: boolean;
    };

    if (!body.name?.trim() || !body.accountType?.trim()) {
      return NextResponse.json(
        { error: "Account name and account type are required." },
        { status: 400 },
      );
    }

    const account = await insertChartAccountInDb(
      mockChartAccountToInsert({
        number: body.number,
        name: body.name,
        accountType: body.accountType,
        detailType: body.detailType,
        currency: body.currency,
        tax: body.tax,
        ledgerBalance: body.ledgerBalance,
        isActive: body.isActive,
      }),
    );

    // A newly added account may correspond to already-imported GL rows.
    await relinkGeneralLedgerAccountsInDb();

    const accounts = await listChartAccountsFromDb();
    replaceChartAccountsInStore(accounts);

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create account.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      replace?: boolean;
      hasBalanceColumn?: boolean;
      hasBankBalanceColumn?: boolean;
      rows?: Array<{
        rowNumber?: number;
        number?: string;
        name: string;
        accountType: string;
        detailType?: string;
        currency?: string;
        ledgerBalance?: number;
        bankBalance?: number;
      }>;
    };

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }

    const result = await importChartAccountsInDb(body.rows, {
      replace: body.replace,
      hasBalanceColumn: body.hasBalanceColumn ?? true,
      hasBankBalanceColumn: body.hasBankBalanceColumn ?? true,
    });

    // Only relink GL when new accounts were added — balance-only updates don't need it.
    if (result.added.length > 0 || result.replaced) {
      await relinkGeneralLedgerAccountsInDb();
    }
    // When balances came from the import file, keep them — don't overwrite from GL.
    if (!body.hasBalanceColumn) {
      await syncChartAccountBalancesFromGeneralLedgerInDb();
    }

    const accounts = await listChartAccountsFromDb();
    replaceChartAccountsInStore(accounts);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed.",
      },
      { status: 500 },
    );
  }
}
