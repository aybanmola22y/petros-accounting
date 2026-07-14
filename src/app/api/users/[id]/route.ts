import { NextResponse } from "next/server";
import { deleteAppUserInDb, updateAppUserInDb } from "@/lib/users/repository";
import type { UserRole, UserStatus } from "@/lib/users/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      role?: UserRole;
      status?: UserStatus;
      password?: string;
    };

    const user = await updateAppUserInDb(id, body);
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user.";
    const status = /missing/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteAppUserInDb(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user.";
    const status =
      /Super Admin/i.test(message)
        ? 400
        : /not found/i.test(message)
          ? 404
          : /missing/i.test(message)
            ? 503
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
