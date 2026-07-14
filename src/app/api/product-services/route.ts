import { NextResponse } from "next/server";
import { replaceProductServicesInStore } from "@/lib/mock-data/store";
import type { CreateProductServiceInput } from "@/lib/mock-data/products-services";
import {
  createProductServiceInDb,
  importProductServicesInDb,
  listProductServicesFromDb,
  updateProductServiceInDb,
} from "@/lib/product-services/repository";
import type { ParsedProductServiceImportPayload } from "@/lib/product-services/types";

export async function GET() {
  try {
    const productServices = await listProductServicesFromDb();
    replaceProductServicesInStore(productServices);
    return NextResponse.json({ productServices, count: productServices.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load products and services." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { input?: CreateProductServiceInput };
    if (!body.input) {
      return NextResponse.json({ error: "Product or service input is required." }, { status: 400 });
    }

    const productService = await createProductServiceInDb(body.input);
    const productServices = await listProductServicesFromDb();
    replaceProductServicesInStore(productServices);
    return NextResponse.json({ productService, productServices });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create product or service." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      replace?: boolean;
      rows?: ParsedProductServiceImportPayload[];
    };

    if (!body.rows?.length) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }

    const result = await importProductServicesInDb(body.rows, { replace: body.replace });
    const productServices = await listProductServicesFromDb();
    replaceProductServicesInStore(productServices);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      itemType?: string;
      sku?: string | null;
      category?: string | null;
      className?: string | null;
      salesDescription?: string | null;
      salesPrice?: number | null;
      cost?: number | null;
      qtyOnHand?: number | null;
      reorderPoint?: number | null;
      isActive?: boolean;
    };

    if (!body.id) {
      return NextResponse.json({ error: "Product or service id is required." }, { status: 400 });
    }

    const productService = await updateProductServiceInDb(body.id, {
      name: body.name,
      itemType: body.itemType,
      sku: body.sku,
      category: body.category,
      className: body.className,
      salesDescription: body.salesDescription,
      salesPrice: body.salesPrice,
      cost: body.cost,
      qtyOnHand: body.qtyOnHand,
      reorderPoint: body.reorderPoint,
      isActive: body.isActive,
    });

    if (!productService) {
      return NextResponse.json({ error: "Product or service not found." }, { status: 404 });
    }

    const productServices = await listProductServicesFromDb();
    replaceProductServicesInStore(productServices);
    return NextResponse.json({ productService, productServices });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update product or service." },
      { status: 500 },
    );
  }
}
