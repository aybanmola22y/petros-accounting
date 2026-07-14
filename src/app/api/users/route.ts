import { NextResponse } from "next/server";
import {
  createAppUserInDb,
  listAppUsersFromDb,
} from "@/lib/users/repository";
import type { CreateAppUserInput, UserRole, UserStatus } from "@/lib/users/types";

export async function GET() {
  try {
    const users = await listAppUsersFromDb();
    return NextResponse.json({ users, count: users.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load users." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateAppUserInput;
    const email = body.email?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    if (!email || !name) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 },
      );
    }

    const user = await createAppUserInDb({
      email,
      name,
      role: body.role as UserRole | undefined,
      status: body.status as UserStatus | undefined,
      password: body.password,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user.";
    const status =
      /already exists/i.test(message) ? 409 : /missing/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
