import { replaceRecurringTemplatesInStore } from "@/lib/mock-data/store";
import type { MockRecurringTemplate } from "@/lib/mock-data/recurring-transactions";

type RecurringTemplateListResponse = {
  recurringTemplates?: MockRecurringTemplate[];
  recurringTemplate?: MockRecurringTemplate;
  error?: string;
};

async function readResponse(response: Response): Promise<RecurringTemplateListResponse> {
  return (await response.json()) as RecurringTemplateListResponse;
}

function syncTemplates(payload: RecurringTemplateListResponse) {
  if (payload.recurringTemplates) {
    replaceRecurringTemplatesInStore(payload.recurringTemplates);
  }
}

export async function fetchRecurringTemplatesFromApi(): Promise<MockRecurringTemplate[]> {
  const response = await fetch("/api/recurring-templates");
  const payload = await readResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load recurring templates.");
  }
  const recurringTemplates = payload.recurringTemplates ?? [];
  replaceRecurringTemplatesInStore(recurringTemplates);
  return recurringTemplates;
}

export async function createRecurringTemplateViaApi(
  input: Omit<MockRecurringTemplate, "id">,
): Promise<MockRecurringTemplate> {
  const response = await fetch("/api/recurring-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template: input }),
  });
  const payload = await readResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to create recurring template.");
  }
  if (!payload.recurringTemplate) {
    throw new Error("Recurring template was not returned from the server.");
  }
  syncTemplates(payload);
  return payload.recurringTemplate;
}

export async function updateRecurringTemplateViaApi(
  id: string,
  patch: Partial<MockRecurringTemplate>,
): Promise<MockRecurringTemplate> {
  const response = await fetch("/api/recurring-templates", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, patch }),
  });
  const payload = await readResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to update recurring template.");
  }
  if (!payload.recurringTemplate) {
    throw new Error("Recurring template was not returned from the server.");
  }
  syncTemplates(payload);
  return payload.recurringTemplate;
}

export async function deleteRecurringTemplateViaApi(id: string): Promise<void> {
  const response = await fetch("/api/recurring-templates", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const payload = await readResponse(response);
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to delete recurring template.");
  }
  syncTemplates(payload);
}
