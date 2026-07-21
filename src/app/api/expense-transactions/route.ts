import { NextResponse } from "next/server";
import type { MockExpenseTransaction } from "@/lib/mock-data/expenses";
import {
  createExpenseTransactionInDb,
  deleteExpenseTransactionsInDb,
  importExpenseTransactionsInDb,
  listExpenseTransactionsFromDb,
  repairImportedExpenseDateTimezoneIfNeeded,
  updateExpenseTransactionInDb,
} from "@/lib/expense-transactions/repository";
import { replaceExpensesInStore } from "@/lib/mock-data/store";

export async function GET() {
  try {
    await repairImportedExpenseDateTimezoneIfNeeded();
    const expenses = await listExpenseTransactionsFromDb();
    replaceExpensesInStore(expenses);
    return NextResponse.json(
      { expenses, count: expenses.length },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load expense transactions.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      replace?: boolean;
      rows?: Array<{
        rowNumber: number;
        date: string;
        transactionType: string;
        referenceNumber: string;
        payee: string;
        category: string;
        totalBeforeTax: number;
        salesTax: number;
        total: number;
        isSplit: boolean;
        status: string;
      }>;
    };

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }

    const result = await importExpenseTransactionsInDb(body.rows, { replace: body.replace });
    // Prefer imported rows when replace was used; otherwise reload once.
    if (body.replace) {
      replaceExpensesInStore(result.added);
    } else {
      const expenses = await listExpenseTransactionsFromDb();
      replaceExpensesInStore(expenses);
    }

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { expense?: Omit<MockExpenseTransaction, "id"> };
    if (!body.expense) {
      return NextResponse.json({ error: "Expense payload is required." }, { status: 400 });
    }

    const expense = await createExpenseTransactionInDb(body.expense);
    return NextResponse.json({ expense });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create expense." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      patch?: Partial<MockExpenseTransaction>;
    };

    if (!body.id || !body.patch) {
      return NextResponse.json({ error: "Expense id and patch are required." }, { status: 400 });
    }

    const expense = await updateExpenseTransactionInDb(body.id, body.patch);
    if (!expense) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    return NextResponse.json({ expense });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update expense." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] };
    if (!body.ids?.length) {
      return NextResponse.json({ error: "Expense ids are required." }, { status: 400 });
    }

    await deleteExpenseTransactionsInDb(body.ids);
    return NextResponse.json({ ok: true, ids: body.ids });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete expenses." },
      { status: 500 },
    );
  }
}
