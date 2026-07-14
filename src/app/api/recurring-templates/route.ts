import { NextResponse } from "next/server";
import type { MockRecurringTemplate } from "@/lib/mock-data/recurring-transactions";
import { replaceRecurringTemplatesInStore } from "@/lib/mock-data/store";
import {
  createRecurringTemplateInDb,
  deleteRecurringTemplateInDb,
  listRecurringTemplatesFromDb,
  updateRecurringTemplateInDb,
} from "@/lib/recurring-templates/repository";

export async function GET() {
  try {
    const recurringTemplates = await listRecurringTemplatesFromDb();
    replaceRecurringTemplatesInStore(recurringTemplates);
    return NextResponse.json({ recurringTemplates, count: recurringTemplates.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load recurring templates." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { template?: Omit<MockRecurringTemplate, "id"> };
    if (!body.template) {
      return NextResponse.json({ error: "Recurring template payload is required." }, { status: 400 });
    }

    const recurringTemplate = await createRecurringTemplateInDb(body.template);
    const recurringTemplates = await listRecurringTemplatesFromDb();
    replaceRecurringTemplatesInStore(recurringTemplates);
    return NextResponse.json({ recurringTemplate, recurringTemplates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create recurring template." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Recurring template id is required." }, { status: 400 });
    }

    const deleted = await deleteRecurringTemplateInDb(body.id);
    if (!deleted) {
      return NextResponse.json({ error: "Recurring template not found." }, { status: 404 });
    }

    const recurringTemplates = await listRecurringTemplatesFromDb();
    replaceRecurringTemplatesInStore(recurringTemplates);
    return NextResponse.json({ ok: true, recurringTemplates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete recurring template." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      patch?: Partial<MockRecurringTemplate>;
    };
    if (!body.id) {
      return NextResponse.json({ error: "Recurring template id is required." }, { status: 400 });
    }
    if (!body.patch) {
      return NextResponse.json({ error: "Recurring template patch is required." }, { status: 400 });
    }

    const recurringTemplate = await updateRecurringTemplateInDb(body.id, body.patch);
    if (!recurringTemplate) {
      return NextResponse.json({ error: "Recurring template not found." }, { status: 404 });
    }

    const recurringTemplates = await listRecurringTemplatesFromDb();
    replaceRecurringTemplatesInStore(recurringTemplates);
    return NextResponse.json({ recurringTemplate, recurringTemplates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update recurring template." },
      { status: 500 },
    );
  }
}
