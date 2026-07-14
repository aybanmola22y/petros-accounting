"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plug, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                loading
                  ? "bg-muted text-muted-foreground"
                  : isOk
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-destructive/10 text-destructive",
              )}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isOk ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Plug className="h-4 w-4 text-muted-foreground" />
                Supabase connection
              </CardTitle>
              <CardDescription className="mt-1">
                {loading
                  ? "Checking connection…"
                  : status?.message ?? "Connection status unknown."}
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => void checkConnection()}
            disabled={loading}
          >
            Test again
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status?.projectUrl ? (
          <p className="text-muted-foreground break-all">
            Project:{" "}
            <span className="font-mono text-foreground">{status.projectUrl}</span>
          </p>
        ) : null}

        {status?.error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
            {status.error}
          </p>
        ) : null}

        {!loading && !status?.configured ? (
          <div className="rounded-md border bg-muted/40 px-3 py-3 text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Setup steps</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Create a project at supabase.com</li>
              <li>
                Copy the Project URL and anon key from Settings → API
              </li>
              <li>
                Add them to <code className="text-xs">.env.local</code> in the project root
              </li>
              <li>Restart <code className="text-xs">npm run dev</code></li>
            </ol>
          </div>
        ) : null}

        {needsTables ? (
          <div className="space-y-2">
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
