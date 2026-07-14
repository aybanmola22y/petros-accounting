import { NextResponse } from "next/server";
import {
  listSalesTransactionLocationsFromDb,
  replaceSalesTransactionLocationsInDb,
  upsertSalesTransactionLocationsInDb,
} from "@/lib/sales-transactions/locations-repository";
import {
  listSalesTransactionsFromDb,
} from "@/lib/sales-transactions/repository";
import { replaceSalesTransactionsInStore } from "@/lib/mock-data/store";

function locationsFromBody(body: {
  locations?: Record<string, string>;
  rows?: Array<{ referenceNumber?: string; location?: string }>;
}): Map<string, string> {
  const map = new Map<string, string>();

  if (body.locations) {
    for (const [referenceNumber, location] of Object.entries(body.locations)) {
      const number = referenceNumber.trim();
      const value = location.trim();
      if (number && value) map.set(number, value);
    }
  }

  for (const row of body.rows ?? []) {
    const number = row.referenceNumber?.trim() ?? "";
    const location = row.location?.trim() ?? "";
    if (number && location) map.set(number, location);
  }

  return map;
}

export async function GET() {
  try {
    const locations = await listSalesTransactionLocationsFromDb();
    return NextResponse.json({
      locations: Object.fromEntries(locations.entries()),
      count: locations.size,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load sales transaction locations.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      replace?: boolean;
      locations?: Record<string, string>;
      rows?: Array<{ referenceNumber?: string; location?: string }>;
    };

    const locations = locationsFromBody(body);
    if (locations.size === 0) {
      return NextResponse.json({ error: "No locations to import." }, { status: 400 });
    }

    const upserted = body.replace
      ? await replaceSalesTransactionLocationsInDb(locations)
      : await upsertSalesTransactionLocationsInDb(locations);

    const salesTransactions = await listSalesTransactionsFromDb();
    replaceSalesTransactionsInStore(salesTransactions);

    return NextResponse.json({
      upserted,
      replaced: body.replace ?? false,
      count: locations.size,
      salesTransactions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to import sales transaction locations.",
      },
      { status: 500 },
    );
  }
}
