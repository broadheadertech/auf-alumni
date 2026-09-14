"use client";

/**
 * Alumni directory — ADMIN ONLY.
 *
 * The directory exposes the full verified-alumni roster, which is private to
 * the alumni themselves (field-level privacy is a hard requirement). It is
 * therefore an administrative surface: only the Alumni Relations office browses
 * the whole network here. The alumnus-facing app has no directory.
 *
 * Filters use the standard FilterPanel + useUrlFilters: the URL is the source
 * of truth (FR22) and the last set is kept for the session. Every dropdown
 * reads the same tables profiles are edited against — College → Program
 * (taxonomy), City (areas), Employment status (statuses), Company suggestions
 * (employer orgs) — so filter options can't drift from stored values.
 */

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex-api";
import { OPEN_TO_KINDS, type OpenToKind } from "@/lib/schemas/shared";
import { useCollegePrograms } from "@/lib/use-program-options";
import { useLookupOptions } from "@/lib/use-lookup-options";
import { useUrlFilters } from "@/lib/use-url-filters";
import { parseBatchInput } from "@/lib/batch-input";
import {
  DirectoryCard,
  type DirectoryCardData,
} from "@/components/auf/DirectoryCard";
import { EmptyState } from "@/components/auf/EmptyState";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";

const FILTER_KEYS = [
  "q",
  "college",
  "program",
  "batch",
  "city",
  "status",
  "company",
  "openTo",
] as const;

const OPEN_TO_LABEL: Record<OpenToKind, string> = {
  mentorship: "Mentorship",
  hiring: "Hiring",
  referrals: "Referrals",
  speaking: "Speaking",
};

type SuggestionFilter = {
  search?: string;
  batches?: number[];
  programs?: string[];
  cities?: string[];
  openTo?: string[];
  statuses?: string[];
  companyQuery?: string;
};

export default function AdminDirectoryPage() {
  const { values, set, setMany, reset, restored } = useUrlFilters(
    "admin-directory",
    FILTER_KEYS,
  );
  const taxonomy = useCollegePrograms();
  const areas = useLookupOptions("area");
  const statuses = useLookupOptions("status");
  const employers = useQuery(api.companies.list, {}) as
    | Array<{ name: string }>
    | undefined;

  const batch = parseBatchInput(values.batch);

  // College narrows Program; with no program picked, a college filters to all
  // of its programs. An unknown college (e.g. archived) matches nothing.
  const collegePrograms = values.college ? taxonomy.programsFor(values.college) : [];
  const programFilter = values.program
    ? [values.program]
    : values.college
      ? collegePrograms.length
        ? collegePrograms.map((p) => p.name)
        : ["(no programs in this college)"]
      : undefined;

  // Keyed on content so Convex subscriptions stay stable across re-renders.
  const programKey = (programFilter ?? []).join("|");
  const filters = useMemo(
    () => ({
      search: values.q || undefined,
      batches: batch.years ?? undefined,
      programs: programKey ? programKey.split("|") : undefined,
      cities: values.city ? [values.city] : undefined,
      statuses: values.status ? [values.status] : undefined,
      companyQuery: values.company || undefined,
      openTo: values.openTo ? [values.openTo] : undefined,
    }),
    // batch.years is derived from values.batch; batch.key is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values, batch.key, programKey],
  );

  // Hold queries until the taxonomy loads when a college filter depends on it.
  const waitForTaxonomy = !!values.college && !values.program && !taxonomy.ready;
  const convexResult = useQuery(
    api.directory.list,
    waitForTaxonomy ? "skip" : { ...filters, pageSize: 60 },
  );
  const counts = useQuery(api.directory.count, waitForTaxonomy ? "skip" : filters);
  const suggestions = useQuery(
    api.directory.adjacentSuggestions,
    waitForTaxonomy ? "skip" : filters,
  );

  const fields: FilterField[] = [
    { type: "search", key: "q", label: "Search", placeholder: "Name, company, skill…" },
    {
      type: "select",
      key: "college",
      label: "College",
      allLabel: "All colleges",
      options: taxonomy.colleges.map((c) => ({ value: c.name, label: c.name })),
    },
    {
      type: "select",
      key: "program",
      label: "Program / degree",
      allLabel: values.college ? "All programs in this college" : "All programs",
      options: (values.college ? collegePrograms : taxonomy.programs).map((p) => ({
        value: p.name,
        label: p.name,
        group: values.college ? undefined : p.collegeName,
      })),
    },
    {
      type: "text",
      key: "batch",
      label: "Batch (year)",
      placeholder: "e.g. 2021 or 2018-2022",
      maxLength: 9,
      hint: batch.error ?? undefined,
    },
    {
      type: "select",
      key: "city",
      label: "City",
      allLabel: "All cities",
      options: areas.options.map((a) => ({ value: a.name, label: a.name, group: a.group })),
    },
    {
      type: "select",
      key: "status",
      label: "Employment status",
      allLabel: "Any status",
      options: statuses.options.map((s) => ({ value: s.name, label: s.name })),
    },
    {
      type: "text",
      key: "company",
      label: "Company",
      placeholder: "Company name",
      suggestions: (employers ?? []).map((e) => e.name),
    },
    {
      type: "select",
      key: "openTo",
      label: "Open to",
      allLabel: "Anything",
      options: OPEN_TO_KINDS.map((k) => ({ value: k, label: OPEN_TO_LABEL[k] })),
    },
  ];

  const onFilterChange = (key: string, value: string) => {
    if (key === "college") {
      // Dependent dropdown: drop a program that doesn't belong to the new college.
      const keepProgram =
        values.program && value && taxonomy.collegeOfProgram(values.program) === value;
      setMany({ college: value, program: keepProgram ? values.program : "" });
      return;
    }
    if (key === "program" && value && !values.college) {
      // Picking a program first also pins its college, so both dropdowns agree.
      setMany({ program: value, college: taxonomy.collegeOfProgram(value) ?? "" });
      return;
    }
    set(key as (typeof FILTER_KEYS)[number], value);
  };

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

  const loading = convexResult === undefined;

  const totalLabel = counts
    ? `${counts.matched} of ${counts.total} alumni`
    : `${convexCards.length} alumni`;

  const applySuggestion = (f: SuggestionFilter) => {
    const years = f.batches ?? [];
    const program = f.programs?.length === 1 ? f.programs[0] : "";
    setMany({
      q: f.search ?? "",
      batch: years.length > 1 ? `${Math.min(...years)}-${Math.max(...years)}` : years.length ? String(years[0]) : "",
      program,
      college: program ? taxonomy.collegeOfProgram(program) ?? "" : f.programs?.length ? values.college : "",
      city: f.cities?.[0] ?? "",
      status: f.statuses?.[0] ?? "",
      company: f.companyQuery ?? "",
      openTo: f.openTo?.[0] ?? "",
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Alumni directory</h1>
        <p className="mt-2 text-muted-foreground">
          Full verified-alumni roster. Filter by college, program, batch, city,
          status, or company — or search by name, company, or skill.
        </p>
        <p className="mt-2 text-xs italic text-muted-foreground">
          Admin-only. The directory is private to alumni and is not exposed in
          the alumnus-facing app.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <FilterPanel
            fields={fields}
            values={values}
            onChange={onFilterChange}
            onReset={reset}
            restored={restored}
          />
        </aside>

        <section>
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {totalLabel}
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading directory…
            </div>
          ) : convexCards.length === 0 ? (
            <EmptyState
              message="No alumni match these filters."
              description="Try widening your search."
              suggestions={((suggestions ?? []) as Array<{
                label: string;
                filter: SuggestionFilter;
              }>).map((s) => ({
                label: s.label,
                onClick: () => applySuggestion(s.filter),
              }))}
              cta={{ label: "Clear all filters", onClick: reset }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {convexCards.map((card) => (
                <DirectoryCard key={card.slug} data={card} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
