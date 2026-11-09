"use client";

/**
 * Universal search — one bar for everything, in every shell.
 *
 * It used to search alumni, jobs and courses only, and on the admin and
 * employer shells it was a bare icon button that was easy to miss. It now runs
 * `search.universal`, which is role-aware: alumni, jobs, courses, events,
 * articles and companies for everyone; applicants for employers; user accounts,
 * enquiries and pending verifications for admins — plus navigation
 * destinations, so "approvals" or "skill sets" jumps straight to the page.
 *
 * - ⌘/Ctrl+K opens from anywhere, Esc closes, ↑/↓ move, Enter opens.
 * - Tab / ←→ cycle the kind filter chips.
 * - Recent searches persist per browser (localStorage, best effort).
 * - The footer hands off into the real filtered list pages, which is where
 *   pagination, bulk actions and filter persistence live.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  Compass,
  FileText,
  GraduationCap,
  Inbox,
  Loader2,
  Newspaper,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { cn } from "@/lib/utils";

type Kind =
  | "alumni"
  | "job"
  | "course"
  | "event"
  | "article"
  | "company"
  | "applicant"
  | "user"
  | "enquiry"
  | "verification"
  | "page";

type Hit = {
  kind: Kind;
  id: string;
  title: string;
  subtitle: string;
  meta: string | null;
  href: string;
  score: number;
};

type Result = {
  hits: Hit[];
  counts: Record<string, number>;
  total: number;
  surface: "admin" | "employer" | "alumni" | "stranger";
  truncated: boolean;
};

type Scope = { label: string; href: string };

type Variant = "topbar" | "icon";

const KIND_META: Record<
  Kind,
  { label: string; plural: string; Icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  alumni: { label: "Alumnus", plural: "Alumni", Icon: Users },
  job: { label: "Job", plural: "Jobs", Icon: Briefcase },
  course: { label: "Course", plural: "Courses", Icon: GraduationCap },
  event: { label: "Event", plural: "Events", Icon: CalendarDays },
  article: { label: "Article", plural: "Articles", Icon: Newspaper },
  company: { label: "Company", plural: "Companies", Icon: Building2 },
  applicant: { label: "Applicant", plural: "Applicants", Icon: FileText },
  user: { label: "Account", plural: "Accounts", Icon: UserCog },
  enquiry: { label: "Enquiry", plural: "Enquiries", Icon: Inbox },
  verification: { label: "Verification", plural: "Verifications", Icon: ShieldCheck },
  page: { label: "Page", plural: "Go to", Icon: Compass },
};

/** Section order in the results list. Navigation last — records first. */
const KIND_ORDER: Kind[] = [
  "alumni",
  "job",
  "applicant",
  "company",
  "event",
  "course",
  "article",
  "enquiry",
  "verification",
  "user",
  "page",
];

const RECENTS_KEY = "auf.search.recents";
const MAX_RECENTS = 6;

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENTS)
      : [];
  } catch {
    return []; // private window / blocked storage
  }
}

function writeRecents(list: string[]) {
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
  } catch {
    // Storage unavailable — recents are a convenience, not state we rely on.
  }
}

export function GlobalSearch({ variant = "topbar" }: { variant?: Variant }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);


  // One place that knows what opening and closing mean, so no effect has to
  // synchronise state after the fact.
  const setOpenState = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setHighlight(0);
      setRecents(readRecents());
    } else {
      setQuery("");
      setDebounced("");
      setKind(null);
    }
  }, []);

  // ⌘/Ctrl+K from anywhere; Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenState(!open);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpenState(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpenState]);

  // Focus the input once the dialog has mounted.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Result clicks close the dialog in go(); this covers browser back/forward,
  // where the shell (and therefore this component) stays mounted.
  useEffect(() => {
    if (!open) return;
    const onPop = () => setOpenState(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, setOpenState]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 150);
    return () => window.clearTimeout(id);
  }, [query]);

  const shouldQuery = debounced.length >= 2;
  const data = useQuery(
    api.search.universal,
    shouldQuery ? { q: debounced, kind: kind ?? undefined } : "skip",
  ) as Result | undefined;
  const scopes = useQuery(
    api.search.scopesFor,
    shouldQuery ? { q: debounced } : "skip",
  ) as Scope[] | undefined;

  const loading = shouldQuery && data === undefined;
  const hits = useMemo(() => data?.hits ?? [], [data]);

  // Which chips to offer: only kinds this viewer actually has results in.
  // Counts come from the unfiltered pass, so keep the last full set around
  // while a chip is active, otherwise the chips would vanish on click.
  // Held in state rather than a ref. A ref written and read during render is
  // invisible to React: it will not re-render when the counts change, and the
  // chips could show a stale set until something else happened to re-render.
  // Setting state during render is the supported way to derive from incoming
  // data — React discards the in-progress render and immediately retries.
  const [allCounts, setAllCounts] = useState<Record<string, number>>({});
  if (data && kind === null && data.counts !== allCounts) {
    setAllCounts(data.counts);
  }
  const chipKinds = KIND_ORDER.filter((k) => (allCounts[k] ?? 0) > 0);

  const sections = useMemo(() => {
    const by = new Map<Kind, Hit[]>();
    for (const h of hits) {
      const list = by.get(h.kind) ?? [];
      list.push(h);
      by.set(h.kind, list);
    }
    return KIND_ORDER.filter((k) => by.has(k)).map((k) => ({
      kind: k,
      items: by.get(k) as Hit[],
    }));
  }, [hits]);

  // Flatten in display order so ↑/↓ matches what's on screen.
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  // Results change as you type, so clamp the cursor when reading it rather
  // than writing a correction back into state.
  const cursor = highlight < flat.length ? highlight : 0;

  const close = useCallback(() => setOpenState(false), [setOpenState]);

  const remember = useCallback((term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    const next = [t, ...readRecents().filter((r) => r !== t)].slice(0, MAX_RECENTS);
    writeRecents(next);
    setRecents(next);
  }, []);

  const go = useCallback(
    (href: string) => {
      remember(debounced);
      close();
      router.push(href);
    },
    [router, close, remember, debounced],
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (flat.length ? (h + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (flat.length ? (h - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[cursor];
      if (hit) go(hit.href);
    } else if (e.key === "Tab" && chipKinds.length > 0) {
      // Cycle the kind filter instead of leaving the input.
      e.preventDefault();
      const order: Array<Kind | null> = [null, ...chipKinds];
      const i = order.indexOf(kind);
      const next = order[(i + (e.shiftKey ? -1 + order.length : 1)) % order.length];
      setKind(next ?? null);
      setHighlight(0);
    }
  }

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const placeholder = "Search people, jobs, events, pages…";

  return (
    <>
      <Trigger
        variant={variant}
        open={open}
        onOpen={() => setOpenState(true)}
        placeholder={placeholder}
      />
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40" aria-hidden onClick={close}>
          <div
            role="dialog"
            aria-label="Search"
            aria-modal="true"
            className={cn(
              "absolute left-0 right-0 top-0 mx-0 auf-card rounded-none border-x-0 border-t-0",
              "sm:relative sm:top-auto sm:left-auto sm:right-auto sm:mx-auto sm:mt-[8vh] sm:max-w-[680px] sm:rounded-[14px] sm:border",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b auf-hairline">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 ink-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder={placeholder}
                className="w-full bg-transparent py-4 pl-11 pr-12 text-[15px] outline-none"
                aria-label="Search query"
                autoComplete="off"
              />
              {loading && (
                <Loader2
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 ink-3 animate-spin"
                />
              )}
            </div>

            {shouldQuery && chipKinds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 border-b auf-hairline px-3 py-2">
                <Chip active={kind === null} onClick={() => { setKind(null); setHighlight(0); }}>
                  All
                  {data && kind === null && (
                    <span className="ml-1 ink-3">{data.total}</span>
                  )}
                </Chip>
                {chipKinds.map((k) => {
                  const { plural, Icon } = KIND_META[k];
                  return (
                    <Chip
                      key={k}
                      active={kind === k}
                      onClick={() => { setKind(kind === k ? null : k); setHighlight(0); }}
                    >
                      <Icon size={11} />
                      {plural}
                      <span className="ml-0.5 ink-3">{allCounts[k]}</span>
                    </Chip>
                  );
                })}
              </div>
            )}

            <div ref={listRef} className="max-h-[58vh] overflow-y-auto py-2">
              {!shouldQuery && (
                <EmptyHint recents={recents} onPick={(t) => { setQuery(t); inputRef.current?.focus(); }} />
              )}
              {shouldQuery && !loading && flat.length === 0 && (
                <div className="px-5 py-10 text-center text-sm ink-3">
                  Nothing matches{" "}
                  <span className="ink-2 font-medium">“{debounced}”</span>
                  {kind && <> in {KIND_META[kind].plural.toLowerCase()}</>}.
                  {kind && (
                    <button
                      type="button"
                      onClick={() => setKind(null)}
                      className="ml-1 brand-fg hover:underline"
                    >
                      Search everything
                    </button>
                  )}
                </div>
              )}
              {shouldQuery &&
                sections.map((section) => {
                  const { plural, Icon } = KIND_META[section.kind];
                  const start = flat.indexOf(section.items[0]);
                  return (
                    <div key={section.kind} className="py-1">
                      <div className="section-eyebrow flex items-center gap-1.5 px-5 py-1.5">
                        <Icon size={11} /> {plural}
                      </div>
                      <ul role="listbox">
                        {section.items.map((hit, i) => {
                          const index = start + i;
                          const active = index === cursor;
                          return (
                            <li
                              key={`${hit.kind}-${hit.id}`}
                              role="option"
                              aria-selected={active}
                              data-active={active}
                              onMouseEnter={() => setHighlight(index)}
                              onClick={() => go(hit.href)}
                              className={cn(
                                "flex cursor-pointer items-center justify-between gap-3 px-5 py-2.5",
                                active && "bg-[var(--surface-2)]",
                              )}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-sm font-medium ink">
                                    {hit.title}
                                  </span>
                                  {hit.meta && (
                                    <span className="shrink-0 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] ink-3">
                                      {hit.meta}
                                    </span>
                                  )}
                                </div>
                                {hit.subtitle && (
                                  <div className="truncate text-[12px] ink-3">
                                    {hit.subtitle}
                                  </div>
                                )}
                              </div>
                              {active && (
                                <span className="shrink-0 font-mono text-[10px] ink-3">↵</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}

              {shouldQuery && !loading && scopes && scopes.length > 0 && (
                <div className="mt-1 border-t auf-hairline px-5 pb-1 pt-3">
                  <div className="section-eyebrow mb-1.5">
                    See every match in
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {scopes.map((s) => (
                      <button
                        key={s.href}
                        type="button"
                        onClick={() => go(s.href)}
                        className="auf-chip text-[11.5px] hover:border-[var(--brand)]"
                      >
                        {s.label} <ArrowRight size={10} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden items-center gap-4 border-t auf-hairline px-4 py-2 text-[11px] ink-3 sm:flex">
              <span>
                <KbdKey>↑</KbdKey> <KbdKey>↓</KbdKey> navigate
              </span>
              <span>
                <KbdKey>tab</KbdKey> filter
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
        active
          ? "border-[var(--brand)] brand-50 brand-fg font-medium"
          : "border-[var(--border-soft)] ink-2 hover:ink",
      )}
    >
      {children}
    </button>
  );
}

function Trigger({
  variant,
  open,
  onOpen,
  placeholder,
}: {
  variant: Variant;
  open: boolean;
  onOpen: () => void;
  placeholder: string;
}) {
  // Both variants now show a real bar on desktop — the icon-only trigger on the
  // admin and employer shells made the search easy to miss entirely.
  const wide = variant === "topbar";
  return (
    <>
      <button
        type="button"
        data-tour="global-search"
        onClick={onOpen}
        aria-label="Open search"
        aria-expanded={open}
        className={cn(
          "relative hidden min-w-0 cursor-pointer items-center text-left auf-search md:flex",
          wide ? "max-w-[520px] flex-1" : "w-[260px] lg:w-[320px]",
        )}
      >
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 ink-3" />
        <span className="min-w-0 flex-1 truncate pr-10 ink-3">{placeholder}</span>
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border auf-hairline bg-white px-1.5 py-0.5 font-mono text-[10px] ink-3">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Search"
        aria-expanded={open}
        title="Search (⌘K)"
        className="rounded-md p-2 ink-2 hover:bg-[var(--surface-2)] hover:ink md:hidden"
      >
        <Search size={18} />
      </button>
    </>
  );
}

function EmptyHint({
  recents,
  onPick,
}: {
  recents: string[];
  onPick: (term: string) => void;
}) {
  return (
    <div className="px-5 py-5">
      {recents.length > 0 && (
        <div className="mb-4">
          <div className="section-eyebrow mb-1.5 flex items-center gap-1.5">
            <Clock size={11} /> Recent
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recents.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onPick(r)}
                className="auf-chip text-[11.5px] hover:border-[var(--brand)]"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="text-sm ink-3">
        Search people, jobs, events, courses, companies and articles — plus any
        page in the app.
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs ink-3">
        <BadgeCheck size={11} /> Try a name, a company, a skill, or where you
        want to go (&ldquo;approvals&rdquo;, &ldquo;billing&rdquo;).
      </div>
    </div>
  );
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border auf-hairline bg-white px-1 py-0.5 font-mono text-[10px] ink-3">
      {children}
    </kbd>
  );
}
