"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function SidebarNavUser() {
  const { user, isReady, signOut } = useAuth();

  if (!isReady) {
    return (
      <div
        className="shrink-0 border-t border-sidebar-border px-3 pb-3 pt-4"
        aria-hidden
      >
        <div className="h-10 animate-pulse rounded-full bg-sidebar-accent/60" />
        <div className="mt-4 h-9 animate-pulse rounded-md bg-sidebar-accent/40" />
      </div>
    );
  }

  if (!user) return null;

  const displayInitials = initials(user.name) || "PS";
  const role = user.role ?? "Super Admin";

  return (
    <div className="shrink-0 border-t border-sidebar-border px-3 pb-2 pt-3">
      <div className="flex items-center gap-2.5 px-1">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            "bg-red-600 text-sm font-semibold text-white shadow-sm",
          )}
          aria-hidden
        >
          {displayInitials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
            {user.name}
          </p>
          <p className="truncate text-xs leading-tight text-sidebar-foreground/55">{role}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => signOut()}
        className={cn(
          "mt-2.5 flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-sm",
          "text-sidebar-foreground/90 transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        )}
      >
        <LogOut className="h-4 w-4 shrink-0 opacity-80" />
        Sign Out
      </button>

      <p className="mt-2 text-center text-[10px] text-sidebar-foreground/40">
        Developed by PetroCore
        <span className="font-semibold text-red-500">X</span>
      </p>
    </div>
  );
}
