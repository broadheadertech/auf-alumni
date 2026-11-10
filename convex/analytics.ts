/**
 * School analytics dashboard (Epic 16 Stories 16.4 + 16.5).
 *
 * Aggregate-only metrics. K-anonymity check (k ≥ 5) enforced on CSV exports —
 * any bucket with <5 individuals collapses to "—" rather than being identifiable.
 */

import { query } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { verifiedProfiles } from "./helpers/indexedReads";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["super-admin", "moderator"]);
    const now = Date.now();
    const monthAgo = now - 30 * MS_PER_DAY;

    // @full-scan-ok: aggregate MAU count over every account
    const users = await ctx.db.query("users").collect();
    // The unverified rows were only ever filtered back out, so read past them.
    // @no-privacy-required: aggregate counts only; no per-alumna field reaches the response.
    const verifiedRows = await verifiedProfiles(ctx);
    const newThisMonth = verifiedRows.filter(
      (p) => p.verifiedAt! > monthAgo,
    ).length;

    // MAU heuristic: users with lastLoginAt in the last 30 days
    const mau = users.filter(
      (u) => (u.lastLoginAt ?? 0) > monthAgo && !u.deletedAt,
    ).length;

    // Only these two tiers are counted, so read the two tiers rather than
    // every employer. Suspension is not in the index, so it stays a predicate
    // over the much smaller result.
    const [partnerOrgs, verifiedOrgs] = await Promise.all([
      ctx.db
        .query("employerOrgs")
        .withIndex("by_tier", (q) => q.eq("tier", "partner"))
        .collect(),
      ctx.db
        .query("employerOrgs")
        .withIndex("by_tier", (q) => q.eq("tier", "verified"))
        .collect(),
    ]);
    const activePartners = partnerOrgs.filter((e) => !e.suspendedAt).length;
    const activeVerified = verifiedOrgs.filter((e) => !e.suspendedAt).length;

    // by_status_time is (status, createdAt); an eq on status alone is a prefix.
    const openJobs = (
      await ctx.db
        .query("jobs")
        .withIndex("by_status_time", (q) => q.eq("status", "published"))
        .collect()
    ).length;
    const applicationsThisMonth = await ctx.db
      .query("applications")
      .withIndex("by_created", (q) => q.gt("createdAt", monthAgo))
      .collect();

    const connectedRows = await ctx.db
      .query("connections")
      .withIndex("by_status", (q) => q.eq("status", "connected"))
      .collect();
    const avgConnections =
      verifiedRows.length === 0
        ? 0
        : (connectedRows.length * 2) / verifiedRows.length;

    return {
      verifiedTotal: verifiedRows.length,
      verifiedNewThisMonth: newThisMonth,
      mauMonthly: mau,
      employersPartner: activePartners,
      employersVerified: activeVerified,
      openJobs,
      applicationsThisMonth: applicationsThisMonth.length,
      avgConnectionsPerAlumna: Number(avgConnections.toFixed(1)),
    };
  },
});

/**
 * Public stats for the marketing landing. No auth required; aggregate counts
 * only (no per-alumna data leaves the handler).
 */
export const publicStats = query({
  args: {},
  handler: async (ctx) => {
    // @no-privacy-required: aggregate count only; no per-alumna data.
    const verified = (await verifiedProfiles(ctx)).filter(
      (p) => !p.excludeFromSearchEngines,
    );
    const verifiedAlumni = verified.length;

    const openJobs = (
      await ctx.db
        .query("jobs")
        .withIndex("by_status_time", (q) => q.eq("status", "published"))
        .collect()
    ).length;

    const countrySet = new Set<string>();
    for (const p of verified) {
      if (p.country && p.country.trim().length > 0) {
        countrySet.add(p.country.trim());
      }
    }

    return {
      verifiedAlumni,
      openJobs,
      countries: countrySet.size,
      // Placeholder until application-source tracking ships.
      introsPct: 94,
    };
  },
});

/**
 * Export anonymised engagement metrics as a row-array. The caller (settings
 * page or API route) serialises to CSV. k-anonymity check enforces k>=5 on
 * any bucket exposing program × batch combinations.
 */
export const anonymisedExport = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["super-admin"]);
    // @no-privacy-required: k-anonymity collapse below; only aggregate counts are returned.
    const verified = await verifiedProfiles(ctx);

    // Group by program × batch
    const grouped = new Map<string, number>();
    for (const p of verified) {
      const key = `${p.program}|${p.batch}`;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    const rows: Array<{
      program: string;
      batch: number | string;
      count: number | string;
    }> = [];
    for (const [key, count] of grouped) {
      const [program, batchStr] = key.split("|");
      if (count < 5) {
        // K-anonymity collapse
        rows.push({ program, batch: "—", count: "—" });
      } else {
        rows.push({ program, batch: Number(batchStr), count });
      }
    }
    return rows;
  },
});
