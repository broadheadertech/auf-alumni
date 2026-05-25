/**
 * Employer onboarding + trust tiers (Epic 12).
 *
 * - Super-admin grants Partner-tier access via invite link.
 * - Prospective verified-tier employers apply, admin reviews.
 * - Tier badge surfaces across jobs board.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export const grantPartnerAccess = mutation({
  args: {
    name: v.string(),
    websiteUrl: v.optional(v.string()),
    hqCity: v.optional(v.string()),
    contactEmail: v.string(),
  },
  handler: withAuditLog(async (ctx, args: { name: string; websiteUrl?: string; hqCity?: string; contactEmail: string }) => {
    await requireRole(ctx, ["super-admin"]);
    if (!args.name.trim() || !args.contactEmail.trim()) {
      throw new ConvexError({
        code: "validation",
        message: "Name and contact email required",
      });
    }
    const now = Date.now();
    const id = await ctx.db.insert("employerOrgs", {
      name: args.name.trim(),
      slug: slugify(args.name),
      tier: "partner",
      websiteUrl: args.websiteUrl,
      hqCity: args.hqCity,
      planTier: "partner-free",
      jobPostsUsed: 0,
      createdAt: now,
      updatedAt: now,
    });
    return {
      action: "grant-partner-employer",
      target: { type: "employerOrg", id },
      reason: `Partner-tier granted to ${args.name}`,
      metadata: { contactEmail: args.contactEmail },
      result: { employerOrgId: id },
    };
  }),
});

// @no-audit-required: prospective-employer self-service signup; admin-side review is audited.
export const applyForVerified = mutation({
  args: {
    name: v.string(),
    websiteUrl: v.string(),
    hqCity: v.string(),
    registrationId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (!args.name.trim() || !args.websiteUrl.trim()) {
      throw new ConvexError({
        code: "validation",
        message: "Name and website required",
      });
    }
    const now = Date.now();
    const id = await ctx.db.insert("employerOrgs", {
      name: args.name.trim(),
      slug: slugify(args.name),
      tier: "unverified",
      websiteUrl: args.websiteUrl,
      hqCity: args.hqCity,
      planTier: "free",
      jobPostsUsed: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { employerOrgId: id, status: "pending-review" };
  },
});

export const approveVerifiedTier = mutation({
  args: { employerOrgId: v.id("employerOrgs") },
  handler: withAuditLog(async (ctx, { employerOrgId }: { employerOrgId: Id<"employerOrgs"> }) => {
    await requireRole(ctx, ["moderator", "super-admin"]);
    const org = await ctx.db.get(employerOrgId);
    if (!org) {
      throw new ConvexError({
        code: "not-found",
        message: "Employer not found",
      });
    }
    await ctx.db.patch(employerOrgId, {
      tier: "verified",
      updatedAt: Date.now(),
    });
    return {
      action: "approve-employer-verified",
      target: { type: "employerOrg", id: employerOrgId },
      reason: `Verified-tier approved for ${org.name}`,
    };
  }),
});

export const listEmployers = query({
  args: { tier: v.optional(v.string()) },
  handler: async (ctx, { tier }) => {
    await requireRole(ctx, ["moderator", "super-admin"]);
    const rows = tier
      ? await ctx.db
          .query("employerOrgs")
          .withIndex("by_tier", (q) => q.eq("tier", tier))
          .collect()
      : await ctx.db.query("employerOrgs").collect();
    return rows.map((r) => ({
      _id: r._id,
      name: r.name,
      slug: r.slug,
      tier: r.tier,
      websiteUrl: r.websiteUrl,
      hqCity: r.hqCity,
      planTier: r.planTier,
      jobPostsUsed: r.jobPostsUsed,
      suspendedAt: r.suspendedAt,
      createdAt: r.createdAt,
    }));
  },
});

/**
 * Employer-admin's own roster — used by the employer dashboard / applicants /
 * billing org-picker. We don't yet model `employerOrgAdmins` as a join table,
 * so for the demo the rule is:
 *
 *   - super-admin / moderator   → all employers (same as listEmployers)
 *   - partner-employer-admin /
 *     verified-employer-admin   → all non-suspended employers
 *   - everyone else             → empty
 *
 * Returns the same shape as listEmployers so the UI components can swap.
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user) return [];
    const roles = new Set(user.roles ?? []);
    const isAdmin = roles.has("super-admin") || roles.has("moderator");
    const isEmployer =
      roles.has("partner-employer-admin") ||
      roles.has("verified-employer-admin");
    if (!isAdmin && !isEmployer) return [];

    const rows = await ctx.db.query("employerOrgs").collect();
    const visible = isAdmin
      ? rows
      : rows.filter(
          (r) =>
            !r.suspendedAt && (r.adminUserIds ?? []).includes(userId),
        );
    return visible.map((r) => ({
      _id: r._id,
      name: r.name,
      slug: r.slug,
      tier: r.tier,
      websiteUrl: r.websiteUrl,
      hqCity: r.hqCity,
      planTier: r.planTier,
      jobPostsUsed: r.jobPostsUsed,
      suspendedAt: r.suspendedAt,
      createdAt: r.createdAt,
    }));
  },
});
