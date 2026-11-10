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
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";
import { applyPrivacy } from "./helpers/privacy";
import { maybeInsertNotification } from "./notifications";

const STAGES = [
  "new",
  "screening",
  "interview",
  "offered",
  "hired",
  "not-selected",
] as const;

/**
 * How well a job fits an alumna, 0-100, with the reasons shown on the card.
 *
 * Employer targeting used to be a hard filter: one non-matching field hid the
 * job completely, so the board showed a fraction of what was open. Targeting
 * now *ranks* instead — every published role is listed, best fit first, and
 * each card explains why it does or doesn't fit.
 *
 * Weights: program 35, skills 35, batch 15, city 15. A facet the employer left
 * open scores neutral (0.5) rather than counting for or against.
 */
export type JobMatch = {
  score: number;
  strong: boolean;
  reasons: string[];
  gaps: string[];
};

const STRONG_MATCH = 60;

export function scoreJob(
  job: Doc<"jobs">,
  profile: Doc<"profiles"> | null,
): JobMatch {
  if (!profile) return { score: 0, strong: false, reasons: [], gaps: [] };
  const reasons: string[] = [];
  const gaps: string[] = [];

  const programs = job.targetingPrograms ?? [];
  let programFit = 0.5;
  if (programs.length) {
    if (programs.includes(profile.program)) {
      programFit = 1;
      reasons.push("Open to your program");
    } else {
      programFit = 0;
      gaps.push(`Aimed at ${programs.slice(0, 2).join(", ")}${programs.length > 2 ? "…" : ""}`);
    }
  }

  const batches = job.targetingBatches ?? [];
  let batchFit = 0.5;
  if (batches.length) {
    if (batches.includes(profile.batch)) {
      batchFit = 1;
      reasons.push("Your batch");
    } else {
      batchFit = 0;
      gaps.push(`Aimed at batch ${batches.slice(0, 3).join(", ")}`);
    }
  }

  const wanted = [...new Set([...(job.targetingSkills ?? []), ...(job.skills ?? [])])];
  let skillFit = 0.5;
  if (wanted.length) {
    const have = new Set((profile.skills ?? []).map((sk) => sk.toLowerCase()));
    const hits = wanted.filter((sk) => have.has(sk.toLowerCase()));
    skillFit = hits.length / wanted.length;
    if (hits.length > 0) {
      reasons.push(`${hits.length} of ${wanted.length} skills match`);
    } else {
      gaps.push(`Wants ${wanted.slice(0, 2).join(", ")}${wanted.length > 2 ? "…" : ""}`);
    }
  }

  let cityFit = 0.5;
  if (job.targetingCity) {
    if ((profile.city ?? "") === job.targetingCity) {
      cityFit = 1;
      reasons.push("In your city");
    } else {
      cityFit = 0;
      gaps.push(`Based in ${job.targetingCity}`);
    }
  }

  const score = Math.round(
    (programFit * 35 + skillFit * 35 + batchFit * 15 + cityFit * 15),
  );
  return { score, strong: score >= STRONG_MATCH, reasons, gaps };
}

/** Trim, drop empties, cap each entry to 300 chars and the list to 30 items. */
function cleanBullets(list: string[] | undefined): string[] | undefined {
  if (!list) return undefined;
  const cleaned = list
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(0, 300))
    .slice(0, 30);
  return cleaned.length ? cleaned : undefined;
}

const JOB_SKILLS_MAX = 15;
const JOB_SKILL_NAME_MAX = 60;

/**
 * Validate + normalise a job's required skills. Trims (collapsing inner
 * whitespace), drops empties, dedupes case-insensitively, enforces ≤ 15 skills
 * and ≤ 60 chars each. Free-text skills are allowed (the admin-managed
 * referenceItems "skill" list is suggestions), but when a skill matches a
 * canonical list item case-insensitively the canonical casing is stored.
 */
async function cleanJobSkills(
  ctx: MutationCtx,
  raw: string[] | undefined,
): Promise<string[] | undefined> {
  if (!raw) return undefined;
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of raw) {
    const value = s.trim().replace(/\s+/g, " ");
    if (!value) continue;
    if (value.length > JOB_SKILL_NAME_MAX) {
      throw new ConvexError({
        code: "validation",
        message: `Each skill must be ${JOB_SKILL_NAME_MAX} characters or fewer`,
      });
    }
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  if (unique.length > JOB_SKILLS_MAX) {
    throw new ConvexError({
      code: "validation",
      message: `Add at most ${JOB_SKILLS_MAX} skills`,
    });
  }
  if (unique.length === 0) return undefined;

  const canonical = new Map<string, string>();
  const rows = await ctx.db
    .query("referenceItems")
    .withIndex("by_kind_sort", (q) => q.eq("kind", "skill"))
    .collect();
  for (const r of rows) {
    if (r.archivedAt == null) canonical.set(r.name.toLowerCase(), r.name);
  }
  return unique.map((s) => canonical.get(s.toLowerCase()) ?? s);
}

// @no-audit-required: user (employer-admin) self-service post creation; admin moderation IS audited.
export const createJob = mutation({
  args: {
    employerOrgId: v.id("employerOrgs"),
    title: v.string(),
    description: v.string(),
    responsibilities: v.optional(v.array(v.string())),
    requirements: v.optional(v.array(v.string())),
    benefits: v.optional(v.array(v.string())),
    location: v.string(),
    workMode: v.optional(v.string()),
    employmentType: v.string(),
    experienceLevel: v.optional(v.string()),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    salaryCurrency: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
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

    const skills = await cleanJobSkills(ctx, args.skills);

    const now = Date.now();
    const id = await ctx.db.insert("jobs", {
      employerOrgId: args.employerOrgId,
      title: args.title.trim(),
      description: args.description.trim(),
      responsibilities: cleanBullets(args.responsibilities),
      requirements: cleanBullets(args.requirements),
      benefits: cleanBullets(args.benefits),
      location: args.location.trim(),
      workMode: args.workMode?.trim() || undefined,
      employmentType: args.employmentType,
      experienceLevel: args.experienceLevel?.trim() || undefined,
      salaryMin: args.salaryMin,
      salaryMax: args.salaryMax,
      salaryCurrency: args.salaryCurrency ?? "PHP",
      skills,
      targetingBatches: args.targetingBatches?.length
        ? args.targetingBatches
        : undefined,
      targetingPrograms: cleanBullets(args.targetingPrograms),
      targetingSkills: cleanBullets(args.targetingSkills),
      targetingCity: args.targetingCity?.trim() || undefined,
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
  args: {
    /** Kept for older callers; the board now lists every published role. */
    showUnmatched: v.optional(v.boolean()),
    /** Only roles that fit this alumna well (score ≥ 60). */
    onlyStrong: v.optional(v.boolean()),
  },
  handler: async (ctx, { onlyStrong }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    // @no-privacy-required: self-read: the viewer's own profile, used to score job matches.
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    // Filter by status IN the index, not after a capped take — otherwise
    // drafts and closed posts eat the window and published roles disappear.
    const published = await ctx.db
      .query("jobs")
      .withIndex("by_status_time", (q) => q.eq("status", "published"))
      .order("desc")
      .collect();

    // Which of these the viewer has already applied to — the board marks them
    // and the nav badge counts only the rest.
    const myApps = await ctx.db
      .query("applications")
      .withIndex("by_applicant_time", (q) => q.eq("applicantId", userId))
      .collect();
    const appliedTo = new Set(myApps.map((a) => a.jobId as string));

    const out = [];
    for (const j of published) {
      const org = await ctx.db.get(j.employerOrgId);
      if (org?.suspendedAt) continue; // deactivated / rejected employer
      const match = scoreJob(j, profile);
      if (onlyStrong && !match.strong) continue;
      out.push({
        ...j,
        employerName: org?.name ?? "—",
        employerTier: org?.tier ?? "unverified",
        applied: appliedTo.has(j._id as string),
        matchScore: match.score,
        strongMatch: match.strong,
        matchReasons: match.reasons,
        matchGaps: match.gaps,
      });
    }
    // Best fit first, then newest.
    out.sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt),
    );
    return out;
  },
});

/**
 * Lightweight count of jobs available (matched) to the signed-in alumna, for
 * the Jobs nav badge: strong matches (score >= 60) not yet applied to.
 * No employer joins — just the number.
 */
export const myAvailableCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    // @no-privacy-required: self-read: the authenticated user's own row.
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_status_time", (q) => q.eq("status", "published"))
      .order("desc")
      .collect();
    // Same set the Jobs page lists by default, minus the ones already applied
    // to — the badge means "roles still open to you".
    const myApps = await ctx.db
      .query("applications")
      .withIndex("by_applicant_time", (q) => q.eq("applicantId", userId))
      .collect();
    const appliedTo = new Set(myApps.map((a) => a.jobId as string));
    let count = 0;
    for (const j of jobs) {
      if (j.status !== "published") continue;
      if (appliedTo.has(j._id as string)) continue;
      if (!scoreJob(j, profile).strong) continue;
      const org = await ctx.db.get(j.employerOrgId);
      if (org?.suspendedAt) continue; // deactivated / rejected employer
      count += 1;
    }
    return count;
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

/**
 * Resolve the employer orgs the signed-in user may manage:
 *   - super-admin / moderator → all orgs
 *   - partner/verified employer-admin → orgs where they're on adminUserIds
 *   - everyone else → []
 */
async function resolveMyOrgs(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) return [];
  const roles = new Set(user.roles ?? []);
  const isAdmin = roles.has("super-admin") || roles.has("moderator");
  const isEmployer =
    roles.has("partner-employer-admin") ||
    roles.has("verified-employer-admin");
  if (!isAdmin && !isEmployer) return [];
  // @full-scan-ok: employerOrgs membership is tested against the adminUserIds array, and Convex cannot index an array's elements
  const orgs = await ctx.db.query("employerOrgs").collect();
  return isAdmin
    ? orgs
    : orgs.filter((o) => (o.adminUserIds ?? []).includes(userId));
}

/**
 * Employer-facing: every job across the orgs the viewer manages, any status,
 * with live applicant + hire counts. Powers the employer Jobs list + dashboard.
 */
export const listMyOrgJobs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const orgs = await resolveMyOrgs(ctx, userId);
    const out = [];
    for (const org of orgs) {
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_employer_time", (q) => q.eq("employerOrgId", org._id))
        .order("desc")
        .collect();
      for (const j of jobs) {
        const apps = await ctx.db
          .query("applications")
          .withIndex("by_job_stage", (q) => q.eq("jobId", j._id))
          .collect();
        out.push({
          _id: j._id,
          title: j.title,
          location: j.location,
          employmentType: j.employmentType,
          status: j.status,
          statusReason: j.statusReason,
          salaryMin: j.salaryMin,
          salaryMax: j.salaryMax,
          salaryCurrency: j.salaryCurrency,
          skills: j.skills,
          targetingPrograms: j.targetingPrograms,
          targetingSkills: j.targetingSkills,
          createdAt: j.createdAt,
          publishedAt: j.publishedAt,
          employerOrgId: org._id,
          employerName: org.name,
          applicantCount: apps.length,
          hiredCount: apps.filter((a) => a.stage === "hired").length,
        });
      }
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  },
});

/**
 * Employer-facing: all applications across the viewer's org jobs, joined with
 * the job title and the apply-time privacy-filtered profile snapshot.
 */
export const myApplicants = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const orgs = await resolveMyOrgs(ctx, userId);
    const out = [];
    for (const org of orgs) {
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_employer_time", (q) => q.eq("employerOrgId", org._id))
        .collect();
      for (const j of jobs) {
        const apps = await ctx.db
          .query("applications")
          .withIndex("by_job_stage", (q) => q.eq("jobId", j._id))
          .collect();
        for (const a of apps) {
          out.push({
            _id: a._id,
            applicantId: a.applicantId,
            jobId: j._id,
            jobTitle: j.title,
            employerName: org.name,
            stage: a.stage,
            coverNote: a.coverNote,
            salaryExpectation: a.salaryExpectation,
            resumeFilename: a.resumeFilename,
            snapshot: a.profileSnapshot,
            reviewedAt: a.reviewedAt,
            interview: a.interview ?? null,
            createdAt: a.createdAt,
          });
        }
      }
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  },
});

/**
 * Alumna-facing: my own job applications, joined with job title + employer name,
 * showing the current pipeline stage and whether the employer has reviewed my
 * CV. Powers the "My job applications" tracker.
 */
export const myApplications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_applicant_time", (q) => q.eq("applicantId", userId))
      .order("desc")
      .collect();
    const out = [];
    for (const a of apps) {
      const job = await ctx.db.get(a.jobId);
      if (!job) continue;
      const org = await ctx.db.get(job.employerOrgId);
      out.push({
        _id: a._id,
        jobId: a.jobId,
        jobTitle: job.title,
        jobLocation: job.location,
        jobStatus: job.status,
        employerName: org?.name ?? "—",
        stage: a.stage,
        reviewedAt: a.reviewedAt ?? null,
        interview: a.interview ?? null,
        resumeFilename: a.resumeFilename,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      });
    }
    return out;
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
          reviewedAt: a.reviewedAt,
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
    const now = Date.now();
    await ctx.db.patch(applicationId, {
      stage,
      updatedAt: now,
      stageChangedAt: stage !== app.stage ? now : app.stageChangedAt,
      // Keep the first hire time; clear it if the hire is undone.
      hiredAt: stage === "hired" ? (app.hiredAt ?? now) : undefined,
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
 * Employer-triggered "CV reviewed" marker. Explicit action — the employer marks
 * an applicant's CV as reviewed (or clears it). Kept separate from `stage` so
 * analytics count actual reviews, not stage side-effects. Owner-only.
 */
// @no-audit-required: employer self-service review marker. Non-destructive, no PII change.
export const setReviewed = mutation({
  args: {
    applicationId: v.id("applications"),
    reviewed: v.boolean(),
  },
  handler: async (ctx, { applicationId, reviewed }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
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
        message: "Only the posting employer can review this application",
      });
    }
    await ctx.db.patch(applicationId, {
      reviewedAt: reviewed ? Date.now() : undefined,
      reviewedBy: reviewed ? userId : undefined,
      updatedAt: Date.now(),
    });
    return { ok: true, reviewed };
  },
});

/**
 * Public, unauthenticated featured-jobs slice for the marketing landing.
 * Returns up to 3 most-recently-published jobs joined with employer name/slug.
 */
export const publicFeatured = query({
  args: {},
  handler: async (ctx) => {
    const live = await ctx.db
      .query("jobs")
      .withIndex("by_status_time", (q) => q.eq("status", "published"))
      .collect();
    // by_status_time orders by createdAt; the teaser wants newest *published*.
    const published = live
      .sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt))
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

/**
 * Public, unauthenticated list of every open role — powers /careers, the page
 * the landing CTA links to.
 *
 * "Browse all openings" used to point at /jobs, which is inside the alumni
 * shell and calls `browse` (auth-only, returns [] with no session). A signed-out
 * visitor therefore landed on a board reading "0 jobs — No jobs published yet"
 * while 14 roles were live. Browsing is public; applying still needs a verified
 * account, which is the conversion the pitch page is aiming for.
 *
 * Deliberately excludes match data (there is no viewer to score against) and
 * postings from suspended employers.
 */
export const publicOpenings = query({
  args: {},
  handler: async (ctx) => {
    const published = await ctx.db
      .query("jobs")
      .withIndex("by_status_time", (q) => q.eq("status", "published"))
      .collect();
    published.sort(
      (a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt),
    );

    const orgs = new Map<string, Doc<"employerOrgs">>();
    const out = [];
    for (const j of published) {
      const key = j.employerOrgId as string;
      if (!orgs.has(key)) {
        const org = await ctx.db.get(j.employerOrgId);
        if (org) orgs.set(key, org);
      }
      const org = orgs.get(key);
      if (!org || org.suspendedAt) continue;
      out.push({
        _id: j._id as string,
        title: j.title,
        employerName: org.name,
        employerSlug: org.slug,
        employerTier: org.tier,
        location: j.location,
        workMode: j.workMode ?? null,
        employmentType: j.employmentType,
        experienceLevel: j.experienceLevel ?? null,
        salaryMin: j.salaryMin ?? null,
        salaryMax: j.salaryMax ?? null,
        salaryCurrency: j.salaryCurrency ?? null,
        skills: j.skills ?? [],
        publishedAt: j.publishedAt ?? j.createdAt,
      });
    }
    return out;
  },
});


/** Interview delivery modes. Kept in step with INTERVIEW_MODE_LABEL in the UI. */
export const INTERVIEW_MODES = ["onsite", "online", "phone"] as const;

/**
 * Schedule (or reschedule) a screening appointment for an applicant.
 *
 * The pipeline already had an "interview" stage, but nothing behind it: no
 * date, no place, and nothing the applicant could see. Employers were either
 * arranging screenings off-platform or not at all, and "Set appointment for
 * screening" was the one employer capability the role matrix asked for that
 * did not exist.
 *
 * Scheduling moves the application to the interview stage, because an
 * appointment that leaves someone sitting in "new" misrepresents the pipeline
 * to both sides. Rescheduling clears any previous response: a confirmation of
 * a time that no longer exists is worse than no confirmation.
 */
export const scheduleInterview = mutation({
  args: {
    applicationId: v.id("applications"),
    startsAt: v.number(),
    durationMinutes: v.optional(v.number()),
    mode: v.string(),
    location: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { applicationId, startsAt, durationMinutes, mode, location, note },
  ) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({ code: "unauthenticated", message: "Sign in required" });
    }
    if (!INTERVIEW_MODES.includes(mode as (typeof INTERVIEW_MODES)[number])) {
      throw new ConvexError({
        code: "invalid-mode",
        message: `Mode must be one of: ${INTERVIEW_MODES.join(", ")}`,
      });
    }
    if (!Number.isFinite(startsAt) || startsAt <= Date.now()) {
      throw new ConvexError({
        code: "invalid-time",
        message: "Pick a date and time in the future",
      });
    }

    const app = await ctx.db.get(applicationId);
    if (!app) {
      throw new ConvexError({ code: "not-found", message: "Application not found" });
    }
    const job = await ctx.db.get(app.jobId);
    if (!job || job.createdBy !== userId) {
      throw new ConvexError({
        code: "forbidden",
        message: "Only the posting employer can schedule this interview",
      });
    }

    const now = Date.now();
    await ctx.db.patch(applicationId, {
      interview: {
        startsAt,
        durationMinutes: durationMinutes ?? 45,
        mode,
        location: location?.trim() || undefined,
        note: note?.trim() || undefined,
        scheduledBy: userId,
        scheduledAt: now,
      },
      stage: "interview",
      stageChangedAt: app.stage !== "interview" ? now : app.stageChangedAt,
      updatedAt: now,
    });

    const org = job.employerOrgId ? await ctx.db.get(job.employerOrgId) : null;
    const when = new Date(startsAt).toUTCString();
    await maybeInsertNotification(ctx, app.applicantId, "interviewInApp", {
      kind: "interview-scheduled",
      title: `Interview scheduled — ${job.title}`,
      body: `${org?.name ?? "The employer"} proposed ${when}. Confirm whether you can make it.`,
      href: "/applications",
    });

    return { ok: true };
  },
});

/** Employer cancels a scheduled interview. The slot is kept for the record. */
export const cancelInterview = mutation({
  args: { applicationId: v.id("applications"), reason: v.optional(v.string()) },
  handler: async (ctx, { applicationId, reason }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({ code: "unauthenticated", message: "Sign in required" });
    }
    const app = await ctx.db.get(applicationId);
    if (!app?.interview) {
      throw new ConvexError({ code: "not-found", message: "No interview scheduled" });
    }
    const job = await ctx.db.get(app.jobId);
    if (!job || job.createdBy !== userId) {
      throw new ConvexError({
        code: "forbidden",
        message: "Only the posting employer can cancel this interview",
      });
    }

    const now = Date.now();
    await ctx.db.patch(applicationId, {
      interview: { ...app.interview, cancelledAt: now },
      updatedAt: now,
    });

    await maybeInsertNotification(ctx, app.applicantId, "interviewInApp", {
      kind: "interview-cancelled",
      title: `Interview cancelled — ${job.title}`,
      body: reason?.trim() || "The employer cancelled this interview.",
      href: "/applications",
    });

    return { ok: true };
  },
});

/**
 * The applicant's side: confirm or decline a proposed time.
 *
 * Only the applicant may call this. A declined interview deliberately does
 * NOT move the stage backwards — declining a time is not withdrawing from the
 * process, and an employer who re-proposes should find the candidate where
 * they left them.
 */
export const respondToInterview = mutation({
  args: {
    applicationId: v.id("applications"),
    response: v.string(), // "accepted" | "declined"
    note: v.optional(v.string()),
  },
  handler: async (ctx, { applicationId, response, note }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({ code: "unauthenticated", message: "Sign in required" });
    }
    if (response !== "accepted" && response !== "declined") {
      throw new ConvexError({
        code: "invalid-response",
        message: 'Response must be "accepted" or "declined"',
      });
    }
    const app = await ctx.db.get(applicationId);
    if (!app?.interview) {
      throw new ConvexError({ code: "not-found", message: "No interview to respond to" });
    }
    if (app.applicantId !== userId) {
      throw new ConvexError({
        code: "forbidden",
        message: "Only the applicant can respond to this interview",
      });
    }
    if (app.interview.cancelledAt) {
      throw new ConvexError({
        code: "cancelled",
        message: "This interview was cancelled",
      });
    }

    const now = Date.now();
    await ctx.db.patch(applicationId, {
      interview: {
        ...app.interview,
        response,
        responseNote: note?.trim() || undefined,
        respondedAt: now,
      },
      updatedAt: now,
    });

    const job = await ctx.db.get(app.jobId);
    // @no-privacy-required: self-read: the responder's own displayName, for the employer's notification.
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (job) {
      await maybeInsertNotification(ctx, job.createdBy, "interviewInApp", {
        kind: "interview-response",
        title: `${profile?.displayName ?? "An applicant"} ${response} the interview`,
        body: `${job.title}${note?.trim() ? ` — "${note.trim()}"` : ""}`,
        href: "/employer/applicants",
      });
    }

    return { ok: true };
  },
});
