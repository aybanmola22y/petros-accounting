"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { isBackupSnapshot, type BackupSnapshot } from "@/lib/backup/types";

function downloadJson(snapshot: BackupSnapshot) {
  const stamp = snapshot.createdAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `petrosphere-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function BackupRestorePanel() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<BackupSnapshot | null>(null);

  async function handleBackup() {
    setBackingUp(true);
    try {
      const response = await fetch("/api/backup/export");
      const payload = (await response.json()) as BackupSnapshot & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create backup.");
      }
      if (!isBackupSnapshot(payload)) {
        throw new Error("Backup response was invalid.");
      }
      downloadJson(payload);
      const total = Object.values(payload.counts).reduce((sum, n) => sum + n, 0);
      toast({
        title: "Backup downloaded",
        description: `Saved ${total.toLocaleString()} records to petrosphere-backup-${payload.createdAt.slice(0, 10)}.json`,
      });
    } catch (error) {
      toast({
        title: "Backup failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBackingUp(false);
    }
  }

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function onFileSelected(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isBackupSnapshot(parsed)) {
        throw new Error("This is not a valid Petrosphere backup JSON file.");
      }
      setPendingSnapshot(parsed);
    } catch (error) {
      toast({
        title: "Invalid backup file",
        description: error instanceof Error ? error.message : "Choose a valid JSON backup.",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmRestore() {
    if (!pendingSnapshot) return;
    setRestoring(true);
    try {
      const response = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingSnapshot),
      });
      const payload = (await response.json()) as {
        error?: string;
        restored?: Record<string, number>;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Restore failed.");
      }
      setPendingSnapshot(null);
      toast({
        title: "Backup restored",
        description: "Your data was restored. Reloading the app…",
      });
      window.setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (error) {
      toast({
        title: "Restore failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <div className="space-y-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Important</p>
          <p className="mt-1 text-amber-900/90">
            Backup downloads one JSON file with your core accounting data. Restore
            replaces current core data with that file. Keep backups in a safe place.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold">Backup</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Download customers, invoices, sales, expenses, suppliers, chart of
              accounts, and related core records as one JSON file.
            </p>
            <Button
              className="mt-4 h-9 gap-2"
              size="sm"
              disabled={backingUp || restoring}
              onClick={() => void handleBackup()}
            >
              {backingUp ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {backingUp ? "Preparing…" : "Download backup"}
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold">Restore</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Upload a previous Petrosphere backup JSON to restore that snapshot.
              This overwrites current core data.
            </p>
            <Button
              className="mt-4 h-9 gap-2"
              size="sm"
              variant="outline"
              disabled={backingUp || restoring}
              onClick={handlePickFile}
            >
              {restoring ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {restoring ? "Restoring…" : "Upload backup"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void onFileSelected(event.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      </div>

      <AlertDialog
        open={pendingSnapshot != null}
        onOpenChange={(open) => {
          if (!open && !restoring) setPendingSnapshot(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Replace current data?</AlertDialogTitle>
          <AlertDialogDescription>
            Restoring this backup will overwrite core accounting data with the
            snapshot from{" "}
            <span className="font-medium text-foreground">
              {pendingSnapshot
                ? new Date(pendingSnapshot.createdAt).toLocaleString()
                : "—"}
            </span>
            . This cannot be undone unless you have another backup.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoring}
              onClick={(event) => {
                event.preventDefault();
                void confirmRestore();
              }}
            >
              {restoring ? "Restoring…" : "Restore backup"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
