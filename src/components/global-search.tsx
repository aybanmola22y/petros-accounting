"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  buildGlobalSearchResults,
  groupGlobalSearchResults,
  type GlobalSearchResult,
} from "@/lib/global-search";
import {
  getCustomersSnapshot,
  getDisplayInvoicesSnapshot,
  getReceivablesSnapshot,
  getServerReceivablesSnapshot,
  getSuppliersSnapshot,
  subscribeMockStore,
} from "@/lib/mock-data";

function useSearchData() {
  const invoices = useSyncExternalStore(
    subscribeMockStore,
    getDisplayInvoicesSnapshot,
    () => [],
  );
  const receivables = useSyncExternalStore(
    subscribeMockStore,
    getReceivablesSnapshot,
    getServerReceivablesSnapshot,
  );
  const customers = useSyncExternalStore(
    subscribeMockStore,
    getCustomersSnapshot,
    () => [],
  );
  const suppliers = useSyncExternalStore(
    subscribeMockStore,
    getSuppliersSnapshot,
    () => [],
  );
  return {
    invoices,
    customers,
    leads: receivables.leads,
    suppliers,
  };
}

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchData = useSearchData();

  const results = useMemo(
    () => buildGlobalSearchResults(query, searchData),
    [query, searchData],
  );
  const groups = useMemo(() => groupGlobalSearchResults(results), [results]);

  const selectResult = useCallback(
    (result: GlobalSearchResult) => {
      setOpen(false);
      setQuery("");
      router.push(result.href);
    },
    [router],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            placeholder="Search..."
            className="h-9 border-none bg-muted/50 pl-9 text-sm"
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                inputRef.current?.blur();
                return;
              }
              if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                selectResult(results[0]);
              }
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {groups.length === 0 ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : (
              groups.map((group) => (
                <CommandGroup key={group.heading} heading={group.heading}>
                  {group.items.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => selectResult(result)}
                    >
                      <result.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{result.label}</div>
                        {result.sublabel ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {result.sublabel}
                          </div>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
