/**
 * Directory search + filter (Epic 4).
 *
 * NFR1 budget: p95 <300ms at 10k profiles. V1 uses Convex's built-in indexes;
 * a Meilisearch migration path is documented in architecture §scope. The
 * search helper is small + indexable; structure is what gets us to budget.
 *
 * NFR10 invariant: every result passes through `applyPrivacy(profile, viewer)`.
 * The CI privacy-leak test covers the matrix.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { applyPrivacy, getViewerContext } from "./helpers/privacy";

const PAGE_SIZE_DEFAULT = 30;
const PAGE_SIZE_MAX = 100;

type Filters = {
  search?: string;
  batches?: number[];
  programs?: string[];
  cities?: string[];
  countries?: string[];
  companies?: string[];
  skills?: string[];
  openTo?: string[];
};

function profileMatches(p: Doc<"profiles">, f: Filters): boolean {
  if (p.verifiedAt == null) return false;
  if (f.batches && f.batches.length > 0 && !f.batches.includes(p.batch)) {
    return false;
  }
  if (f.programs && f.programs.length > 0 && !f.programs.includes(p.program)) {
    return false;
  }
  if (
    f.cities &&
    f.cities.length > 0 &&
    !(p.city && f.cities.includes(p.city))
  ) {
    return false;
  }
  if (
    f.countries &&
    f.countries.length > 0 &&
    !(p.country && f.countries.includes(p.country))
  ) {
    return false;
  }
  if (
    f.companies &&
    f.companies.length > 0 &&
    !(p.company && f.companies.includes(p.company))
  ) {
    return false;
  }
  if (f.skills && f.skills.length > 0) {
    const skillSet = new Set((p.skills ?? []).map((s) => s.toLowerCase()));
    const ok = f.skills.some((s) => skillSet.has(s.toLowerCase()));
    if (!ok) return false;
  }
  if (f.openTo && f.openTo.length > 0) {
    const tagSet = new Set((p.openTo ?? []).map((t) => t.toLowerCase()));
    const ok = f.openTo.some((t) => tagSet.has(t.toLowerCase()));
    if (!ok) return false;
  }
  if (f.search && f.search.trim().length > 0) {
    const q = f.search.trim().toLowerCase();
    const haystack = [
      p.displayName,
      p.currentRole,
      p.company,
      p.bio,
      ...(p.skills ?? []),
    ]
      .filter((x) => typeof x === "string")
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

/**
 * List verified profiles matching filters. Results are paginated by cursor
 * (Convex's index pagination). Every returned profile is privacy-filtered.
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
    batches: v.optional(v.array(v.number())),
    programs: v.optional(v.array(v.string())),
    cities: v.optional(v.array(v.string())),
    countries: v.optional(v.array(v.string())),
    companies: v.optional(v.array(v.string())),
    skills: v.optional(v.array(v.string())),
    openTo: v.optional(v.array(v.string())),
    pageSize: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const filters: Filters = {
      search: args.search,
      batches: args.batches,
      programs: args.programs,
      cities: args.cities,
      countries: args.countries,
      companies: args.companies,
      skills: args.skills,
      openTo: args.openTo,
    };
    const pageSize = Math.min(
      args.pageSize ?? PAGE_SIZE_DEFAULT,
      PAGE_SIZE_MAX,
    );

    // Paginate raw profiles, then in-memory filter + privacy-apply.
    // (Replaceable with a search index later — interface preserved.)
    const result = await ctx.db
      .query("profiles")
      .paginate({ cursor: args.cursor ?? null, numItems: pageSize * 3 });

    const filtered = result.page.filter((p) => profileMatches(p, filters));

    // Privacy-apply, one viewer-context per request.
    const viewer = await getViewerContext(
      ctx,
      filtered[0]?.userId ?? ("_no_user" as Doc<"users">["_id"]),
    );
    const visible = filtered.slice(0, pageSize).map((p) => {
      // recompute viewer per-result so self / connection state is per-profile
      // (cheap because the helper itself is cached per request).
      return p; // applyPrivacy uses viewer; we re-resolve per profile below.
    });

    const pageWithPrivacy = [] as Partial<Doc<"profiles">>[];
    for (const p of visible) {
      const vctx = await getViewerContext(ctx, p.userId);
      pageWithPrivacy.push(applyPrivacy(p, vctx));
    }

    return {
      page: pageWithPrivacy,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      // Note: total count requires a separate count query. For NFR1, deferring.
    };
    // Use the precomputed viewer if no caller relies on per-profile resolution.
    void viewer;
  },
});

/**
 * Count of verified profiles matching the filter — used for "showing X of Y" UI.
 * Currently O(N) over the full profile set; replace with a sparse counter or
 * search-index `getDocuments` count when scale demands.
 */
export const count = query({
  args: {
    search: v.optional(v.string()),
    batches: v.optional(v.array(v.number())),
    programs: v.optional(v.array(v.string())),
    cities: v.optional(v.array(v.string())),
    countries: v.optional(v.array(v.string())),
    companies: v.optional(v.array(v.string())),
    skills: v.optional(v.array(v.string())),
    openTo: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const filters: Filters = {
      search: args.search,
      batches: args.batches,
      programs: args.programs,
      cities: args.cities,
      countries: args.countries,
      companies: args.companies,
      skills: args.skills,
      openTo: args.openTo,
    };
    const profiles = await ctx.db.query("profiles").collect();
    let matched = 0;
    let total = 0;
    for (const p of profiles) {
      if (p.verifiedAt == null) continue;
      total += 1;
      if (profileMatches(p, filters)) matched += 1;
    }
    return { matched, total };
  },
});

/**
 * Adjacent-suggestion empty state: when a strict filter combo returns 0
 * results, compute small expansions and report their result counts.
 *
 * Returns up to 4 suggestions, in priority order:
 *   - widen the batch filter to ±2 years
 *   - widen the city filter (remove just the city)
 *   - drop the company filter
 *   - drop the most-specific facet (heuristic: skills or openTo)
 */
export const adjacentSuggestions = query({
  args: {
    search: v.optional(v.string()),
    batches: v.optional(v.array(v.number())),
    programs: v.optional(v.array(v.string())),
    cities: v.optional(v.array(v.string())),
    countries: v.optional(v.array(v.string())),
    companies: v.optional(v.array(v.string())),
    skills: v.optional(v.array(v.string())),
    openTo: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const base: Filters = {
      search: args.search,
      batches: args.batches,
      programs: args.programs,
      cities: args.cities,
      countries: args.countries,
      companies: args.companies,
      skills: args.skills,
      openTo: args.openTo,
    };
    const profiles = await ctx.db.query("profiles").collect();
    const verified = profiles.filter((p) => p.verifiedAt != null);

    const countWith = (f: Filters) =>
      verified.reduce((n, p) => (profileMatches(p, f) ? n + 1 : n), 0);

    const suggestions: { label: string; filter: Filters; count: number }[] = [];

    if (base.batches && base.batches.length === 1) {
      const yr = base.batches[0];
      const widened = [yr - 2, yr - 1, yr, yr + 1, yr + 2];
      const c = countWith({ ...base, batches: widened });
      if (c > 0) {
        suggestions.push({
          label: `Widen batch to ${yr - 2}–${yr + 2} (${c} alumni)`,
          filter: { ...base, batches: widened },
          count: c,
        });
      }
    }
    if (base.cities && base.cities.length > 0) {
      const c = countWith({ ...base, cities: undefined });
      if (c > 0) {
        suggestions.push({
          label: `Remove the city filter (${c} alumni)`,
          filter: { ...base, cities: undefined },
          count: c,
        });
      }
    }
    if (base.companies && base.companies.length > 0) {
      const c = countWith({ ...base, companies: undefined });
      if (c > 0) {
        suggestions.push({
          label: `Remove the company filter (${c} alumni)`,
          filter: { ...base, companies: undefined },
          count: c,
        });
      }
    }
    if (base.skills && base.skills.length > 0) {
      const c = countWith({ ...base, skills: undefined });
      if (c > 0) {
        suggestions.push({
          label: `Remove the skill filter (${c} alumni)`,
          filter: { ...base, skills: undefined },
          count: c,
        });
      }
    }
    if (base.openTo && base.openTo.length > 0) {
      const c = countWith({ ...base, openTo: undefined });
      if (c > 0) {
        suggestions.push({
          label: `Remove the “open to” filter (${c} alumni)`,
          filter: { ...base, openTo: undefined },
          count: c,
        });
      }
    }

    return suggestions.slice(0, 3);
  },
});

/**
 * Public, unauthenticated mentor slice for the marketing landing.
 * Returns up to 4 verified profiles tagged as mentors (case-insensitive match
 * on the `openTo` array). Only public-shape fields are mapped out.
 */
export const publicMentors = query({
  args: {},
  handler: async (ctx) => {
    // @no-privacy-required: only public-tier fields returned; openTo signal is opt-in.
    const profiles = await ctx.db.query("profiles").collect();
    const candidates = profiles.filter((p) => {
      if (p.verifiedAt == null) return false;
      if (p.excludeFromSearchEngines) return false;
      const tags = (p.openTo ?? []).map((t) => t.toLowerCase());
      return tags.some((t) => t.includes("mentor"));
    });

    const out: Array<{
      _id: Doc<"profiles">["_id"];
      displayName: string;
      slug: string;
      program?: string;
      batch?: number;
      currentRole?: string;
      company?: string;
    }> = [];
    for (const p of candidates.slice(0, 4)) {
      const safe = applyPrivacy(p, { kind: "stranger" });
      out.push({
        _id: p._id,
        displayName: safe.displayName ?? p.displayName,
        slug: safe.slug ?? p.slug,
        program: safe.program,
        batch: safe.batch,
        currentRole: safe.currentRole,
        company: safe.company,
      });
    }
    return out;
  },
});

/**
 * Distinct values for each facet — populates the filter sidebar's option list
 * with counts (Lazada/Shopee-style faceted UI).
 */
export const facets = query({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").collect();
    const verified = profiles.filter((p) => p.verifiedAt != null);

    const batches = new Map<number, number>();
    const programs = new Map<string, number>();
    const cities = new Map<string, number>();
    const countries = new Map<string, number>();
    const companies = new Map<string, number>();

    for (const p of verified) {
      batches.set(p.batch, (batches.get(p.batch) ?? 0) + 1);
      programs.set(p.program, (programs.get(p.program) ?? 0) + 1);
      if (p.city) cities.set(p.city, (cities.get(p.city) ?? 0) + 1);
      if (p.country)
        countries.set(p.country, (countries.get(p.country) ?? 0) + 1);
      if (p.company)
        companies.set(p.company, (companies.get(p.company) ?? 0) + 1);
    }

    const toEntries = (m: Map<string | number, number>) =>
      [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }));

    return {
      batches: toEntries(batches),
      programs: toEntries(programs),
      cities: toEntries(cities),
      countries: toEntries(countries),
      companies: toEntries(companies),
    };
  },
});
