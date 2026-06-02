/**
 * Jobs board, applications, pipeline (Epic 13).
 *
 * - Employers post jobs → moderation queue → admin approves → published.
 * - Alumni browse jobs filtered to their batch/program/skill targeting.
 * - Apply attaches a privacy-filtered profile snapshot at submission time.
 * - Employers manage applicant pipeline.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";
import { applyPrivacy } from "./helpers/privacy";

const STAGES = [
  "new",
  "screening",
  "interview",
  "offered",
  "hired",
  "not-selected",
] as const;

function jobMatches(
  job: Doc<"jobs">,
  profile: Doc<"profiles"> | null,
): boolean {
  if (job.status !== "published") return false;
  if (!profile) return false;
  if (job.targetingBatches && job.targetingBatches.length > 0) {
    if (!job.targetingBatches.includes(profile.batch)) return false;
  }
  if (job.targetingPrograms && job.targetingPrograms.length > 0) {
    if (!job.targetingPrograms.includes(profile.program)) return false;
  }
  if (job.targetingSkills && job.targetingSkills.length > 0) {
    const skillSet = new Set((profile.skills ?? []).map((s) => s.toLowerCase()));
    const ok = job.targetingSkills.some((s) => skillSet.has(s.toLowerCase()));
    if (!ok) return false;
  }
  if (job.targetingCity && job.targetingCity.length > 0) {
    if ((profile.city ?? "") !== job.targetingCity) return false;
  }
  return true;
}

// @no-audit-required: user (employer-admin) self-service post creation; admin moderation IS audited.
export const createJob = mutation({
  args: {
    employerOrgId: v.id("employerOrgs"),
    title: v.string(),
    description: v.string(),
    location: v.string(),
    employmentType: v.string(),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    salaryCurrency: v.optional(v.string()),
    targetingBatches: v.optional(v.array(v.number())),
    targetingPrograms: v.optional(v.array(v.string())),
    targetingSkills: v.optional(v.array(v.string())),
    targetingCity: v.optional(v.string()),
    closingAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const org = await ctx.db.get(args.employerOrgId);
    if (!org) {
      throw new ConvexError({
        code: "not-found",
        message: "Employer not found",
      });
    }
    if (org.suspendedAt) {
      throw new ConvexError({
        code: "suspended",
        message: "Your employer account is suspended",
      });
    }
    if (org.tier === "unverified") {
      throw new ConvexError({
        code: "tier-insufficient",
        message: "Verified-tier required to post jobs",
      });
    }
    // Membership: must be on the org's admin list OR a platform moderator.
    const user = await ctx.db.get(userId);
    const userRoles = new Set(user?.roles ?? []);
    const platformOverride =
      userRoles.has("super-admin") || userRoles.has("moderator");
    const isMember = (org.adminUserIds ?? []).includes(userId);
    if (!platformOverride && !isMember) {
      throw new ConvexError({
        code: "forbidden",
        message: "You are not an admin of this employer organisation",
      });
    }

    const now = Date.now();
    const id = await ctx.db.insert("jobs", {
      employerOrgId: args.employerOrgId,
      title: args.title.trim(),
      description: args.description.trim(),
      location: args.location.trim(),
      employmentType: args.employmentType,
      salaryMin: args.salaryMin,
      salaryMax: args.salaryMax,
      salaryCurrency: args.salaryCurrency ?? "PHP",
      targetingBatches: args.targetingBatches,
      targetingPrograms: args.targetingPrograms,
      targetingSkills: args.targetingSkills,
      targetingCity: args.targetingCity,
      aufOnly: true, // partner-tier locks this on; v1 default
      status: "pending-moderation",
      createdBy: userId,
      createdAt: now,
      closingAt: args.closingAt,
    });

    await ctx.db.patch(args.employerOrgId, {
      jobPostsUsed: org.jobPostsUsed + 1,
      updatedAt: now,
    });
    return { jobId: id, status: "pending-moderation" };
  },
});

export const moderationQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["moderator", "super-admin"]);
    const rows = await ctx.db
      .query("jobs")
      .withIndex("by_status_time", (q) => q.eq("status", "pending-moderation"))
      .order("desc")
      .take(50);
    const out = [];
    for (const j of rows) {
      const org = await ctx.db.get(j.employerOrgId);
      out.push({
        ...j,
        employerName: org?.name ?? "—",
        employerTier: org?.tier ?? "unverified",
      });
    }
    return out;
  },
});

export const approveJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: withAuditLog(async (ctx, { jobId }) => {
    const { userId } = await requireRole(ctx, ["moderator", "super-admin"]);
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new ConvexError({ code: "not-found", message: "Job not found" });
    }
    const now = Date.now();
    await ctx.db.patch(jobId, {
      status: "published",
      publishedAt: now,
      decidedBy: userId,
    });
    return {
      action: "approve-job",
      target: { type: "job", id: jobId },
      reason: "moderation-approved",
    };
  }),
});

export const rejectJob = mutation({
  args: { jobId: v.id("jobs"), reason: v.string() },
  handler: withAuditLog(async (ctx, { jobId, reason }) => {
    const { userId } = await requireRole(ctx, ["moderator", "super-admin"]);
    if (!reason.trim()) {
      throw new ConvexError({
        code: "reason-required",
        message: "Reason required",
      });
    }
    await ctx.db.patch(jobId, {
      status: "suspended",
      statusReason: reason.trim(),
      suspendedAt: Date.now(),
      decidedBy: userId,
    });
    return {
      action: "reject-job",
      target: { type: "job", id: jobId },
      reason,
    };
  }),
});

/**
 * Alumni-facing job board — filter to jobs where the viewer's profile matches
 * the targeting. Optional opt-out via showUnmatched=true.
 */
export const browse = query({
  args: { showUnmatched: v.optional(v.boolean()) },
  handler: async (ctx, { showUnmatched }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_published")
      .order("desc")
      .take(100);
    const published = jobs.filter((j) => j.status === "published");
    const filtered = showUnmatched
      ? published
      : published.filter((j) => jobMatches(j, profile));

    const out = [];
    for (const j of filtered) {
      const org = await ctx.db.get(j.employerOrgId);
      out.push({
        ...j,
        employerName: org?.name ?? "—",
        employerTier: org?.tier ?? "unverified",
      });
    }
    return out;
  },
});

// @no-audit-required: user self-service application.
export const apply = mutation({
  args: {
    jobId: v.id("jobs"),
    coverNote: v.optional(v.string()),
    salaryExpectation: v.optional(
      v.object({
        min: v.number(),
        max: v.number(),
        currency: v.string(),
        period: v.string(),
      }),
    ),
    resumeStorageId: v.optional(v.id("_storage")),
    resumeFilename: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { jobId, coverNote, salaryExpectation, resumeStorageId, resumeFilename },
  ) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "published") {
      throw new ConvexError({
        code: "not-available",
        message: "This job is not accepting applications",
      });
    }
    const existing = await ctx.db
      .query("applications")
      .withIndex("by_applicant_time", (q) => q.eq("applicantId", userId))
      .collect();
    if (existing.some((a) => a.jobId === jobId)) {
      throw new ConvexError({
        code: "already-applied",
        message: "You've already applied to this job",
      });
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) {
      throw new ConvexError({
        code: "profile-missing",
        message: "Create your profile before applying",
      });
    }
    // Snapshot the profile at apply-time via the connection-tier privacy lens
    // (employer is granted connection-tier access for their applicant pool).
    const snapshot = applyPrivacy(profile, {
      kind: "connection",
      userId,
    });

    // Validate salary expectation if provided.
    if (salaryExpectation) {
      if (
        !Number.isFinite(salaryExpectation.min) ||
        !Number.isFinite(salaryExpectation.max) ||
        salaryExpectation.min < 0 ||
        salaryExpectation.max < salaryExpectation.min
      ) {
        throw new ConvexError({
          code: "invalid-salary",
          message: "Salary range must be non-negative and max ≥ min",
        });
      }
      if (
        salaryExpectation.period !== "monthly" &&
        salaryExpectation.period !== "annual"
      ) {
        throw new ConvexError({
          code: "invalid-salary-period",
          message: "Period must be 'monthly' or 'annual'",
        });
      }
    }

    // Resume sanity: filename ≤ 200 chars when supplied.
    if (resumeFilename && resumeFilename.length > 200) {
      throw new ConvexError({
        code: "filename-too-long",
        message: "Resume filename is too long",
      });
    }

    const now = Date.now();
    const id = await ctx.db.insert("applications", {
      jobId,
      applicantId: userId,
      coverNote: coverNote?.trim() || undefined,
      profileSnapshot: snapshot,
      stage: "new",
      salaryExpectation,
      resumeStorageId,
      resumeFilename: resumeFilename?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Attribution: if this job was referred to me, mark the referral as applied
    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .filter((q) => q.eq(q.field("refereeId"), userId))
      .unique();
    if (referral && !referral.appliedAt) {
      await ctx.db.patch(referral._id, { appliedAt: now });
      await ctx.db.patch(id, { referredBy: referral.referrerId });
    }
    return { applicationId: id };
  },
});

export const pipeline = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    // Only the posting employer (createdBy) or moderators can view the pipeline.
    const isOwner = job.createdBy === userId;
    const user = await ctx.db.get(userId);
    const isModerator =
      user?.roles?.includes("moderator") || user?.roles?.includes("super-admin");
    if (!isOwner && !isModerator) return null;

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_job_stage", (q) => q.eq("jobId", jobId))
      .collect();
    return {
      job,
      applications: await Promise.all(
        applications.map(async (a) => ({
          _id: a._id,
          applicantId: a.applicantId,
          coverNote: a.coverNote,
          profileSnapshot: a.profileSnapshot,
          stage: a.stage,
          referredBy: a.referredBy,
          salaryExpectation: a.salaryExpectation,
          resumeFilename: a.resumeFilename,
          resumeUrl: a.resumeStorageId
            ? await ctx.storage.getUrl(a.resumeStorageId)
            : null,
          createdAt: a.createdAt,
        })),
      ),
    };
  },
});

/**
 * Short-lived upload URL for the applicant's resume / CV. Convex storage
 * issues the URL; the client POSTs the file directly to it and gets back a
 * storage ID, which is then passed into `apply` along with the filename.
 */
// @no-audit-required: helper for the apply flow; ephemeral upload token only.
export const generateResumeUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// @no-audit-required: employer self-service pipeline advancement. Moderator overrides should use admin.ts.
export const moveApplication = mutation({
  args: {
    applicationId: v.id("applications"),
    stage: v.string(),
  },
  handler: async (ctx, { applicationId, stage }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (!STAGES.includes(stage as (typeof STAGES)[number])) {
      throw new ConvexError({
        code: "invalid-stage",
        message: `Stage must be one of: ${STAGES.join(", ")}`,
      });
    }
    const app = await ctx.db.get(applicationId);
    if (!app) {
      throw new ConvexError({
        code: "not-found",
        message: "Application not found",
      });
    }
    const job = await ctx.db.get(app.jobId);
    if (!job || job.createdBy !== userId) {
      throw new ConvexError({
        code: "forbidden",
        message: "Only the posting employer can move this application",
      });
    }
    await ctx.db.patch(applicationId, {
      stage,
      updatedAt: Date.now(),
    });

    // Referral attribution: mark hired
    if (stage === "hired" && app.referredBy) {
      const referral = await ctx.db
        .query("referrals")
        .withIndex("by_job", (q) => q.eq("jobId", app.jobId))
        .filter((q) =>
          q.and(
            q.eq(q.field("referrerId"), app.referredBy!),
            q.eq(q.field("refereeId"), app.applicantId),
          ),
        )
        .unique();
      if (referral && !referral.hiredAt) {
        await ctx.db.patch(referral._id, { hiredAt: Date.now() });
      }
    }
    return { ok: true };
  },
});

/**
 * Public, unauthenticated featured-jobs slice for the marketing landing.
 * Returns up to 3 most-recently-published jobs joined with employer name/slug.
 */
export const publicFeatured = query({
  args: {},
  handler: async (ctx) => {
    const recent = await ctx.db
      .query("jobs")
      .withIndex("by_published")
      .order("desc")
      .take(50);
    const published = recent
      .filter((j) => j.status === "published")
      .slice(0, 3);
    const out: Array<{
      _id: Id<"jobs">;
      title: string;
      employerName: string;
      employerSlug: string;
      location: string;
      salaryMin?: number;
      salaryMax?: number;
      salaryCurrency?: string;
    }> = [];
    for (const j of published) {
      const org = await ctx.db.get(j.employerOrgId);
      out.push({
        _id: j._id,
        title: j.title,
        employerName: org?.name ?? "—",
        employerSlug: org?.slug ?? "",
        location: j.location,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        salaryCurrency: j.salaryCurrency,
      });
    }
    return out;
  },
});

// helpers consumed by privacy lint — declare empty usages
void (null as unknown as Id<"jobs">);
void (null as unknown as QueryCtx);
