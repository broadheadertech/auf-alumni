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
    if (!mentorProfile?.openTo?.includes("mentorship")) {
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
