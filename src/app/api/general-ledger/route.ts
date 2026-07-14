import { NextResponse } from "next/server";
import type { ImportedGeneralLedgerRow } from "@/lib/general-ledger-import";
import {
  clearGeneralLedgerInDb,
  createManualBankTransactionInDb,
  getGeneralLedgerSummary,
  insertGeneralLedgerBatchInDb,
  listGeneralLedgerRowsForAccount,
} from "@/lib/general-ledger/repository";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (accountId) {
      const result = await listGeneralLedgerRowsForAccount(accountId);
      return NextResponse.json(result);
    }

    const summary = await getGeneralLedgerSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load General Ledger." },
      { status: 500 },
    );
  }
}

type GeneralLedgerBatchBody = {
  periodLabel?: string;
  rows?: ImportedGeneralLedgerRow[];
  /** First chunk clears existing rows before inserting. */
  replace?: boolean;
};

type ManualBankTransactionBody = {
  accountId?: string;
  txnDate?: string;
  transactionType?: string;
  refNumber?: string;
  payeeName?: string;
  description?: string;
  splitAccount?: string;
  direction?: "payment" | "deposit";
  amount?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ManualBankTransactionBody;

    if (!body.accountId || !body.txnDate || !body.direction || body.amount === undefined) {
      return NextResponse.json(
        { error: "Account, date, transaction direction, and amount are required." },
        { status: 400 },
      );
    }

    const row = await createManualBankTransactionInDb({
      accountId: body.accountId,
      txnDate: body.txnDate,
      transactionType: body.transactionType ?? "Manual Entry",
      refNumber: body.refNumber,
      payeeName: body.payeeName,
      description: body.description,
      splitAccount: body.splitAccount,
      direction: body.direction,
      amount: Number(body.amount),
    });

    return NextResponse.json({ row }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add bank transaction." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as GeneralLedgerBatchBody;

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No General Ledger rows to import." }, { status: 400 });
    }

    if (body.replace) {
      await clearGeneralLedgerInDb();
    }

    const result = await insertGeneralLedgerBatchInDb(body.rows, body.periodLabel ?? "All Dates");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import General Ledger." },
      { status: 500 },
    );
  }
}
