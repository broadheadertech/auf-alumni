"use client";

/**
 * Alumni directory — ADMIN ONLY.
 *
 * The directory exposes the full verified-alumni roster, which is private to
 * the alumni themselves (field-level privacy is a hard requirement). It is
 * therefore an administrative surface: only the Alumni Relations office browses
 * the whole network here. The alumnus-facing app has no directory.
 *
 * URL is the source of truth for filters (FR22). Reads Convex with a mock-data
 * fallback, same as the original alumni-side page.
 */

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Search, X } from "lucide-react";
import { api } from "@/lib/convex-api";
import { ALUMNI, BATCHES, CITIES, PROGRAMS } from "@/lib/mock-alumni";
import { OPEN_TO_KINDS, type OpenToKind } from "@/lib/schemas/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DirectoryCard,
  type DirectoryCardData,
} from "@/components/auf/DirectoryCard";
import { EmptyState } from "@/components/auf/EmptyState";
import { OpenToTag } from "@/components/auf/OpenToTag";
import { cn } from "@/lib/utils";

const BASE = "/admin/directory";

function csvFromParam(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}
function joinParam(arr: string[]): string | null {
  return arr.length > 0 ? arr.join(",") : null;
}

function mockToCards(): DirectoryCardData[] {
  return ALUMNI.map((a) => ({
    slug: a.slug,
    displayName: a.name,
    initials: a.initials,
    batch: a.batch,
    program: a.program,
    currentRole: a.currentRole,
    company: a.company,
    city: a.city,
    country: a.country,
    openTo: a.openTo.map((t) => t.toLowerCase() as OpenToKind),
  }));
}

export default function AdminDirectoryPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // URL is the source of truth (FR22).
  const query = sp.get("q") ?? "";
  const batches = csvFromParam(sp.get("batch")).map((s) => Number(s));
  const programs = csvFromParam(sp.get("program"));
  const cities = csvFromParam(sp.get("city"));
  const openTo = csvFromParam(sp.get("openTo"));

  const batchKey = batches.join(",");
  const programKey = programs.join(",");
  const cityKey = cities.join(",");
  const openToKey = openTo.join(",");

  const filters = useMemo(
    () => ({
      search: query || undefined,
      batches: batches.length > 0 ? batches : undefined,
      programs: programs.length > 0 ? programs : undefined,
      cities: cities.length > 0 ? cities : undefined,
      openTo: openTo.length > 0 ? openTo : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, batchKey, programKey, cityKey, openToKey],
  );

  const convexResult = useQuery(api.directory.list, {
    ...filters,
    pageSize: 60,
  });
  const counts = useQuery(api.directory.count, filters);
  const suggestions = useQuery(api.directory.adjacentSuggestions, filters);

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
    router.replace(BASE + "?" + next.toString(), { scroll: false });
  };

  const toggleInList = (param: string, value: string) => {
    const current = csvFromParam(sp.get(param));
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateParam(param, joinParam(next));
  };

  const clearAll = () => router.replace(BASE, { scroll: false });

  const convexCards: DirectoryCardData[] = useMemo(() => {
    if (!convexResult || convexResult.page.length === 0) return [];
    return (convexResult.page as Record<string, unknown>[])
      .filter(
        (p): p is Record<string, unknown> =>
          !!p && typeof p.slug === "string" && typeof p.displayName === "string",
      )
      .map((p: Record<string, unknown>) => {
        const slug = p.slug as string;
        const displayName = p.displayName as string;
        return {
          slug,
          displayName,
          initials:
            (p.initials as string | undefined) ??
            displayName.slice(0, 2).toUpperCase(),
          batch: (p.batch as number | undefined) ?? 2024,
          program: (p.program as string | undefined) ?? "—",
          currentRole: p.currentRole as string | undefined,
          company: p.company as string | undefined,
          city: p.city as string | undefined,
          country: p.country as string | undefined,
          openTo: (((p.openTo as string[] | undefined) ?? []) as string[]).map(
            (t) => t.toLowerCase() as OpenToKind,
          ),
        };
      });
  }, [convexResult]);

  const usingMock = convexCards.length === 0;

  const allCards = useMemo(() => {
    if (!usingMock) return convexCards;
    const q = query.trim().toLowerCase();
    return mockToCards().filter((a) => {
      if (batches.length > 0 && !batches.includes(a.batch)) return false;
      if (programs.length > 0 && !programs.includes(a.program)) return false;
      if (cities.length > 0 && !(a.city && cities.includes(a.city))) {
        return false;
      }
      if (openTo.length > 0) {
        const tagSet = new Set(a.openTo);
        if (
          !openTo.some((t) => tagSet.has(t.toLowerCase() as OpenToKind))
        ) {
          return false;
        }
      }
      if (q) {
        const hay = [a.displayName, a.currentRole, a.company, a.city, a.country]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usingMock, convexCards, query, batchKey, programKey, cityKey, openToKey]);

  const totalLabel = usingMock
    ? `${allCards.length} of ${ALUMNI.length} alumni`
    : counts
      ? `${counts.matched} of ${counts.total} alumni`
      : `${allCards.length} alumni`;

  const activeFilterCount =
    batches.length + programs.length + cities.length + openTo.length;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Alumni directory</h1>
        <p className="mt-2 text-muted-foreground">
          Full verified-alumni roster. Filter by batch, program, city, or search
          by name, company, or skill.
        </p>
        <p className="mt-2 text-xs italic text-muted-foreground">
          Admin-only. The directory is private to alumni and is not exposed in
          the alumnus-facing app.
        </p>
        {usingMock && (
          <p className="mt-1 text-xs italic text-muted-foreground">
            Demo data — real entries appear once alumni profiles land.
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-5">
          <div>
            <Label
              htmlFor="search"
              className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground"
            >
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Name, company, skill…"
                value={query}
                onChange={(e) => updateParam("q", e.target.value || null)}
                className="pl-9"
              />
            </div>
          </div>

          <FilterGroup
            label="Batch"
            options={BATCHES.map((b) => ({
              value: String(b),
              label: `Class of ${b}`,
            }))}
            active={batches.map(String)}
            onToggle={(v) => toggleInList("batch", v)}
          />

          <FilterGroup
            label="Program"
            options={PROGRAMS.map((p) => ({ value: p, label: p }))}
            active={programs}
            onToggle={(v) => toggleInList("program", v)}
          />

          <FilterGroup
            label="City"
            options={CITIES.map((c) => ({ value: c, label: c }))}
            active={cities}
            onToggle={(v) => toggleInList("city", v)}
          />

          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Open to
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {OPEN_TO_KINDS.map((kind) => {
                const active = openTo.includes(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => toggleInList("openTo", kind)}
                    className={cn(
                      "rounded-full transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      !active && "opacity-50 hover:opacity-100",
                    )}
                    aria-pressed={active}
                  >
                    <OpenToTag
                      kind={kind}
                      variant={active ? "subtle" : "outline"}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {(activeFilterCount > 0 || query) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="w-full justify-start gap-2 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </aside>

        <section>
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {totalLabel}
          </div>

          {allCards.length === 0 ? (
            <EmptyState
              message="No alumni match these filters."
              description="Try widening your search."
              suggestions={((suggestions ?? []) as Array<{
                label: string;
                filter: {
                  search?: string;
                  batches?: number[];
                  programs?: string[];
                  cities?: string[];
                  openTo?: string[];
                };
              }>).map((s) => ({
                label: s.label,
                onClick: () => {
                  const next = new URLSearchParams();
                  if (s.filter.search) next.set("q", s.filter.search);
                  if (s.filter.batches) {
                    next.set("batch", s.filter.batches.join(","));
                  }
                  if (s.filter.programs) {
                    next.set("program", s.filter.programs.join(","));
                  }
                  if (s.filter.cities) {
                    next.set("city", s.filter.cities.join(","));
                  }
                  if (s.filter.openTo) {
                    next.set("openTo", s.filter.openTo.join(","));
                  }
                  router.replace(
                    BASE + (next.toString() ? "?" + next.toString() : ""),
                    { scroll: false },
                  );
                },
              }))}
              cta={{ label: "Clear all filters", href: BASE }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {allCards.map((card) => (
                <DirectoryCard key={card.slug} data={card} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  active,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  active: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-col gap-1">
        {options.map((opt) => {
          const isActive = active.includes(opt.value);
          return (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => onToggle(opt.value)}
                className="h-4 w-4 rounded border-border"
              />
              <span className={isActive ? "font-medium" : ""}>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
