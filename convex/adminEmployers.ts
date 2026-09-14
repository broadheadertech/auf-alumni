/**
 * Admin employer management — onboarding, tier + contract, MOA / NDA files.
 *
 * Replaces the prototype's in-memory "add employer" and localStorage document
 * overrides (src/lib/employer-docs.ts) so the Employers roster, employer
 * detail, dashboard contract alerts and public company pages all read the same
 * employerOrgs rows. Every mutation is role-gated and audit-logged.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";

const ADMIN_ROLES = ["moderator", "super-admin"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const tierValidator = v.union(v.literal("partner"), v.literal("verified"), v.literal("unverified"));
const docKindValidator = v.union(v.literal("moa"), v.literal("nda"));

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function checkContract(start?: string, end?: string) {
  for (const [label, d] of [["Contract start", start], ["Contract end", end]] as const) {
    if (d && !ISO_DATE.test(d)) {
      throw new ConvexError({ code: "validation", message: `${label} must be a date (YYYY-MM-DD)` });
    }
  }
  if (start && end && end < start) {
    throw new ConvexError({ code: "validation", message: "Contract end must be after the start" });
  }
}

function text(raw: string | undefined, max: number, label: string): string | undefined {
  const value = (raw ?? "").trim();
  if (value.length > max) {
    throw new ConvexError({ code: "validation", message: `${label} must be ${max} characters or fewer` });
  }
  return value || undefined;
}

export const onboardEmployer = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    industry: v.optional(v.string()),
    hqCity: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    tier: tierValidator,
    contractStart: v.optional(v.string()),
    contractEnd: v.optional(v.string()),
  },
  handler: withAuditLog(async (ctx, args: {
    name: string;
    description?: string;
    industry?: string;
    hqCity?: string;
    websiteUrl?: string;
    tier: "partner" | "verified" | "unverified";
    contractStart?: string;
    contractEnd?: string;
  }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const name = text(args.name, 120, "Name");
    if (!name) throw new ConvexError({ code: "validation", message: "Company name is required" });
    checkContract(args.contractStart, args.contractEnd);

    let slug = slugify(name) || "employer";
    for (let n = 2; ; n++) {
      const hit = await ctx.db
        .query("employerOrgs")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (!hit) break;
      slug = `${slugify(name)}-${n}`;
    }

    const now = Date.now();
    const id = await ctx.db.insert("employerOrgs", {
      name,
      slug,
      tier: args.tier,
      about: text(args.description, 3000, "Description"),
      industry: text(args.industry, 80, "Industry"),
      hqCity: text(args.hqCity, 120, "HQ city"),
      websiteUrl: text(args.websiteUrl, 200, "Website"),
      contractStart: args.contractStart || undefined,
      contractEnd: args.contractEnd || undefined,
      planTier: args.tier === "partner" ? "partner-free" : "free",
      jobPostsUsed: 0,
      createdAt: now,
      updatedAt: now,
    });
    return {
      action: "onboard-employer",
      target: { type: "employerOrg", id },
      metadata: { name, tier: args.tier },
      result: { employerOrgId: id, slug },
    };
  }),
});

export const updateEmployerAdmin = mutation({
  args: {
    employerOrgId: v.id("employerOrgs"),
    tier: v.optional(tierValidator),
    contractStart: v.optional(v.string()),
    contractEnd: v.optional(v.string()),
  },
  handler: withAuditLog(async (ctx, args: {
    employerOrgId: Id<"employerOrgs">;
    tier?: "partner" | "verified" | "unverified";
    contractStart?: string;
    contractEnd?: string;
  }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const org = await ctx.db.get(args.employerOrgId);
    if (!org) throw new ConvexError({ code: "not-found", message: "Employer not found" });
    const start = args.contractStart ?? org.contractStart;
    const end = args.contractEnd ?? org.contractEnd;
    checkContract(start, end);
    await ctx.db.patch(org._id, {
      tier: args.tier ?? org.tier,
      contractStart: start || undefined,
      contractEnd: end || undefined,
      updatedAt: Date.now(),
    });
    return {
      action: "update-employer-contract",
      target: { type: "employerOrg", id: org._id },
      metadata: { name: org.name, tier: args.tier, contractStart: start, contractEnd: end },
    };
  }),
});

// @no-audit-required: only mints an ephemeral upload token; attaching the file is audited in setEmployerDocument.
export const generateDocumentUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setEmployerDocument = mutation({
  args: {
    employerOrgId: v.id("employerOrgs"),
    kind: docKindValidator,
    filename: v.string(),
    sizeKb: v.number(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: withAuditLog(async (ctx, args: {
    employerOrgId: Id<"employerOrgs">;
    kind: "moa" | "nda";
    filename: string;
    sizeKb: number;
    storageId?: Id<"_storage">;
  }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const org = await ctx.db.get(args.employerOrgId);
    if (!org) throw new ConvexError({ code: "not-found", message: "Employer not found" });
    const filename = text(args.filename, 200, "File name");
    if (!filename) throw new ConvexError({ code: "validation", message: "File name is required" });
    const field = args.kind === "moa" ? "moaDoc" : "ndaDoc";
    const previous = org[field];
    if (previous?.storageId && previous.storageId !== args.storageId) {
      await ctx.storage.delete(previous.storageId);
    }
    await ctx.db.patch(org._id, {
      [field]: {
        filename,
        sizeKb: Math.max(0, Math.round(args.sizeKb)),
        uploadedAt: new Date().toISOString().slice(0, 10),
        storageId: args.storageId,
      },
      updatedAt: Date.now(),
    });
    return {
      action: `upload-employer-${args.kind}`,
      target: { type: "employerOrg", id: org._id },
      metadata: { name: org.name, filename },
    };
  }),
});

export const removeEmployerDocument = mutation({
  args: { employerOrgId: v.id("employerOrgs"), kind: docKindValidator },
  handler: withAuditLog(async (ctx, args: { employerOrgId: Id<"employerOrgs">; kind: "moa" | "nda" }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const org = await ctx.db.get(args.employerOrgId);
    if (!org) throw new ConvexError({ code: "not-found", message: "Employer not found" });
    const field = args.kind === "moa" ? "moaDoc" : "ndaDoc";
    const previous = org[field];
    if (previous?.storageId) await ctx.storage.delete(previous.storageId);
    await ctx.db.patch(org._id, { [field]: undefined, updatedAt: Date.now() });
    return {
      action: `remove-employer-${args.kind}`,
      target: { type: "employerOrg", id: org._id },
      metadata: { name: org.name },
    };
  }),
});
