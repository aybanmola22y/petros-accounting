"use client";

import type { ReactNode, RefObject } from "react";
import { AlertTriangle, ChevronDown, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ImportDialogSize = "default" | "wide";

type ImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: ImportDialogSize;
  children: ReactNode;
};

export function ImportDialog({
  open,
  onOpenChange,
  size = "default",
  children,
}: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden p-0",
          size === "wide"
            ? "flex max-h-[90vh] flex-col sm:max-w-3xl"
            : "sm:max-w-lg",
        )}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

type ImportDialogHeaderProps = {
  title: string;
  description?: ReactNode;
  exportSteps?: string[];
};

export function ImportDialogHeader({
  title,
  description,
  exportSteps,
}: ImportDialogHeaderProps) {
  return (
    <div className="border-b border-border/70 bg-muted/20 px-5 py-4 pr-12">
      <DialogHeader className="space-y-2 text-left">
        <DialogTitle className="text-base font-semibold tracking-tight">
          {title}
        </DialogTitle>
        {description ? (
          <DialogDescription className="text-sm leading-relaxed">
            {description}
          </DialogDescription>
        ) : null}
        {exportSteps && exportSteps.length > 0 ? (
          <Collapsible>
            <CollapsibleTrigger className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&[data-state=open]>svg]:rotate-180">
              How to export from QuickBooks
              <ChevronDown className="h-3.5 w-3.5 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                {exportSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </DialogHeader>
    </div>
  );
}

type ImportDialogBodyProps = {
  children: ReactNode;
  scrollable?: boolean;
};

export function ImportDialogBody({
  children,
  scrollable = false,
}: ImportDialogBodyProps) {
  return (
    <div
      className={cn(
        "space-y-4 px-5 py-4",
        scrollable && "min-h-0 flex-1 overflow-y-auto",
      )}
    >
      {children}
    </div>
  );
}

export function ImportDialogTip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}

type ImportDialogReplaceOptionProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function ImportDialogReplaceOption({
  id,
  label,
  checked,
  onCheckedChange,
}: ImportDialogReplaceOptionProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-white px-3 py-2.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}

type ImportDialogFilePickerProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  accept: string;
  file: File | null;
  parsing?: boolean;
  disabled?: boolean;
  placeholder: string;
  hint?: string;
  onFileSelect: (file: File | null) => void;
};

export function ImportDialogFilePicker({
  fileInputRef,
  accept,
  file,
  parsing = false,
  disabled = false,
  placeholder,
  hint,
  onFileSelect,
}: ImportDialogFilePickerProps) {
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className="flex min-h-[132px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10 px-4 py-5 text-center transition-colors hover:border-primary/40 hover:bg-muted/25 disabled:opacity-60"
        disabled={disabled || parsing}
        onClick={() => fileInputRef.current?.click()}
      >
        {parsing ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">
              Reading spreadsheet…
            </span>
          </>
        ) : file ? (
          <>
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <span className="max-w-full truncate px-2 text-sm font-medium text-foreground">
              {file.name}
            </span>
            <span className="text-xs text-muted-foreground">
              Click to choose a different file
            </span>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium text-primary">{placeholder}</span>
            {hint ? (
              <span className="max-w-sm text-xs text-muted-foreground">{hint}</span>
            ) : null}
          </>
        )}
      </button>
    </>
  );
}

export function ImportDialogError({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function ImportDialogWarning({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-muted-foreground">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ImportDialogPreviewCard({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/15 px-4 py-3.5">
      {children}
    </div>
  );
}

type ImportDialogPreviewStatProps = {
  title: ReactNode;
  details?: ReactNode;
};

export function ImportDialogPreviewStat({
  title,
  details,
}: ImportDialogPreviewStatProps) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        {details ? (
          <div className="space-y-0.5 text-xs text-muted-foreground">{details}</div>
        ) : null}
      </div>
    </div>
  );
}

export function ImportDialogPreviewList({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-28 space-y-1 overflow-y-auto border-t border-border/60 pt-2 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

type ImportDialogTableProps = {
  children: ReactNode;
  minWidth?: number;
};

export function ImportDialogTable({
  children,
  minWidth = 640,
}: ImportDialogTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80">
      <table className="w-full text-xs" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function ImportDialogTableMore({
  shown,
  total,
  noun,
}: {
  shown: number;
  total: number;
  noun: string;
}) {
  if (total <= shown) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Showing first {shown.toLocaleString()} of {total.toLocaleString()} {noun}.
    </p>
  );
}

export function ImportDialogFileReady() {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
      Ready to import
    </p>
  );
}

type ImportDialogFooterProps = {
  onCancel: () => void;
  onImport: () => void;
  importLabel: ReactNode;
  cancelDisabled?: boolean;
  importDisabled?: boolean;
  importing?: boolean;
  importingLabel?: ReactNode;
};

export function ImportDialogFooter({
  onCancel,
  onImport,
  importLabel,
  cancelDisabled = false,
  importDisabled = false,
  importing = false,
  importingLabel,
}: ImportDialogFooterProps) {
  return (
    <DialogFooter className="gap-2 border-t border-border/70 bg-muted/10 px-5 py-4 sm:gap-0">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={cancelDisabled || importing}
      >
        Cancel
      </Button>
      <Button
        type="button"
        onClick={onImport}
        disabled={importDisabled || importing}
      >
        {importing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {importingLabel ?? "Importing…"}
          </>
        ) : (
          importLabel
        )}
      </Button>
    </DialogFooter>
  );
}
