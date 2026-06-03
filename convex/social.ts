/**
 * LinkedIn-parity social primitives — follows, endorsements, recommendations.
 *
 * Distinct from Convex `connections` (two-way, requires accept). Follows are
 * one-way and frictionless. Endorsements are peer signals on profile skills.
 * Recommendations are long-form testimonials gated by subject approval.
 *
 * All mutations are user self-service; no `withAuditLog` needed.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

// ─────────────────────────────────────────────────────────────
// Follows (one-way)
// ─────────────────────────────────────────────────────────────

// @no-audit-required: user self-service follow.
export const follow = mutation({
  args: { followeeId: v.id("users") },
  handler: async (ctx, { followeeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (userId === followeeId) {
      throw new ConvexError({
        code: "self-follow",
        message: "You can't follow yourself",
      });
    }
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", userId).eq("followeeId", followeeId),
      )
      .unique();
    if (existing) return { ok: true, alreadyFollowing: true };
    await ctx.db.insert("follows", {
      followerId: userId,
      followeeId,
      createdAt: Date.now(),
    });
    return { ok: true, alreadyFollowing: false };
  },
});

// @no-audit-required: user self-service unfollow.
export const unfollow = mutation({
  args: { followeeId: v.id("users") },
  handler: async (ctx, { followeeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const row = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", userId).eq("followeeId", followeeId),
      )
      .unique();
    if (row) await ctx.db.delete(row._id);
    return { ok: true };
  },
});

export const followCounts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_followee", (q) => q.eq("followeeId", userId))
      .collect();
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", userId))
      .collect();
    const me = await getAuthUserId(ctx);
    let amFollowing = false;
    if (me && me !== userId) {
      const row = await ctx.db
        .query("follows")
        .withIndex("by_pair", (q) =>
          q.eq("followerId", me).eq("followeeId", userId),
        )
        .unique();
      amFollowing = !!row;
    }
    return {
      followers: followers.length,
      following: following.length,
      amFollowing,
    };
  },
});

export const listMyFollowing = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", userId))
      .collect();
    const out = [];
    for (const r of rows) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", r.followeeId))
        .unique();
      if (!profile) continue;
      out.push({
        userId: r.followeeId,
        slug: profile.slug,
        displayName: profile.displayName,
        program: profile.program,
        batch: profile.batch,
        followedAt: r.createdAt,
      });
    }
    return out;
  },
});

// ─────────────────────────────────────────────────────────────
// Endorsements
// ─────────────────────────────────────────────────────────────

// @no-audit-required: peer signal on a profile skill; user self-service.
export const endorse = mutation({
  args: {
    profileUserId: v.id("users"),
    skill: v.string(),
  },
  handler: async (ctx, { profileUserId, skill }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (userId === profileUserId) {
      throw new ConvexError({
        code: "self-endorsement",
        message: "You can't endorse yourself",
      });
    }
    const trimmed = skill.trim();
    if (!trimmed) {
      throw new ConvexError({
        code: "empty-skill",
        message: "Skill is required",
      });
    }
    // Verify the skill exists on the target profile.
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", profileUserId))
      .unique();
    if (!profile) {
      throw new ConvexError({
        code: "no-profile",
        message: "Profile not found",
      });
    }
    if (!profile.skills.includes(trimmed)) {
      throw new ConvexError({
        code: "unknown-skill",
        message: `'${trimmed}' is not listed on this profile`,
      });
    }
    // Dedup: one endorsement per (endorser, profile, skill).
    const existing = await ctx.db
      .query("endorsements")
      .withIndex("by_profile_skill", (q) =>
        q.eq("profileUserId", profileUserId).eq("skill", trimmed),
      )
      .filter((q) => q.eq(q.field("endorserId"), userId))
      .unique();
    if (existing) return { ok: true, alreadyEndorsed: true };
    await ctx.db.insert("endorsements", {
      profileUserId,
      endorserId: userId,
      skill: trimmed,
      createdAt: Date.now(),
    });
    return { ok: true, alreadyEndorsed: false };
  },
});

// @no-audit-required: user self-service withdraw.
export const removeEndorsement = mutation({
  args: {
    profileUserId: v.id("users"),
    skill: v.string(),
  },
  handler: async (ctx, { profileUserId, skill }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const row = await ctx.db
      .query("endorsements")
      .withIndex("by_profile_skill", (q) =>
        q.eq("profileUserId", profileUserId).eq("skill", skill),
      )
      .filter((q) => q.eq(q.field("endorserId"), userId))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return { ok: true };
  },
});

export const listEndorsements = query({
  args: { profileUserId: v.id("users") },
  handler: async (ctx, { profileUserId }) => {
    const rows = await ctx.db
      .query("endorsements")
      .filter((q) => q.eq(q.field("profileUserId"), profileUserId))
      .collect();
    const me = await getAuthUserId(ctx);
    // Aggregate by skill with count + 3 recent endorser names.
    const bySkill = new Map<
      string,
      {
        count: number;
        recent: Array<{ name: string; slug: string | null }>;
        iEndorsed: boolean;
      }
    >();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    for (const r of rows) {
      const bucket = bySkill.get(r.skill) ?? {
        count: 0,
        recent: [],
        iEndorsed: false,
      };
      bucket.count += 1;
      if (me && r.endorserId === me) bucket.iEndorsed = true;
      if (bucket.recent.length < 3) {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", r.endorserId))
          .unique();
        bucket.recent.push({
          name: profile?.displayName ?? "Alumna",
          slug: profile?.slug ?? null,
        });
      }
      bySkill.set(r.skill, bucket);
    }
    return Array.from(bySkill.entries()).map(([skill, info]) => ({
      skill,
      ...info,
    }));
  },
});

// ─────────────────────────────────────────────────────────────
// Recommendations
// ─────────────────────────────────────────────────────────────

const VALID_RELATIONSHIPS = [
  "manager",
  "report",
  "peer",
  "client",
  "classmate",
  "mentor",
] as const;

// @no-audit-required: peer-authored, subject must approve before public.
export const writeRecommendation = mutation({
  args: {
    subjectUserId: v.id("users"),
    relationship: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { subjectUserId, relationship, body }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (userId === subjectUserId) {
      throw new ConvexError({
        code: "self-rec",
        message: "You can't recommend yourself",
      });
    }
    if (
      !VALID_RELATIONSHIPS.includes(
        relationship as (typeof VALID_RELATIONSHIPS)[number],
      )
    ) {
      throw new ConvexError({
        code: "invalid-relationship",
        message: `Relationship must be: ${VALID_RELATIONSHIPS.join(", ")}`,
      });
    }
    const trimmed = body.trim();
    if (trimmed.length < 80 || trimmed.length > 3000) {
      throw new ConvexError({
        code: "invalid-body",
        message: "Recommendations must be 80–3000 characters",
      });
    }
    const id = await ctx.db.insert("recommendations", {
      subjectUserId,
      authorId: userId,
      relationship,
      body: trimmed,
      status: "pending",
      createdAt: Date.now(),
    });
    return { recommendationId: id };
  },
});

// @no-audit-required: subject approves their own recommendation.
export const decideRecommendation = mutation({
  args: {
    recommendationId: v.id("recommendations"),
    decision: v.union(v.literal("published"), v.literal("rejected")),
  },
  handler: async (ctx, { recommendationId, decision }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const row = await ctx.db.get(recommendationId);
    if (!row) {
      throw new ConvexError({
        code: "not-found",
        message: "Recommendation not found",
      });
    }
    if (row.subjectUserId !== userId) {
      throw new ConvexError({
        code: "forbidden",
        message: "Only the subject can approve this",
      });
    }
    await ctx.db.patch(recommendationId, {
      status: decision,
      decidedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const listPublishedRecommendations = query({
  args: { subjectUserId: v.id("users") },
  handler: async (ctx, { subjectUserId }) => {
    const rows = await ctx.db
      .query("recommendations")
      .withIndex("by_subject_status", (q) =>
        q.eq("subjectUserId", subjectUserId).eq("status", "published"),
      )
      .collect();
    rows.sort((a, b) => (b.decidedAt ?? 0) - (a.decidedAt ?? 0));
    const out = [];
    for (const r of rows) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", r.authorId))
        .unique();
      out.push({
        _id: r._id,
        authorName: profile?.displayName ?? "Alumna",
        authorSlug: profile?.slug ?? null,
        authorRole: profile?.currentRole ?? null,
        authorCompany: profile?.company ?? null,
        relationship: r.relationship,
        body: r.body,
        decidedAt: r.decidedAt ?? r.createdAt,
      });
    }
    return out;
  },
});

export const myPendingRecommendations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("recommendations")
      .withIndex("by_subject_status", (q) =>
        q.eq("subjectUserId", userId).eq("status", "pending"),
      )
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const out = [];
    for (const r of rows) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", r.authorId))
        .unique();
      out.push({
        _id: r._id,
        authorName: profile?.displayName ?? "Alumna",
        authorSlug: profile?.slug ?? null,
        relationship: r.relationship,
        body: r.body,
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});

// ─────────────────────────────────────────────────────────────
// Open-to-work / Open-to-hire banners (profile-level toggles)
// ─────────────────────────────────────────────────────────────

// @no-audit-required: user self-service.
export const setOpenToWork = mutation({
  args: {
    on: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { on, note }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) {
      throw new ConvexError({
        code: "no-profile",
        message: "Create your profile first",
      });
    }
    const trimmed = note?.trim();
    if (trimmed && trimmed.length > 280) {
      throw new ConvexError({
        code: "note-too-long",
        message: "Note must be ≤ 280 characters",
      });
    }
    await ctx.db.patch(profile._id, {
      openToWork: on,
      openToWorkNote: on ? trimmed || undefined : undefined,
      openToWorkUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

// @no-audit-required: user self-service (employer-admin sets on company).
export const setOpenToHire = mutation({
  args: {
    on: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { on, note }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) {
      throw new ConvexError({
        code: "no-profile",
        message: "Create your profile first",
      });
    }
    const trimmed = note?.trim();
    if (trimmed && trimmed.length > 280) {
      throw new ConvexError({
        code: "note-too-long",
        message: "Note must be ≤ 280 characters",
      });
    }
    await ctx.db.patch(profile._id, {
      openToHire: on,
      openToHireNote: on ? trimmed || undefined : undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

// ─────────────────────────────────────────────────────────────
// Global search palette source
// ─────────────────────────────────────────────────────────────

/**
 * Lightweight server-side keyword search across alumni + jobs + courses.
 * Returns at most ~24 mixed hits ordered by table priority. Designed for
 * the ⌘K palette in the alumni shell.
 *
 * Privacy: profile rows are filtered through their `excludeFromSearchEngines`
 * + verified gate, and we only return public-tier fields.
 */
// @no-privacy-required: returns slug + displayName only (public tier).
export const globalSearch = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) {
      return { alumni: [], jobs: [], courses: [] };
    }

    // Alumni (cap at 8)
    const profiles = await ctx.db.query("profiles").take(500);
    const alumni = profiles
      .filter(
        (p) =>
          p.verifiedAt != null &&
          !p.excludeFromSearchEngines &&
          (p.displayName.toLowerCase().includes(needle) ||
            (p.currentRole ?? "").toLowerCase().includes(needle) ||
            (p.company ?? "").toLowerCase().includes(needle) ||
            (p.program ?? "").toLowerCase().includes(needle)),
      )
      .slice(0, 8)
      .map((p) => ({
        kind: "alumni" as const,
        slug: p.slug,
        title: p.displayName,
        subtitle: [p.currentRole, p.company].filter(Boolean).join(" · "),
      }));

    // Jobs (cap at 8)
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_status_time", (qq) => qq.eq("status", "published"))
      .order("desc")
      .take(120);
    const jobsOut = [];
    for (const j of jobs) {
      const hit =
        j.title.toLowerCase().includes(needle) ||
        j.location.toLowerCase().includes(needle) ||
        j.description.toLowerCase().includes(needle);
      if (!hit) continue;
      const org = await ctx.db.get(j.employerOrgId);
      jobsOut.push({
        kind: "job" as const,
        slug: j._id,
        title: j.title,
        subtitle: `${org?.name ?? "Employer"} · ${j.location}`,
      });
      if (jobsOut.length >= 8) break;
    }

    // Academy courses (cap at 8)
    const courses = await ctx.db
      .query("academyCourses")
      .withIndex("by_status_published", (qq) => qq.eq("status", "published"))
      .order("desc")
      .take(120);
    const coursesOut = courses
      .filter(
        (c) =>
          c.title.toLowerCase().includes(needle) ||
          c.summary.toLowerCase().includes(needle) ||
          c.category.toLowerCase().includes(needle),
      )
      .slice(0, 8)
      .map((c) => ({
        kind: "course" as const,
        slug: c.slug,
        title: c.title,
        subtitle: `${c.level} · ${c.category}`,
      }));

    return { alumni, jobs: jobsOut, courses: coursesOut };
  },
});
