import { Building2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { useNetworkGraph } from "@/hooks/useNetworkGraph";
import { useVendors } from "@/hooks/useVendors";
import { cn } from "@/lib/utils";
import type { PersonNode } from "@/types/network";

interface SearchResult {
  key: string;
  kind: "vendor" | "person";
  label: string;
  sublabel: string;
  to: string;
}

const MAX_RESULTS = 8;

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Both queries are already cached by the dashboard, so opening search
  // costs nothing - people come from the network graph payload, which is
  // the only place directors/shareholders are exposed across all vendors.
  const { data: vendors } = useVendors();
  const { data: network } = useNetworkGraph();

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const out: SearchResult[] = [];

    for (const v of vendors ?? []) {
      const matches =
        v.companyName.toLowerCase().includes(q) ||
        (v.registrationNo?.toLowerCase().includes(q) ?? false);
      if (matches) {
        out.push({
          key: `vendor:${v.id}`,
          kind: "vendor",
          label: v.companyName,
          sublabel: v.registrationNo ? `BRN ${v.registrationNo}` : "No registration no.",
          to: `/vendor/${v.id}`,
        });
      }
    }

    for (const node of network?.nodes ?? []) {
      if (node.kind === "company") continue;
      const person = node as PersonNode;
      const matches =
        person.label.toLowerCase().includes(q) ||
        (person.icPassportNo?.toLowerCase().includes(q) ?? false);
      // A person is only reachable through a company, so skip anyone whose
      // roles list is somehow empty rather than linking nowhere.
      const primaryRole = person.roles[0];
      if (!matches || !primaryRole) continue;

      const roleLabel =
        person.kind === "director" ? primaryRole.designation ?? "Director" : "Shareholder";
      out.push({
        key: `person:${person.id}`,
        kind: "person",
        label: person.label,
        sublabel:
          person.roles.length > 1
            ? `${roleLabel} · ${person.roles.length} companies`
            : `${roleLabel} · ${primaryRole.vendorName}`,
        to: `/vendor/${primaryRole.vendorId}`,
      });
    }

    return out.slice(0, MAX_RESULTS);
  }, [query, vendors, network]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Close on any click landing outside the search shell.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // "/" focuses search from anywhere, the usual console shortcut - but not
  // while the user is typing into some other field.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function choose(result: SearchResult) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    navigate(result.to);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[activeIndex];
      if (target) choose(target);
    }
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search
        aria-hidden="true"
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        aria-label="Search vendors, directors, or BRN"
        placeholder="Search vendors, directors, or BRN..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="h-9 w-full rounded-lg border border-input bg-muted/50 pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand/40 focus:bg-background focus:ring-2 focus:ring-brand/[0.15] [&::-webkit-search-cancel-button]:appearance-none"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={13} />
        </button>
      )}

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="card-elevated absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto p-1.5"
        >
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No matches for “{query.trim()}”.
            </p>
          ) : (
            results.map((result, i) => (
              <button
                key={result.key}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(result)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                  i === activeIndex ? "bg-brand/[0.08]" : "hover:bg-brand/[0.08]"
                )}
              >
                {result.kind === "vendor" ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/[0.12] text-brand">
                    <Building2 size={13} />
                  </span>
                ) : (
                  <InitialsAvatar name={result.label} tone="neutral" size="sm" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{result.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {result.sublabel}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
