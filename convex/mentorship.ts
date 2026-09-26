/**
 * Mentorship + referrals (Epic 14).
 *
 * - Verified alumni request 30-min mentorship from someone "open to mentorship".
 * - Mentor accepts/counter-proposes/completes.
 * - Referrals: alumna refers a connection to a specific job; attribution
 *   flows into the applications + referrals tables.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { applyPrivacy, getViewerContext } from "./helpers/privacy";
import { loadCollegeClassifier } from "./helpers/taxonomy";

// @no-audit-required: user self-service.
export const requestMentorship = mutation({
  args: {
    mentorId: v.id("users"),
    topic: v.string(),
    proposedTimes: v.array(v.string()),
  },
  handler: async (ctx, { mentorId, topic, proposedTimes }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (me === mentorId) {
      throw new ConvexError({
        code: "self-mentor",
        message: "Cannot request mentorship from yourself",
      });
    }
    if (!topic.trim()) {
      throw new ConvexError({
        code: "empty",
        message: "Topic is required",
      });
    }
    if (proposedTimes.length === 0) {
      throw new ConvexError({
        code: "no-times",
        message: "Propose at least one time window",
      });
    }
    // Verify the mentor is "open to mentorship"
    const mentorProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", mentorId))
      .unique();
    if (!isOpenToMentorship(mentorProfile?.openTo)) {
      throw new ConvexError({
        code: "not-open",
        message: "This alumna isn't open to mentorship right now",
      });
    }
    const id = await ctx.db.insert("mentorshipRequests", {
      requesterId: me,
      mentorId,
      topic: topic.trim(),
      proposedTimes,
      status: "requested",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { requestId: id };
  },
});

// @no-audit-required: mentor self-service on their own queue.
export const respondToRequest = mutation({
  args: {
    requestId: v.id("mentorshipRequests"),
    action: v.union(
      v.literal("accept"),
      v.literal("decline"),
      v.literal("counter"),
    ),
    scheduledFor: v.optional(v.number()),
    counterTimes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { requestId, action, scheduledFor, counterTimes }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const req = await ctx.db.get(requestId);
    if (!req) {
      throw new ConvexError({
        code: "not-found",
        message: "Request not found",
      });
    }
    if (req.mentorId !== me) {
      throw new ConvexError({
        code: "forbidden",
        message: "Only the mentor can respond",
      });
    }
    const now = Date.now();
    if (action === "accept") {
      if (!scheduledFor) {
        throw new ConvexError({
          code: "no-time",
          message: "Pick one of the proposed times",
        });
      }
      await ctx.db.patch(requestId, {
        status: "scheduled",
        scheduledFor,
        updatedAt: now,
      });
    } else if (action === "decline") {
      await ctx.db.patch(requestId, { status: "declined", updatedAt: now });
    } else if (action === "counter") {
      if (!counterTimes || counterTimes.length === 0) {
        throw new ConvexError({
          code: "no-times",
          message: "Propose at least one time",
        });
      }
      await ctx.db.patch(requestId, {
        proposedTimes: counterTimes,
        updatedAt: now,
      });
    }
    return { ok: true };
  },
});

// @no-audit-required: either party can mark completed.
export const markCompleted = mutation({
  args: {
    requestId: v.id("mentorshipRequests"),
    feedback: v.optional(v.string()),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, { requestId, feedback, rating }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const req = await ctx.db.get(requestId);
    if (!req) return { ok: true };
    if (req.requesterId !== me && req.mentorId !== me) {
      throw new ConvexError({
        code: "forbidden",
        message: "Only the participants can mark completed",
      });
    }
    await ctx.db.patch(requestId, {
      status: "completed",
      completedAt: Date.now(),
      feedback,
      rating,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const myMentorshipQueue = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const incoming = await ctx.db
      .query("mentorshipRequests")
      .withIndex("by_mentor_status", (q) => q.eq("mentorId", me))
      .order("desc")
      .take(50);
    const outgoing = await ctx.db
      .query("mentorshipRequests")
      .withIndex("by_requester_status", (q) => q.eq("requesterId", me))
      .order("desc")
      .take(50);
    return { incoming, outgoing };
  },
});

/**
 * Referrals — alumna refers a connection to a specific job.
 */
// @no-audit-required: user self-service referral.
export const referToJob = mutation({
  args: {
    refereeId: v.id("users"),
    jobId: v.id("jobs"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { refereeId, jobId, note }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (me === refereeId) {
      throw new ConvexError({
        code: "self-referral",
        message: "Cannot refer yourself",
      });
    }
    // Connected check
    const [a, b] = me < refereeId ? [me, refereeId] : [refereeId, me];
    const conn = await ctx.db
      .query("connections")
      .withIndex("by_pair", (q) => q.eq("userA", a).eq("userB", b))
      .unique();
    if (!conn || conn.status !== "connected") {
      throw new ConvexError({
        code: "not-connected",
        message: "You can only refer alumni you're connected to",
      });
    }
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "published") {
      throw new ConvexError({
        code: "job-unavailable",
        message: "Job is not currently published",
      });
    }
    const id = await ctx.db.insert("referrals", {
      referrerId: me,
      refereeId,
      jobId,
      note: note?.trim() || undefined,
      createdAt: Date.now(),
    });
    return { referralId: id };
  },
});

export const myReferrals = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];
    return await ctx.db
      .query("referrals")
      .withIndex("by_referrer_time", (q) => q.eq("referrerId", me))
      .order("desc")
      .take(50);
  },
});

// ---------------------------------------------------------- find a mentor ---

/**
 * `openTo` values are inconsistent across data written at different times
 * ("mentorship" from the profile editor, "Mentorship" from the seeds), so
 * every mentor check matches case-insensitively on the stem.
 */
export function isOpenToMentorship(openTo: string[] | undefined): boolean {
  return (openTo ?? []).some((t) => t.toLowerCase().includes("mentor"));
}

export type MentorCard = {
  userId: string;
  slug: string;
  displayName: string;
  initials: string;
  program: string | null;
  college: string;
  batch: number | null;
  currentRole: string | null;
  company: string | null;
  city: string | null;
  bio: string | null;
  skills: string[];
  openTo: string[];
  /** My latest request to this mentor, if any — drives the button state. */
  myRequestStatus: string | null;
};

/**
 * Alumni-facing mentor directory: verified alumni who are open to mentorship.
 *
 * Privacy-filtered per viewer like the directory; deactivated / suspended
 * accounts are excluded, as is the viewer themselves.
 */
export const availableMentors = query({
  args: {
    search: v.optional(v.string()),
    programs: v.optional(v.array(v.string())),
    batches: v.optional(v.array(v.number())),
    cities: v.optional(v.array(v.string())),
    skills: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<MentorCard[]> => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];

    const [profiles, users, collegeFor, myRequests] = await Promise.all([
      ctx.db.query("profiles").collect(),
      ctx.db.query("users").collect(),
      loadCollegeClassifier(ctx),
      ctx.db
        .query("mentorshipRequests")
        .withIndex("by_requester_status", (q) => q.eq("requesterId", me))
        .collect(),
    ]);
    const blocked = new Set(
      users.filter((u) => u.suspendedAt || u.deletedAt).map((u) => u._id as string),
    );
    // Latest request per mentor wins.
    const statusByMentor = new Map<string, string>();
    for (const r of [...myRequests].sort((a, b) => a.createdAt - b.createdAt)) {
      statusByMentor.set(r.mentorId as string, r.status);
    }

    const search = (args.search ?? "").trim().toLowerCase();
    const skills = (args.skills ?? []).map((s) => s.toLowerCase());
    const out: MentorCard[] = [];

    for (const p of profiles) {
      if (p.verifiedAt == null) continue;
      if (p.userId === me) continue;
      if (blocked.has(p.userId as string)) continue;
      if (!isOpenToMentorship(p.openTo)) continue;
      if (args.programs?.length && !args.programs.includes(p.program)) continue;
      if (args.batches?.length && !args.batches.includes(p.batch)) continue;
      if (args.cities?.length && !(p.city && args.cities.includes(p.city))) continue;
      if (skills.length) {
        const have = new Set((p.skills ?? []).map((s) => s.toLowerCase()));
        if (!skills.some((s) => have.has(s))) continue;
      }
      if (search) {
        const hay = [p.displayName, p.currentRole, p.company, p.bio, p.program, ...(p.skills ?? [])]
          .filter((x): x is string => typeof x === "string")
          .join(" ")
          .toLowerCase();
        if (!hay.includes(search)) continue;
      }

      const viewer = await getViewerContext(ctx, p.userId);
      const safe = applyPrivacy(p, viewer);
      out.push({
        userId: p.userId,
        slug: p.slug,
        displayName: p.displayName,
        initials: p.initials,
        program: safe.program ?? null,
        // College comes from the program, so only expose it when the program is.
        college: safe.program ? collegeFor(safe.program) : "",
        batch: safe.batch ?? null,
        currentRole: safe.currentRole ?? null,
        company: safe.company ?? null,
        city: safe.city ?? null,
        bio: safe.bio ?? null,
        skills: safe.skills ?? [],
        openTo: safe.openTo ?? [],
        myRequestStatus: statusByMentor.get(p.userId as string) ?? null,
      });
    }

    out.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return out.slice(0, Math.min(Math.max(args.limit ?? 60, 1), 200));
  },
});
