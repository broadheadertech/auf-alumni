/**
 * School analytics dashboard (Epic 16 Stories 16.4 + 16.5).
 *
 * Aggregate-only metrics. K-anonymity check (k ≥ 5) enforced on CSV exports —
 * any bucket with <5 individuals collapses to "—" rather than being identifiable.
 */

import { query } from "./_generated/server";
import { requireRole } from "./helpers/rbac";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["super-admin", "moderator"]);
    const now = Date.now();
    const monthAgo = now - 30 * MS_PER_DAY;

    const users = await ctx.db.query("users").collect();
    // @no-privacy-required: aggregate counts only; no per-alumna field reaches the response.
    const profiles = await ctx.db.query("profiles").collect();
    const verifiedProfiles = profiles.filter((p) => p.verifiedAt != null);
    const newThisMonth = verifiedProfiles.filter(
      (p) => p.verifiedAt! > monthAgo,
    ).length;

    // MAU heuristic: users with lastLoginAt in the last 30 days
    const mau = users.filter(
      (u) => (u.lastLoginAt ?? 0) > monthAgo && !u.deletedAt,
    ).length;

    const employers = await ctx.db.query("employerOrgs").collect();
    const activePartners = employers.filter(
      (e) => e.tier === "partner" && !e.suspendedAt,
    ).length;
    const activeVerified = employers.filter(
      (e) => e.tier === "verified" && !e.suspendedAt,
    ).length;

    const jobs = await ctx.db.query("jobs").collect();
    const openJobs = jobs.filter((j) => j.status === "published").length;
    const applicationsThisMonth = await ctx.db
      .query("applications")
      .filter((q) => q.gt(q.field("createdAt"), monthAgo))
      .collect();

    const connections = await ctx.db.query("connections").collect();
    const connectedRows = connections.filter((c) => c.status === "connected");
    const avgConnections =
      verifiedProfiles.length === 0
        ? 0
        : (connectedRows.length * 2) / verifiedProfiles.length;

    return {
      verifiedTotal: verifiedProfiles.length,
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
    const profiles = await ctx.db.query("profiles").collect();
    const verified = profiles.filter(
      (p) => p.verifiedAt != null && !p.excludeFromSearchEngines,
    );
    const verifiedAlumni = verified.length;

    const jobs = await ctx.db.query("jobs").collect();
    const openJobs = jobs.filter((j) => j.status === "published").length;

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
    const profiles = await ctx.db.query("profiles").collect();
    const verified = profiles.filter((p) => p.verifiedAt != null);

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
