"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  ChevronDown,
  Bell,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { hydrateStoreFromPersistence } from "@/lib/mock-data";
import { SidebarNavUser } from "@/components/sidebar-nav-user";
import { AppLogo } from "@/components/app-logo";
import { GlobalSearch } from "@/components/global-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { navGroups, type NavItem } from "@/lib/app-navigation";

function isItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

function groupHasActiveItem(pathname: string, items: NavItem[]) {
  return items.some((item) => isItemActive(pathname, item.href));
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    hydrateStoreFromPersistence();
  }, []);

  const collapsibleTitles = navGroups.filter((g) => g.collapsible).map((g) => g.title);

  function buildOpenGroupsForPath(path: string): Record<string, boolean> {
    const next: Record<string, boolean> = {};
    for (const group of navGroups) {
      if (group.collapsible) {
        next[group.title] = groupHasActiveItem(path, group.items);
      }
    }
    return next;
  }

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    buildOpenGroupsForPath(pathname),
  );

  useEffect(() => {
    setOpenGroups(buildOpenGroupsForPath(pathname));
  }, [pathname]);

  function setGroupOpen(title: string, open: boolean) {
    setOpenGroups((prev) => {
      if (!open) {
        return { ...prev, [title]: false };
      }
      const next: Record<string, boolean> = {};
      for (const t of collapsibleTitles) {
        next[t] = t === title;
      }
      return next;
    });
  }

  const renderNavItems = (items: NavItem[]) => (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = isItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-sidebar-primary")} />
            <span className="flex-1 truncate leading-snug">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background print:h-auto print:overflow-visible">
      {/* Sidebar — fixed full viewport height so it never appears cut off when main scrolls */}
      <aside className="app-chrome fixed inset-y-0 left-0 z-30 hidden h-dvh w-64 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex print:hidden">
        {/* Brand */}
        <div className="shrink-0 border-b border-sidebar-border px-4 pb-4 pt-4">
          <Link
            href="/"
            className="flex flex-col items-center gap-3 rounded-xl text-center outline-none ring-sidebar-ring transition-opacity hover:opacity-90 focus-visible:ring-2"
          >
            <AppLogo size="md" variant="onDark" priority />
            <div className="flex flex-col gap-0.5">
              <span className="text-lg font-bold tracking-tight text-sidebar-foreground leading-none">
                Petrosphere Inc.
              </span>
              <span className="text-xs font-medium text-sidebar-foreground/45 tracking-wide">
                Accounting System
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <div className="sidebar-nav-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          <div className="flex flex-col gap-3">
            {navGroups.map((group) => {
              if (!group.collapsible) {
                return (
                  <div key={group.title}>
                    <h4 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                      {group.title}
                    </h4>
                    {renderNavItems(group.items)}
                  </div>
                );
              }

              const isOpen = openGroups[group.title] ?? false;

              return (
                <Collapsible
                  key={group.title}
                  open={isOpen}
                  onOpenChange={(open) => setGroupOpen(group.title, open)}
                  className="space-y-1"
                >
                  <CollapsibleTrigger
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/80",
                      isOpen ? "text-sidebar-foreground/70" : "text-sidebar-foreground/50",
                    )}
                  >
                    <span className="text-left leading-snug">{group.title}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 opacity-70 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-0.5">
                    {renderNavItems(group.items)}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </div>

        <SidebarNavUser />
      </aside>

      {/* Main Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:pl-64 print:min-h-0 print:overflow-visible print:pl-0">
        {/* Header */}
        <header className="app-chrome z-20 flex h-14 shrink-0 items-center justify-between border-b bg-card px-6 print:hidden">
          <div className="flex items-center gap-4 flex-1">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-4">
            <button className="text-muted-foreground hover:text-foreground">
              <Bell className="w-5 h-5" />
            </button>
            <Avatar className="w-8 h-8 border">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>
                {user?.name?.slice(0, 2).toUpperCase() ?? "A"}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content — only this region scrolls */}
        <main className="app-main min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background p-4 md:p-6 print:overflow-visible print:bg-white print:p-0">
          <div className="w-full min-w-0 space-y-6 print:space-y-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
