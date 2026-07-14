import { NextResponse } from "next/server";
import { authenticateAppUser } from "@/lib/users/repository";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_USER_NAME,
  DEMO_USER_ROLE,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const fromDb = await authenticateAppUser(email, password);
    if (fromDb) {
      return NextResponse.json({
        user: {
          email: fromDb.email,
          name: fromDb.name,
          role: fromDb.role,
        },
      });
    }

    // Fallback while migration is not applied yet (demo only).
    if (
      email.trim().toLowerCase() === DEMO_EMAIL &&
      password === DEMO_PASSWORD
    ) {
      return NextResponse.json({
        user: {
          email: DEMO_EMAIL,
          name: DEMO_USER_NAME,
          role: DEMO_USER_ROLE,
        },
        warning: "Using demo login fallback. Apply the app_users migration to track users in Supabase.",
      });
    }

    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 500 },
    );
  }
}
