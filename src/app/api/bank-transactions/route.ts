import { NextResponse } from "next/server";
import {
  createBankFeedLineInDb,
  listBankTransactionsFromDb,
} from "@/lib/bank-transactions/repository";
import type { BankTransactionTab } from "@/lib/bank-transactions/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required." }, { status: 400 });
    }

    const tab = searchParams.get("tab") as BankTransactionTab | null;
    const search = searchParams.get("search") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const result = await listBankTransactionsFromDb({
      accountId,
      tab: tab ?? undefined,
      search,
      from,
      to,
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=15" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load bank transactions." },
      { status: 500 },
    );
  }
}

type CreateBankFeedBody = {
  accountId?: string;
  txnDate?: string;
  bankDescription?: string;
  payeeName?: string;
  categoryLabel?: string;
  direction?: "deposit" | "payment";
  amount?: number;
  notes?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBankFeedBody;
    if (!body.accountId || !body.txnDate || !body.bankDescription || !body.direction) {
      return NextResponse.json(
        { error: "Account, date, description, and direction are required." },
        { status: 400 },
      );
    }
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
    }

    const row = await createBankFeedLineInDb({
      accountId: body.accountId,
      txnDate: body.txnDate,
      bankDescription: body.bankDescription,
      payeeName: body.payeeName,
      categoryLabel: body.categoryLabel,
      direction: body.direction,
      amount: body.amount,
      notes: body.notes,
    });

    return NextResponse.json({ row }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create bank line." },
      { status: 500 },
    );
  }
}
