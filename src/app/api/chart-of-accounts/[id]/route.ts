import { NextResponse } from "next/server";
import { updateChartAccountInDb } from "@/lib/chart-of-accounts/repository";
import { listChartAccountsFromDb } from "@/lib/chart-of-accounts/repository";
import { replaceChartAccountsInStore } from "@/lib/mock-data/store";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      number?: string;
      name?: string;
      accountType?: string;
      detailType?: string;
      currency?: string;
      tax?: string;
      ledgerBalance?: number;
      bankBalance?: number | null;
      bankConnected?: boolean;
      isActive?: boolean;
    };

    const account = await updateChartAccountInDb(id, {
      ...(body.number !== undefined ? { account_number: body.number } : {}),
      ...(body.name !== undefined ? { account_name: body.name } : {}),
      ...(body.accountType !== undefined ? { account_type: body.accountType } : {}),
      ...(body.detailType !== undefined ? { detail_type: body.detailType } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.tax !== undefined ? { tax: body.tax } : {}),
      ...(body.ledgerBalance !== undefined ? { ledger_balance: body.ledgerBalance } : {}),
      ...(body.bankBalance !== undefined ? { bank_balance: body.bankBalance } : {}),
      ...(body.bankConnected !== undefined ? { bank_connected: body.bankConnected } : {}),
      ...(body.isActive !== undefined ? { is_active: body.isActive } : {}),
    });

    const accounts = await listChartAccountsFromDb();
    replaceChartAccountsInStore(accounts);

    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update account.",
      },
      { status: 500 },
    );
  }
}
