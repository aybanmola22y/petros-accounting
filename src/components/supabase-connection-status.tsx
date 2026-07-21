"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SupabaseHealthResponse } from "@/app/api/supabase/health/route";
import { cn } from "@/lib/utils";

export function SupabaseConnectionStatus() {
  const [status, setStatus] = useState<SupabaseHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingTables, setCreatingTables] = useState(false);

  const checkConnection = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/supabase/health");
      const data = (await response.json()) as SupabaseHealthResponse;
      setStatus(data);
    } catch {
      setStatus({
        configured: false,
        connected: false,
        message: "Could not reach the connection check endpoint.",
        error: "Network error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  async function handleCreateTables() {
    setCreatingTables(true);
    try {
      const response = await fetch("/api/supabase/migrate", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not create tables.");
      }
      await checkConnection();
    } catch (error) {
      setStatus((prev) => ({
        configured: prev?.configured ?? true,
        connected: prev?.connected ?? true,
        tablesReady: false,
        projectUrl: prev?.projectUrl,
        message: error instanceof Error ? error.message : "Could not create tables.",
      }));
    } finally {
      setCreatingTables(false);
    }
  }

  const isOk = status?.configured && status?.connected;
  const needsTables = isOk && status?.tablesReady === false;

  return (
    <div className="rounded-xl border border-border/80 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              loading
                ? "bg-muted text-muted-foreground"
                : isOk
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-destructive/10 text-destructive",
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isOk ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold">Supabase connection</p>
            <p className="text-sm text-muted-foreground">
              {loading ? "Checking connection…" : (status?.message ?? "Connection status unknown.")}
            </p>
            {status?.projectUrl ? (
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {status.projectUrl}
              </p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={() => void checkConnection()}
          disabled={loading}
        >
          Test again
        </Button>
      </div>

      {status?.error ? (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {status.error}
        </p>
      ) : null}

      {!loading && !status?.configured ? (
        <div className="mt-3 rounded-md border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Setup steps</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Create a project at supabase.com</li>
            <li>Copy the Project URL and anon key from Settings → API</li>
            <li>
              Add them to <code className="text-xs">.env.local</code> in the project root
            </li>
            <li>
              Restart <code className="text-xs">npm run dev</code>
            </li>
          </ol>
        </div>
      ) : null}

      {needsTables ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">
            Connected, but the <code className="text-xs">chart_of_accounts</code> table does not
            exist yet.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={creatingTables}
            onClick={() => void handleCreateTables()}
          >
            {creatingTables ? "Creating tables…" : "Create database tables"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
