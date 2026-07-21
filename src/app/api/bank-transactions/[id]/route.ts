import { NextResponse } from "next/server";
import {
  postBankTransactionInDb,
  upsertBankTransactionMetaInDb,
} from "@/lib/bank-transactions/repository";
import type { BankTransactionTab } from "@/lib/bank-transactions/types";

type PatchBody = {
  accountId?: string;
  glRowId?: string | null;
  status?: BankTransactionTab;
  categoryLabel?: string;
  payeeName?: string;
  bankDescription?: string;
  notes?: string;
  action?: "post";
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;
    if (!body.accountId) {
      return NextResponse.json({ error: "accountId is required." }, { status: 400 });
    }

    if (body.action === "post") {
      await postBankTransactionInDb({
        accountId: body.accountId,
        metaId: id,
        glRowId: body.glRowId ?? undefined,
        categoryLabel: body.categoryLabel,
        payeeName: body.payeeName,
      });
      return NextResponse.json({ ok: true });
    }

    await upsertBankTransactionMetaInDb({
      id: body.glRowId ? undefined : id,
      accountId: body.accountId,
      glRowId: body.glRowId ?? id,
      status: body.status,
      categoryLabel: body.categoryLabel,
      payeeName: body.payeeName,
      bankDescription: body.bankDescription,
      notes: body.notes,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update bank transaction." },
      { status: 500 },
    );
  }
}
