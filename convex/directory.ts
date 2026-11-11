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
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { applyPrivacy, getViewerContext } from "./helpers/privacy";
import { hiddenUserIds, verifiedProfiles } from "./helpers/indexedReads";
import { resolveOffset, resolvePageSize } from "./helpers/paging";

/**
 * The roster is members-only.
 *
 * `applyPrivacy` already strips fields a stranger may not see, but it was the
 * ONLY thing standing between an anonymous caller and the whole membership:
 * these queries had no identity check, so anyone with the deployment URL could
 * page through every verified alumnus and read an exact member count. Privacy
 * tiers decide WHICH fields a viewer gets; this decides whether they get to
 * ask at all.
 *
 * Deliberately member-level rather than admin-only: the alumni feed's
 * suggestion rail and the "alumni at this company" block on a job both read
 * `list`. `publicMentors` stays public — it is bounded, consent-gated on
 * `openTo`, and returns stranger-tier fields only.
 */
async function requireMember(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError({
      code: "unauthenticated",
      message: "Sign in to browse the alumni directory",
    });
  }
  const user = await ctx.db.get(userId);
  if (!user || user.deletedAt || user.suspendedAt) {
    throw new ConvexError({
      code: "forbidden",
      message: "This account can't browse the directory",
    });
  }
  return userId;
}

/**
 * How many rows the search index may return before we stop.
 *
 * The directory previously `.collect()`ed every profile on every call and
 * filtered in JavaScript — fine at 71 rows, but the stated budget is p95
 * under 300ms at 10,000. With a search term we read the `search_all` index
 * instead, bounded by this cap rather than by table size.
 *
 * Without a term there is nothing to search on, and the remaining filters are
 * multi-valued (programs[], cities[], skills[]) while Convex filterFields are
 * equality on a single value — so those cannot be pushed into an index and the
 * scan stays. That is the path to revisit if the roster grows large.
 */
const SEARCH_CANDIDATE_CAP = 500;

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
  /** Employment status names (admin-managed "status" reference items). */
  statuses?: string[];
  /** Case-insensitive substring match on the profile's company. */
  companyQuery?: string;
};

/** Shared validator for every filterable directory query — one shape everywhere. */
const filterArgs = {
  search: v.optional(v.string()),
  batches: v.optional(v.array(v.number())),
  programs: v.optional(v.array(v.string())),
  cities: v.optional(v.array(v.string())),
  countries: v.optional(v.array(v.string())),
  companies: v.optional(v.array(v.string())),
  skills: v.optional(v.array(v.string())),
  openTo: v.optional(v.array(v.string())),
  statuses: v.optional(v.array(v.string())),
  companyQuery: v.optional(v.string()),
};

function toFilters(args: Filters): Filters {
  return {
    search: args.search,
    batches: args.batches,
    programs: args.programs,
    cities: args.cities,
    countries: args.countries,
    companies: args.companies,
    skills: args.skills,
    openTo: args.openTo,
    statuses: args.statuses,
    companyQuery: args.companyQuery,
  };
}

/**
 * Rows the query could possibly match.
 *
 * With a search term this reads the `search_all` index — bounded, and matching
 * the same haystack the scan used (name, role, company, program, bio, skills),
 * because `searchText` is built from exactly those fields. Without a term
 * there is nothing to search, so it falls back to the scan.
 *
 * Index matching is token-prefix, not substring: "info" finds "Information
 * Technology", but a fragment starting mid-word does not. For a roster search
 * that is the behaviour people expect, and it is what makes the query bounded.
 */
async function candidateProfiles(
  ctx: QueryCtx,
  f: Filters,
): Promise<Array<Doc<"profiles">>> {
  const term = (f.search ?? "").trim();
  if (term.length < 2) {
    // profileMatches() drops unverified rows anyway, so reading them was pure
    // waste on the directory's default (no-term) load.
    // @no-privacy-required: candidate rows for the roster; every row that reaches a client passes through applyPrivacy in list().
    return await verifiedProfiles(ctx);
  }
  // @no-privacy-required: candidate rows for the roster; every row that reaches a client passes through applyPrivacy in list().
  return await ctx.db
    .query("profiles")
    .withSearchIndex("search_all", (q) => q.search("searchText", term))
    .take(SEARCH_CANDIDATE_CAP);
}

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
  if (
    f.statuses &&
    f.statuses.length > 0 &&
    !(p.employmentStatus && f.statuses.includes(p.employmentStatus))
  ) {
    return false;
  }
  if (f.companyQuery && f.companyQuery.trim().length > 0) {
    const needle = f.companyQuery.trim().toLowerCase();
    if (!(p.company ?? "").toLowerCase().includes(needle)) return false;
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
    ...filterArgs,
    pageSize: v.optional(v.number()),
    /** Offset cursor from a previous page's `continueCursor`. */
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const filters = toFilters(args);
    // Same contract as every other paged query; see convex/helpers/paging.ts.
    const pageSize = resolvePageSize(args.pageSize ?? PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
    const offset = resolveOffset(args.cursor);

    // Filter the full set, then page. (Previously this paged raw rows first and
    // filtered after, so filtered results could be silently truncated and
    // disagree with `count`. Replaceable with a search index later — the
    // interface is preserved.)
    const [profiles, hidden] = await Promise.all([
      candidateProfiles(ctx, filters),
      hiddenUserIds(ctx),
    ]);
    const matched = profiles.filter(
      (p) => !hidden.has(p.userId) && profileMatches(p, filters),
    );
    const slice = matched.slice(offset, offset + pageSize);

    // Privacy-apply per profile so self / connection state is per-result.
    const pageWithPrivacy = [] as Array<
      Partial<Doc<"profiles">> & { photoUrl: string | null }
    >;
    for (const p of slice) {
      const vctx = await getViewerContext(ctx, p.userId);
      const safe = applyPrivacy(p, vctx);
      pageWithPrivacy.push({
        ...safe,
        photoUrl: safe.photoStorageId
          ? await ctx.storage.getUrl(safe.photoStorageId)
          : null,
      });
    }

    const next = offset + slice.length;
    return {
      page: pageWithPrivacy,
      isDone: next >= matched.length,
      continueCursor: String(next),
      /**
       * How many rows this query can serve for these filters.
       *
       * Deliberately not `count.matched`: that one substring-matches every
       * verified profile, while this query narrows through the search index
       * first, which is token-prefix. So with a search term `count.matched`
       * can be larger than anything this query will ever return, and a
       * paginator built on it would offer pages that come back empty. This
       * number is the one the page numbers have to agree with.
       */
      total: matched.length,
    };
  },
});

/**
 * Count of verified profiles matching the filter — used for "showing X of Y" UI.
 * Currently O(N) over the full profile set; replace with a sparse counter or
 * search-index `getDocuments` count when scale demands.
 */
export const count = query({
  args: filterArgs,
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const filters = toFilters(args);
    // Not candidateProfiles(): `total` is the size of the whole roster, the
    // denominator in "N of M alumni". Narrowing it to the search hits made the
    // display read "1 of 9" where it should say "1 of 71". Reading the
    // verified rows by index gives the same denominator, since the loop below
    // discarded the unverified ones regardless.
    const [profiles, hidden] = await Promise.all([
      // @no-privacy-required: aggregate counts only; no per-alumna field is returned.
      verifiedProfiles(ctx),
      hiddenUserIds(ctx),
    ]);
    let matched = 0;
    let total = 0;
    for (const p of profiles) {
      if (hidden.has(p.userId)) continue;
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
  args: filterArgs,
  handler: async (ctx, args) => {
    await requireMember(ctx);
    const base = toFilters(args);
    const [profiles, hidden] = await Promise.all([
      candidateProfiles(ctx, base),
      hiddenUserIds(ctx),
    ]);
    const verified = profiles.filter((p) => p.verifiedAt != null && !hidden.has(p.userId));
    // (candidateProfiles may return unverified rows on the search path, so
    // the verifiedAt check stays.)

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
    if ((base.companies && base.companies.length > 0) || base.companyQuery) {
      const c = countWith({ ...base, companies: undefined, companyQuery: undefined });
      if (c > 0) {
        suggestions.push({
          label: `Remove the company filter (${c} alumni)`,
          filter: { ...base, companies: undefined, companyQuery: undefined },
          count: c,
        });
      }
    }
    if (base.statuses && base.statuses.length > 0) {
      const c = countWith({ ...base, statuses: undefined });
      if (c > 0) {
        suggestions.push({
          label: `Remove the status filter (${c} alumni)`,
          filter: { ...base, statuses: undefined },
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
    const profiles = await verifiedProfiles(ctx);
    const candidates = profiles.filter((p) => {
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
    await requireMember(ctx);
    // @no-privacy-required: facet value counts only; no per-alumna field is returned.
    const verified = await verifiedProfiles(ctx);

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
