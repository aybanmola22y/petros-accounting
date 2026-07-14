import { NextResponse } from "next/server";
import type { MockSalesTransaction } from "@/lib/mock-data/sales";
import {
  createSalesTransactionInDb,
  deleteSalesTransactionsInDb,
  importSalesTransactionsInDb,
  listSalesTransactionsFromDb,
  updateSalesTransactionInDb,
  type ParsedSalesTransactionImportPayload,
} from "@/lib/sales-transactions/repository";
import { replaceSalesTransactionsInStore } from "@/lib/mock-data/store";

export async function GET() {
  try {
    const salesTransactions = await listSalesTransactionsFromDb();
    replaceSalesTransactionsInStore(salesTransactions);
    return NextResponse.json({ salesTransactions, count: salesTransactions.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sales transactions." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      replace?: boolean;
      rows?: ParsedSalesTransactionImportPayload[];
    };

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }

    const result = await importSalesTransactionsInDb(body.rows, { replace: body.replace });
    const salesTransactions = await listSalesTransactionsFromDb();
    replaceSalesTransactionsInStore(salesTransactions);

    return NextResponse.json({ ...result, salesTransactions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      transaction?: Omit<MockSalesTransaction, "id">;
    };
    if (!body.transaction) {
      return NextResponse.json({ error: "Sales transaction payload is required." }, { status: 400 });
    }

    const salesTransaction = await createSalesTransactionInDb(body.transaction);
    const salesTransactions = await listSalesTransactionsFromDb();
    replaceSalesTransactionsInStore(salesTransactions);
    return NextResponse.json({ salesTransaction, salesTransactions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sales transaction." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      patch?: Partial<Omit<MockSalesTransaction, "id">>;
    };

    if (!body.id || !body.patch) {
      return NextResponse.json(
        { error: "Sales transaction id and patch are required." },
        { status: 400 },
      );
    }

    const salesTransaction = await updateSalesTransactionInDb(body.id, body.patch);
    if (!salesTransaction) {
      return NextResponse.json({ error: "Sales transaction not found." }, { status: 404 });
    }

    const salesTransactions = await listSalesTransactionsFromDb();
    replaceSalesTransactionsInStore(salesTransactions);
    return NextResponse.json({ salesTransaction, salesTransactions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update sales transaction." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] };
    if (!body.ids?.length) {
      return NextResponse.json({ error: "Sales transaction ids are required." }, { status: 400 });
    }

    await deleteSalesTransactionsInDb(body.ids);
    const salesTransactions = await listSalesTransactionsFromDb();
    replaceSalesTransactionsInStore(salesTransactions);
    return NextResponse.json({ ok: true, salesTransactions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete sales transactions." },
      { status: 500 },
    );
  }
}
