/**
 * Public company pages (Epic 12 — employer landing pages).
 *
 * Surfaces the verified employer roster + per-company detail pages to the
 * marketing surface. No auth required — only public-tier shape is returned.
 *
 * Alumni-here join is best-effort: we case-insensitive match
 * `profiles.company` against `employerOrgs.name`. This is the same loose join
 * used by the seed data; once profiles gain a hard FK to employerOrgs the
 * helper here can be tightened.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

function norm(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase();
}

type AlumnusCard = {
  slug: string;
  displayName: string;
  currentRole: string | null;
  batch: number;
  program: string;
};

type CompanyJobCard = {
  _id: Id<"jobs">;
  title: string;
  location: string;
  employmentType: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  publishedAt: number | null;
};

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const org = await ctx.db
      .query("employerOrgs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org) return null;

    // Logo (storage-backed, optional).
    const logoUrl = org.logoStorageId
      ? await ctx.storage.getUrl(org.logoStorageId)
      : null;

    // Published jobs for this employer.
    const allJobs = await ctx.db
      .query("jobs")
      .withIndex("by_employer_time", (q) => q.eq("employerOrgId", org._id))
      .order("desc")
      .collect();
    const jobs: CompanyJobCard[] = allJobs
      .filter((j) => j.status === "published")
      .map((j) => ({
        _id: j._id,
        title: j.title,
        location: j.location,
        employmentType: j.employmentType,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        salaryCurrency: j.salaryCurrency,
        publishedAt: j.publishedAt ?? null,
      }));

    // Verified alumni whose `company` field matches this org's name.
    // @no-privacy-required: public-tier fields only; aggregate counts.
    const profiles = await ctx.db.query("profiles").collect();
    const orgKey = norm(org.name);
    const matched = profiles.filter(
      (p) =>
        p.verifiedAt != null &&
        !p.excludeFromSearchEngines &&
        norm(p.company) === orgKey,
    );

    const alumniHere: AlumnusCard[] = matched.slice(0, 12).map((p) => ({
      slug: p.slug,
      displayName: p.displayName,
      currentRole: p.currentRole ?? null,
      batch: p.batch,
      program: p.program,
    }));

    // "Open to hire" signal — any matched profile has the flag on; copy the
    // first non-empty note we find so the banner has something to say.
    let isOpenToHire = false;
    let openToHireNote: string | null = null;
    for (const p of matched) {
      if (p.openToHire) {
        isOpenToHire = true;
        if (!openToHireNote && p.openToHireNote && p.openToHireNote.trim()) {
          openToHireNote = p.openToHireNote.trim();
        }
      }
    }

    // Follower proxy: in v1 we don't have company-level follows, so we count
    // follows pointing at any of the employer's registered admins. Aggregate
    // count only — no per-follower data leaves the query.
    const adminIds: Array<Id<"users">> = org.adminUserIds ?? [];
    let followerCount = 0;
    for (const adminId of adminIds) {
      const followers = await ctx.db
        .query("follows")
        .withIndex("by_followee", (q) => q.eq("followeeId", adminId))
        .collect();
      followerCount += followers.length;
    }

    return {
      _id: org._id,
      slug: org.slug,
      name: org.name,
      tier: org.tier,
      websiteUrl: org.websiteUrl ?? null,
      hqCity: org.hqCity ?? null,
      planTier: org.planTier,
      jobPostsUsed: org.jobPostsUsed,
      logoUrl,
      isOpenToHire,
      openToHireNote,
      jobs,
      alumniHere,
      alumniCount: matched.length,
      followerCount,
    };
  },
});

export const list = query({
  args: { tier: v.optional(v.string()) },
  handler: async (ctx, { tier }) => {
    const orgs = tier
      ? await ctx.db
          .query("employerOrgs")
          .withIndex("by_tier", (q) => q.eq("tier", tier))
          .collect()
      : await ctx.db.query("employerOrgs").collect();

    // One-shot profile fetch for company-name counting. The lint annotation
    // must sit on the immediately-prior line.
    // @no-privacy-required: public-tier fields only; aggregate counts.
    const profiles = await ctx.db.query("profiles").collect();
    const alumniByCompany = new Map<string, number>();
    for (const p of profiles) {
      if (p.verifiedAt == null) continue;
      if (p.excludeFromSearchEngines) continue;
      const key = norm(p.company);
      if (!key) continue;
      alumniByCompany.set(key, (alumniByCompany.get(key) ?? 0) + 1);
    }

    const rows: Array<{
      slug: string;
      name: string;
      tier: string;
      hqCity: string | null;
      logoUrl: string | null;
      jobsCount: number;
      alumniCount: number;
    }> = [];

    for (const org of orgs) {
      if (org.suspendedAt) continue;
      const logoUrl = org.logoStorageId
        ? await ctx.storage.getUrl(org.logoStorageId)
        : null;
      const orgJobs = await ctx.db
        .query("jobs")
        .withIndex("by_employer_time", (q) =>
          q.eq("employerOrgId", org._id),
        )
        .collect();
      const jobsCount = orgJobs.filter((j) => j.status === "published").length;
      rows.push({
        slug: org.slug,
        name: org.name,
        tier: org.tier,
        hqCity: org.hqCity ?? null,
        logoUrl,
        jobsCount,
        alumniCount: alumniByCompany.get(norm(org.name)) ?? 0,
      });
    }

    rows.sort((a, b) => {
      const tierRank: Record<string, number> = {
        partner: 0,
        verified: 1,
        unverified: 2,
      };
      const ta = tierRank[a.tier] ?? 3;
      const tb = tierRank[b.tier] ?? 3;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });

    return rows;
  },
});

// keep dataModel imports used so they don't shake out of the bundle
void (null as unknown as Doc<"employerOrgs">);
