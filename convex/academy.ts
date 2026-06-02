/**
 * AUF Academy (Epic 17) — on-demand "how-to" courses taught by verified
 * alumni instructors. Pairs with mentorship: course detail surfaces the
 * instructor's openTo status so a viewer can request 1:1 in one click.
 *
 * v1 ground rules:
 * - Any verified alumna can author + publish a course (no separate role).
 * - Courses go live on `publishCourse` without admin moderation. Add
 *   `requireRole` gating + an admin queue if abuse surfaces.
 * - Lessons are either a video URL embed or a markdown article.
 * - Enrollment tracks completed lesson IDs for progress.
 *
 * NFR11 is satisfied because no admin mutations live in this file; the
 * @no-audit-required annotations document user self-service intent for the
 * admin-lint script.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const SLUG_MAX = 80;
const TITLE_MAX = 120;
const SUMMARY_MAX = 280;
const DESCRIPTION_MAX = 8000;
const ARTICLE_MAX = 20000;
const VALID_LEVELS = ["beginner", "intermediate", "advanced"] as const;
const VALID_KINDS = ["video", "article"] as const;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX);
}

async function requireVerifiedAlumna(
  ctx: Parameters<typeof getAuthUserId>[0] & {
    db: { get: (id: Id<"users">) => Promise<unknown> };
  },
): Promise<{ userId: Id<"users"> }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError({
      code: "unauthenticated",
      message: "Sign in required",
    });
  }
  return { userId };
}

// ─────────────────────────────────────────────────────────────
// Public browse + detail
// ─────────────────────────────────────────────────────────────

export const listPublished = query({
  args: {
    category: v.optional(v.string()),
    level: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { category, level, limit }) => {
    const rows = await ctx.db
      .query("academyCourses")
      .withIndex("by_status_published", (q) => q.eq("status", "published"))
      .order("desc")
      .take(limit ?? 60);
    const filtered = rows.filter((c) => {
      if (category && c.category !== category) return false;
      if (level && c.level !== level) return false;
      return true;
    });
    const out = [];
    for (const c of filtered) {
      const inst = await ctx.db.get(c.instructorId);
      const instProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", c.instructorId))
        .unique();
      const enrollments = await ctx.db
        .query("academyEnrollments")
        .withIndex("by_course", (q) => q.eq("courseId", c._id))
        .collect();
      out.push({
        _id: c._id,
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        category: c.category,
        level: c.level,
        durationMinutes: c.durationMinutes ?? null,
        coverImageUrl: c.coverImageStorageId
          ? await ctx.storage.getUrl(c.coverImageStorageId)
          : null,
        publishedAt: c.publishedAt ?? null,
        instructorName:
          instProfile?.displayName ?? inst?.name ?? inst?.email ?? "Instructor",
        instructorSlug: instProfile?.slug ?? null,
        instructorBatch: instProfile?.batch ?? null,
        instructorProgram: instProfile?.program ?? null,
        enrolledCount: enrollments.length,
      });
    }
    return out;
  },
});

export const getCourseBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const course = await ctx.db
      .query("academyCourses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!course) return null;

    const lessons = await ctx.db
      .query("academyLessons")
      .withIndex("by_course_order", (q) => q.eq("courseId", course._id))
      .collect();
    lessons.sort((a, b) => a.order - b.order);

    const inst = await ctx.db.get(course.instructorId);
    const instProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", course.instructorId))
      .unique();

    const me = await getAuthUserId(ctx);
    let enrollment = null as
      | { _id: Id<"academyEnrollments">; completedLessonIds: string[] }
      | null;
    if (me) {
      const row = await ctx.db
        .query("academyEnrollments")
        .withIndex("by_user_course", (q) =>
          q.eq("userId", me).eq("courseId", course._id),
        )
        .unique();
      if (row) {
        enrollment = {
          _id: row._id,
          completedLessonIds: row.completedLessonIds as unknown as string[],
        };
      }
    }

    const enrollments = await ctx.db
      .query("academyEnrollments")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .collect();

    return {
      _id: course._id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      description: course.description,
      category: course.category,
      level: course.level,
      durationMinutes: course.durationMinutes ?? null,
      status: course.status,
      publishedAt: course.publishedAt ?? null,
      coverImageUrl: course.coverImageStorageId
        ? await ctx.storage.getUrl(course.coverImageStorageId)
        : null,
      instructorId: course.instructorId,
      isMine: !!me && me === course.instructorId,
      instructorName:
        instProfile?.displayName ??
        (inst as { name?: string; email?: string } | null)?.name ??
        (inst as { name?: string; email?: string } | null)?.email ??
        "Instructor",
      instructorSlug: instProfile?.slug ?? null,
      instructorBatch: instProfile?.batch ?? null,
      instructorProgram: instProfile?.program ?? null,
      instructorOpenTo: instProfile?.openTo ?? [],
      lessons: lessons.map((l) => ({
        _id: l._id,
        order: l.order,
        title: l.title,
        kind: l.kind,
        videoUrl: l.videoUrl ?? null,
        articleMarkdown: l.articleMarkdown ?? null,
        durationMinutes: l.durationMinutes ?? null,
      })),
      enrolledCount: enrollments.length,
      enrollment,
    };
  },
});

export const myCourses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("academyEnrollments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out = [];
    for (const r of rows) {
      const c = await ctx.db.get(r.courseId);
      if (!c) continue;
      const lessons = await ctx.db
        .query("academyLessons")
        .withIndex("by_course_order", (q) => q.eq("courseId", c._id))
        .collect();
      const total = lessons.length;
      const completed = r.completedLessonIds.length;
      out.push({
        courseId: c._id,
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        category: c.category,
        level: c.level,
        coverImageUrl: c.coverImageStorageId
          ? await ctx.storage.getUrl(c.coverImageStorageId)
          : null,
        progress: total === 0 ? 0 : Math.round((completed / total) * 100),
        completedAt: r.completedAt ?? null,
        enrolledAt: r.enrolledAt,
      });
    }
    return out;
  },
});

// ─────────────────────────────────────────────────────────────
// Enrollment + progress (alumni self-service)
// ─────────────────────────────────────────────────────────────

// @no-audit-required: user self-service enrollment.
export const enroll = mutation({
  args: { courseId: v.id("academyCourses") },
  handler: async (ctx, { courseId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const course = await ctx.db.get(courseId);
    if (!course || course.status !== "published") {
      throw new ConvexError({
        code: "not-available",
        message: "Course is not available",
      });
    }
    const existing = await ctx.db
      .query("academyEnrollments")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", userId).eq("courseId", courseId),
      )
      .unique();
    if (existing) {
      return { enrollmentId: existing._id, alreadyEnrolled: true };
    }
    const id = await ctx.db.insert("academyEnrollments", {
      userId,
      courseId,
      completedLessonIds: [],
      enrolledAt: Date.now(),
    });
    return { enrollmentId: id, alreadyEnrolled: false };
  },
});

// @no-audit-required: user self-service progress tracking.
export const markLessonComplete = mutation({
  args: {
    courseId: v.id("academyCourses"),
    lessonId: v.id("academyLessons"),
  },
  handler: async (ctx, { courseId, lessonId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const row = await ctx.db
      .query("academyEnrollments")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", userId).eq("courseId", courseId),
      )
      .unique();
    if (!row) {
      throw new ConvexError({
        code: "not-enrolled",
        message: "Enroll first",
      });
    }
    const already = row.completedLessonIds.includes(lessonId);
    const completedLessonIds = already
      ? row.completedLessonIds
      : [...row.completedLessonIds, lessonId];

    // Compute completion if all lessons done.
    const lessons = await ctx.db
      .query("academyLessons")
      .withIndex("by_course_order", (q) => q.eq("courseId", courseId))
      .collect();
    const allDone =
      lessons.length > 0 &&
      lessons.every((l) => completedLessonIds.includes(l._id));

    await ctx.db.patch(row._id, {
      completedLessonIds,
      lastViewedLessonId: lessonId,
      completedAt: allDone ? (row.completedAt ?? Date.now()) : row.completedAt,
    });
    return { ok: true, allDone };
  },
});

// ─────────────────────────────────────────────────────────────
// Instructor side
// ─────────────────────────────────────────────────────────────

// @no-audit-required: instructor self-service course creation (drafts only).
export const createCourse = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    description: v.string(),
    category: v.string(),
    level: v.string(),
  },
  handler: async (ctx, args) => {
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
    if (!profile || profile.verifiedAt == null) {
      throw new ConvexError({
        code: "not-verified",
        message: "Only verified alumni can publish courses",
      });
    }
    const title = args.title.trim();
    if (title.length === 0 || title.length > TITLE_MAX) {
      throw new ConvexError({
        code: "invalid-title",
        message: `Title must be 1–${TITLE_MAX} chars`,
      });
    }
    const summary = args.summary.trim();
    if (summary.length === 0 || summary.length > SUMMARY_MAX) {
      throw new ConvexError({
        code: "invalid-summary",
        message: `Summary must be 1–${SUMMARY_MAX} chars`,
      });
    }
    const description = args.description.trim();
    if (description.length > DESCRIPTION_MAX) {
      throw new ConvexError({
        code: "invalid-description",
        message: `Description must be ≤ ${DESCRIPTION_MAX} chars`,
      });
    }
    if (!VALID_LEVELS.includes(args.level as (typeof VALID_LEVELS)[number])) {
      throw new ConvexError({
        code: "invalid-level",
        message: `Level must be one of: ${VALID_LEVELS.join(", ")}`,
      });
    }
    const baseSlug = slugify(title) || "course";
    let slug = baseSlug;
    let i = 1;
    while (
      await ctx.db
        .query("academyCourses")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
    ) {
      i += 1;
      slug = `${baseSlug}-${i}`;
    }
    const now = Date.now();
    const id = await ctx.db.insert("academyCourses", {
      instructorId: userId,
      slug,
      title,
      summary,
      description,
      category: args.category.trim() || "career",
      level: args.level,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    return { courseId: id, slug };
  },
});

// @no-audit-required: instructor self-service.
export const updateCourse = mutation({
  args: {
    courseId: v.id("academyCourses"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    level: v.optional(v.string()),
  },
  handler: async (ctx, { courseId, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const course = await ctx.db.get(courseId);
    if (!course || course.instructorId !== userId) {
      throw new ConvexError({
        code: "forbidden",
        message: "You don't own this course",
      });
    }
    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (patch.title != null) update.title = patch.title.trim();
    if (patch.summary != null) update.summary = patch.summary.trim();
    if (patch.description != null) update.description = patch.description.trim();
    if (patch.category != null) update.category = patch.category.trim();
    if (patch.level != null) {
      if (!VALID_LEVELS.includes(patch.level as (typeof VALID_LEVELS)[number])) {
        throw new ConvexError({
          code: "invalid-level",
          message: `Level must be one of: ${VALID_LEVELS.join(", ")}`,
        });
      }
      update.level = patch.level;
    }
    await ctx.db.patch(courseId, update);
    return { ok: true };
  },
});

// @no-audit-required: instructor self-service publish; no moderation gate in v1.
export const publishCourse = mutation({
  args: { courseId: v.id("academyCourses") },
  handler: async (ctx, { courseId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const course = await ctx.db.get(courseId);
    if (!course || course.instructorId !== userId) {
      throw new ConvexError({
        code: "forbidden",
        message: "You don't own this course",
      });
    }
    const lessons = await ctx.db
      .query("academyLessons")
      .withIndex("by_course_order", (q) => q.eq("courseId", courseId))
      .collect();
    if (lessons.length === 0) {
      throw new ConvexError({
        code: "no-lessons",
        message: "Add at least one lesson before publishing",
      });
    }
    const total = lessons.reduce(
      (acc, l) => acc + (l.durationMinutes ?? 0),
      0,
    );
    await ctx.db.patch(courseId, {
      status: "published",
      publishedAt: Date.now(),
      durationMinutes: total,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

// @no-audit-required: instructor self-service.
export const unpublishCourse = mutation({
  args: { courseId: v.id("academyCourses") },
  handler: async (ctx, { courseId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const course = await ctx.db.get(courseId);
    if (!course || course.instructorId !== userId) {
      throw new ConvexError({
        code: "forbidden",
        message: "You don't own this course",
      });
    }
    await ctx.db.patch(courseId, {
      status: "draft",
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

// @no-audit-required: instructor self-service.
export const addLesson = mutation({
  args: {
    courseId: v.id("academyCourses"),
    title: v.string(),
    kind: v.string(),
    videoUrl: v.optional(v.string()),
    articleMarkdown: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const course = await ctx.db.get(args.courseId);
    if (!course || course.instructorId !== userId) {
      throw new ConvexError({
        code: "forbidden",
        message: "You don't own this course",
      });
    }
    if (!VALID_KINDS.includes(args.kind as (typeof VALID_KINDS)[number])) {
      throw new ConvexError({
        code: "invalid-kind",
        message: `Kind must be: ${VALID_KINDS.join(", ")}`,
      });
    }
    const title = args.title.trim();
    if (title.length === 0 || title.length > TITLE_MAX) {
      throw new ConvexError({
        code: "invalid-title",
        message: `Title must be 1–${TITLE_MAX} chars`,
      });
    }
    if (args.kind === "video" && !args.videoUrl?.trim()) {
      throw new ConvexError({
        code: "missing-video",
        message: "Video lessons need a videoUrl",
      });
    }
    if (args.kind === "article") {
      const md = args.articleMarkdown?.trim() ?? "";
      if (md.length === 0 || md.length > ARTICLE_MAX) {
        throw new ConvexError({
          code: "invalid-article",
          message: `Article must be 1–${ARTICLE_MAX} chars`,
        });
      }
    }
    const existing = await ctx.db
      .query("academyLessons")
      .withIndex("by_course_order", (q) => q.eq("courseId", args.courseId))
      .collect();
    const order = existing.length + 1;
    const now = Date.now();
    const id = await ctx.db.insert("academyLessons", {
      courseId: args.courseId,
      order,
      title,
      kind: args.kind,
      videoUrl: args.videoUrl?.trim() || undefined,
      articleMarkdown: args.articleMarkdown?.trim() || undefined,
      durationMinutes: args.durationMinutes,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.courseId, { updatedAt: now });
    return { lessonId: id, order };
  },
});

// @no-audit-required: instructor self-service.
export const deleteLesson = mutation({
  args: { lessonId: v.id("academyLessons") },
  handler: async (ctx, { lessonId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) return { ok: true };
    const course = await ctx.db.get(lesson.courseId);
    if (!course || course.instructorId !== userId) {
      throw new ConvexError({
        code: "forbidden",
        message: "You don't own this course",
      });
    }
    await ctx.db.delete(lessonId);
    // Compact ordering on remaining lessons.
    const remaining = await ctx.db
      .query("academyLessons")
      .withIndex("by_course_order", (q) => q.eq("courseId", lesson.courseId))
      .collect();
    remaining.sort((a, b) => a.order - b.order);
    for (let i = 0; i < remaining.length; i += 1) {
      if (remaining[i].order !== i + 1) {
        await ctx.db.patch(remaining[i]._id, { order: i + 1 });
      }
    }
    await ctx.db.patch(lesson.courseId, { updatedAt: Date.now() });
    return { ok: true };
  },
});

export const myInstructorCourses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("academyCourses")
      .withIndex("by_instructor", (q) => q.eq("instructorId", userId))
      .collect();
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    const out = [];
    for (const c of rows) {
      const lessons = await ctx.db
        .query("academyLessons")
        .withIndex("by_course_order", (q) => q.eq("courseId", c._id))
        .collect();
      const enrollments = await ctx.db
        .query("academyEnrollments")
        .withIndex("by_course", (q) => q.eq("courseId", c._id))
        .collect();
      out.push({
        _id: c._id,
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        category: c.category,
        level: c.level,
        status: c.status,
        lessonCount: lessons.length,
        enrolledCount: enrollments.length,
        updatedAt: c.updatedAt,
        publishedAt: c.publishedAt ?? null,
      });
    }
    return out;
  },
});
