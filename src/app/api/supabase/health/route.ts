import { NextResponse } from "next/server";
import { isSupabaseConfigured, requireSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SupabaseHealthResponse = {
  configured: boolean;
  connected: boolean;
  projectUrl?: string;
  tablesReady?: boolean;
  message: string;
  error?: string;
};

/** Verify Supabase env vars and reachability. Does not require database tables yet. */
export async function GET() {
  if (!isSupabaseConfigured()) {
    const body: SupabaseHealthResponse = {
      configured: false,
      connected: false,
      message:
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.",
    };
    return NextResponse.json(body, { status: 503 });
  }

  const { url } = requireSupabaseEnv();

  try {
    const supabase = await createSupabaseServerClient();

    // Auth ping — works even before any tables are created.
    const { error: authError } = await supabase.auth.getSession();
    if (authError) {
      const body: SupabaseHealthResponse = {
        configured: true,
        connected: false,
        projectUrl: url,
        message: "Supabase credentials are set but the connection failed.",
        error: authError.message,
      };
      return NextResponse.json(body, { status: 502 });
    }

    // Optional: detect whether chart_of_accounts exists yet.
    const { error: tableError } = await supabase
      .from("chart_of_accounts")
      .select("id")
      .limit(1);

    const tablesReady =
      !tableError ||
      !(
        tableError.code === "PGRST205" ||
        tableError.message.toLowerCase().includes("does not exist") ||
        tableError.message.toLowerCase().includes("schema cache")
      );

    const body: SupabaseHealthResponse = {
      configured: true,
      connected: true,
      projectUrl: url,
      tablesReady,
      message: tablesReady
        ? "Connected to Supabase. Database tables are ready."
        : "Connected to Supabase. Create tables in Supabase before importing data.",
    };

    return NextResponse.json(body);
  } catch (error) {
    const body: SupabaseHealthResponse = {
      configured: true,
      connected: false,
      projectUrl: url,
      message: "Supabase connection check failed.",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return NextResponse.json(body, { status: 502 });
  }
}
