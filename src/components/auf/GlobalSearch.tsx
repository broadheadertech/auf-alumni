"use client";

/**
 * Global ⌘K search palette.
 *
 * - Trigger renders as a topbar search affordance (full search-input look on
 *   md+, icon-only button below md).
 * - Modal is centered on desktop, full-width sheet on mobile.
 * - Keyboard-driven: ⌘/Ctrl+K toggles, Esc closes, ↑/↓ move highlight, Enter
 *   navigates.
 * - Debounces the query ~150ms before firing `api.social.globalSearch`.
 * - Auto-closes when the route changes.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Loader2, Search } from "lucide-react";
import { api } from "@/lib/convex-api";
import { cn } from "@/lib/utils";

type Hit = {
  kind: "alumni" | "job" | "course";
  slug: string;
  title: string;
  subtitle: string;
};

type SearchResult = {
  alumni: Hit[];
  jobs: Hit[];
  courses: Hit[];
};

type Variant = "topbar" | "icon";

function hrefFor(hit: Hit): string {
  switch (hit.kind) {
    case "alumni":
      return `/u/${hit.slug}`;
    case "job":
      return `/jobs/${hit.slug}`;
    case "course":
      return `/academy/${hit.slug}`;
  }
}

export function GlobalSearch({
  variant = "topbar",
}: {
  variant?: Variant;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘/Ctrl+K toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset on close + autofocus on open.
  useEffect(() => {
    if (open) {
      setHighlight(0);
      // Defer to next tick so the input is mounted before focusing.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    } else {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  // Hide modal on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Debounce the query (~150ms).
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 150);
    return () => window.clearTimeout(id);
  }, [query]);

  const shouldQuery = debounced.length >= 2;
  const data = useQuery(
    api.social.globalSearch,
    shouldQuery ? { q: debounced } : "skip",
  ) as SearchResult | undefined;

  const loading = shouldQuery && data === undefined;

  // Flatten results for keyboard navigation.
  const flat = useMemo<Hit[]>(() => {
    if (!data) return [];
    return [...data.alumni, ...data.jobs, ...data.courses];
  }, [data]);

  // Keep highlight in range when results change.
  useEffect(() => {
    if (highlight >= flat.length) setHighlight(0);
  }, [flat.length, highlight]);

  const close = useCallback(() => setOpen(false), []);

  const navigateTo = useCallback(
    (hit: Hit) => {
      close();
      router.push(hrefFor(hit));
    },
    [router, close],
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (flat.length ? (h + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) =>
        flat.length ? (h - 1 + flat.length) % flat.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[highlight];
      if (hit) navigateTo(hit);
    }
  }

  return (
    <>
      <Trigger variant={variant} open={open} onOpen={() => setOpen(true)} />
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          aria-hidden
          onClick={close}
        >
          <div
            role="dialog"
            aria-label="Global search"
            aria-modal="true"
            className={cn(
              // Mobile: top-of-screen sheet, full width.
              "absolute left-0 right-0 top-0 mx-0 auf-card rounded-none border-x-0 border-t-0",
              // Desktop: centered panel.
              "sm:relative sm:top-auto sm:left-auto sm:right-auto sm:mx-auto sm:mt-[10vh] sm:max-w-[640px] sm:rounded-[14px] sm:border",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b auf-hairline">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 ink-3"
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search alumni, jobs, and courses…"
                className="w-full bg-transparent py-4 pl-11 pr-12 text-[15px] outline-none"
                aria-label="Search query"
              />
              {loading && (
                <Loader2
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 ink-3 animate-spin"
                />
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto py-2">
              {!shouldQuery && <EmptyHint />}
              {shouldQuery && !loading && flat.length === 0 && (
                <div className="px-5 py-8 text-sm ink-3 text-center">
                  No results for{" "}
                  <span className="ink-2 font-medium">“{debounced}”</span>.
                </div>
              )}
              {shouldQuery && data && (
                <Results
                  data={data}
                  highlight={highlight}
                  onHover={setHighlight}
                  onPick={navigateTo}
                />
              )}
            </div>

            <div className="border-t auf-hairline px-4 py-2 text-[11px] ink-3 hidden sm:flex items-center gap-4">
              <span>
                <KbdKey>↑</KbdKey> <KbdKey>↓</KbdKey> navigate
              </span>
              <span>
                <KbdKey>↵</KbdKey> open
              </span>
              <span className="ml-auto">
                <KbdKey>esc</KbdKey> close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Trigger({
  variant,
  open,
  onOpen,
}: {
  variant: Variant;
  open: boolean;
  onOpen: () => void;
}) {
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Search"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground p-2"
        title="Search (⌘K)"
      >
        <Search size={18} />
      </button>
    );
  }

  // Topbar variant — desktop matches `.auf-search` look, mobile collapses to
  // an icon button.
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open search"
        aria-expanded={open}
        className="flex-1 max-w-[520px] relative hidden md:flex items-center text-left auf-search cursor-pointer"
      >
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 ink-3" />
        <span className="ink-3">Search alumni, jobs, and courses…</span>
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] ink-3 font-mono border auf-hairline rounded px-1.5 py-0.5 bg-white">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Search"
        aria-expanded={open}
        title="Search (⌘K)"
        className="md:hidden p-2 rounded-md ink-2 hover:ink hover:bg-[var(--surface-2)]"
      >
        <Search size={18} />
      </button>
    </>
  );
}

function EmptyHint() {
  return (
    <div className="px-5 py-6 text-sm ink-3 space-y-1.5">
      <div>Type to search alumni, jobs, and courses…</div>
      <div className="text-xs">
        Press <KbdKey>⌘K</KbdKey> from anywhere to open this palette.
      </div>
    </div>
  );
}

function Results({
  data,
  highlight,
  onHover,
  onPick,
}: {
  data: SearchResult;
  highlight: number;
  onHover: (i: number) => void;
  onPick: (hit: Hit) => void;
}) {
  const sections: { label: string; items: Hit[] }[] = [
    { label: "Alumni", items: data.alumni },
    { label: "Jobs", items: data.jobs },
    { label: "Courses", items: data.courses },
  ];

  let cursor = 0;
  return (
    <div>
      {sections.map((section) => {
        if (section.items.length === 0) return null;
        const startIndex = cursor;
        cursor += section.items.length;
        return (
          <div key={section.label} className="py-1">
            <div className="section-eyebrow px-5 py-1.5">{section.label}</div>
            <ul role="listbox">
              {section.items.map((hit, i) => {
                const flatIndex = startIndex + i;
                const active = flatIndex === highlight;
                return (
                  <li
                    key={`${hit.kind}-${hit.slug}`}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => onHover(flatIndex)}
                    onClick={() => onPick(hit)}
                    className={cn(
                      "px-5 py-2.5 cursor-pointer flex items-baseline justify-between gap-3",
                      active ? "bg-[var(--surface-2)]" : "",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate ink">
                        {hit.title}
                      </div>
                      {hit.subtitle && (
                        <div className="text-[12px] ink-3 truncate">
                          {hit.subtitle}
                        </div>
                      )}
                    </div>
                    {active && (
                      <span className="text-[10px] ink-3 font-mono shrink-0">
                        ↵
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="text-[10px] ink-3 font-mono border auf-hairline rounded px-1 py-0.5 bg-white">
      {children}
    </kbd>
  );
}
