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
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
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
      // @full-scan-ok: the unfiltered branch of an admin list is every employer by definition; the tier-filtered branch above does use by_tier
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

    // @full-scan-ok: the unfiltered branch of an admin list is every employer by definition; the tier-filtered branch above does use by_tier
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

// ------------------------------------------------------- company profile ---
//
// Employer admins manage their own org's public company profile from
// /employer/company. Name, slug and trust tier stay admin-controlled (they are
// what verification vouches for); everything else is self-service.

const COMPANY_EDITOR_ROLES = [
  "partner-employer-admin",
  "verified-employer-admin",
  "moderator",
  "super-admin",
] as const;

const COMPANY_SIZES = [
  "1–10",
  "11–50",
  "51–200",
  "201–500",
  "501–1,000",
  "1,001–5,000",
  "5,000+",
] as const;

async function requireCompanyEditor(
  ctx: QueryCtx | MutationCtx,
  employerOrgId: Id<"employerOrgs">,
) {
  const { userId, user } = await requireRole(ctx, [...COMPANY_EDITOR_ROLES]);
  const org = await ctx.db.get(employerOrgId);
  if (!org) {
    throw new ConvexError({ code: "not-found", message: "Employer not found" });
  }
  const roles = user.roles ?? [];
  const isPlatformAdmin =
    roles.includes("super-admin") || roles.includes("moderator");
  if (!isPlatformAdmin && !(org.adminUserIds ?? []).includes(userId)) {
    throw new ConvexError({
      code: "forbidden",
      message: "You don't manage this employer",
    });
  }
  if (!isPlatformAdmin && org.suspendedAt) {
    throw new ConvexError({
      code: "suspended",
      message: "This employer is suspended",
    });
  }
  return { userId, org, isPlatformAdmin };
}

function optionalText(
  raw: string | undefined,
  max: number,
  label: string,
): string | undefined {
  const value = (raw ?? "").trim();
  if (value.length > max) {
    throw new ConvexError({
      code: "validation",
      message: `${label} must be ${max} characters or fewer`,
    });
  }
  return value || undefined;
}

export const getCompanyProfile = query({
  args: { employerOrgId: v.id("employerOrgs") },
  handler: async (ctx, { employerOrgId }) => {
    const { org, isPlatformAdmin } = await requireCompanyEditor(
      ctx,
      employerOrgId,
    );
    return {
      _id: org._id,
      name: org.name,
      slug: org.slug,
      tier: org.tier,
      tagline: org.tagline ?? "",
      about: org.about ?? "",
      industry: org.industry ?? "",
      companySize: org.companySize ?? "",
      foundedYear: org.foundedYear ?? null,
      websiteUrl: org.websiteUrl ?? "",
      hqCity: org.hqCity ?? "",
      contactEmail: org.contactEmail ?? "",
      logoUrl: org.logoStorageId
        ? await ctx.storage.getUrl(org.logoStorageId)
        : null,
      updatedAt: org.updatedAt,
      isPlatformAdmin,
      companySizes: [...COMPANY_SIZES],
    };
  },
});

export const updateCompanyProfile = mutation({
  args: {
    employerOrgId: v.id("employerOrgs"),
    tagline: v.optional(v.string()),
    about: v.optional(v.string()),
    industry: v.optional(v.string()),
    companySize: v.optional(v.string()),
    foundedYear: v.optional(v.number()),
    websiteUrl: v.optional(v.string()),
    hqCity: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
  },
  handler: withAuditLog(async (ctx, args: {
    employerOrgId: Id<"employerOrgs">;
    tagline?: string;
    about?: string;
    industry?: string;
    companySize?: string;
    foundedYear?: number;
    websiteUrl?: string;
    hqCity?: string;
    contactEmail?: string;
  }) => {
    await requireRole(ctx, [...COMPANY_EDITOR_ROLES]);
    const { org } = await requireCompanyEditor(ctx, args.employerOrgId);

    let websiteUrl = optionalText(args.websiteUrl, 200, "Website");
    if (websiteUrl) {
      if (!/^https?:\/\//i.test(websiteUrl)) websiteUrl = `https://${websiteUrl}`;
      try {
        new URL(websiteUrl);
      } catch {
        throw new ConvexError({ code: "validation", message: "Website URL is invalid" });
      }
    }
    const contactEmail = optionalText(args.contactEmail, 200, "Contact email");
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      throw new ConvexError({ code: "validation", message: "Contact email is invalid" });
    }
    const companySize = optionalText(args.companySize, 20, "Company size");
    if (companySize && !(COMPANY_SIZES as readonly string[]).includes(companySize)) {
      throw new ConvexError({ code: "validation", message: "Unknown company size" });
    }
    const year = args.foundedYear;
    if (
      year != null &&
      (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear())
    ) {
      throw new ConvexError({ code: "validation", message: "Founded year out of range" });
    }

    const patch = {
      tagline: optionalText(args.tagline, 120, "Tagline"),
      about: optionalText(args.about, 3000, "About"),
      industry: optionalText(args.industry, 80, "Industry"),
      companySize,
      foundedYear: year ?? undefined,
      websiteUrl,
      hqCity: optionalText(args.hqCity, 120, "Headquarters"),
      contactEmail,
      updatedAt: Date.now(),
    };
    await ctx.db.patch(org._id, patch);
    return {
      action: "update-company-profile",
      target: { type: "employerOrg", id: org._id },
      metadata: {
        name: org.name,
        changedFields: (Object.keys(patch) as Array<keyof typeof patch>).filter(
          (k) => k !== "updatedAt" && patch[k] !== org[k],
        ),
      },
    };
  }),
});

// @no-audit-required: only mints an ephemeral upload token; attaching the logo is audited in setCompanyLogo.
export const generateLogoUploadUrl = mutation({
  args: { employerOrgId: v.id("employerOrgs") },
  handler: async (ctx, { employerOrgId }) => {
    await requireRole(ctx, [...COMPANY_EDITOR_ROLES]);
    await requireCompanyEditor(ctx, employerOrgId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setCompanyLogo = mutation({
  args: {
    employerOrgId: v.id("employerOrgs"),
    storageId: v.optional(v.id("_storage")),
  },
  handler: withAuditLog(async (ctx, { employerOrgId, storageId }: {
    employerOrgId: Id<"employerOrgs">;
    storageId?: Id<"_storage">;
  }) => {
    await requireRole(ctx, [...COMPANY_EDITOR_ROLES]);
    const { org } = await requireCompanyEditor(ctx, employerOrgId);
    if (org.logoStorageId && org.logoStorageId !== storageId) {
      await ctx.storage.delete(org.logoStorageId);
    }
    await ctx.db.patch(org._id, { logoStorageId: storageId, updatedAt: Date.now() });
    return {
      action: storageId ? "set-company-logo" : "remove-company-logo",
      target: { type: "employerOrg", id: org._id },
      metadata: { name: org.name },
    };
  }),
});
