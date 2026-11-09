/**
 * CMS articles — the newsroom at /news, authored from /admin/articles.
 *
 * Lifecycle: draft → published ⇄ draft (unpublish) → archived. `publishedAt`
 * is stamped on first publish and kept on re-publish so ordering is stable.
 * Only `published` rows are ever returned by the public queries.
 *
 * Body is plain text: blank lines separate paragraphs. (No markdown/HTML, so
 * there's nothing to sanitise on render.)
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";

const ADMIN_ROLES = ["moderator", "super-admin"] as const;
const TITLE_MAX = 160;
const EXCERPT_MAX = 300;
const BODY_MAX = 20000;
const CATEGORY_MAX = 40;

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "article"
  );
}

async function uniqueSlug(
  ctx: MutationCtx,
  base: string,
  exceptId?: Id<"articles">,
): Promise<string> {
  let candidate = base;
  for (let n = 2; ; n++) {
    const hit = await ctx.db
      .query("articles")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .unique();
    if (!hit || hit._id === exceptId) return candidate;
    candidate = `${base}-${n}`;
  }
}

function tooLong(label: string, max: number): never {
  throw new ConvexError({
    code: "validation",
    message: `${label} must be ${max} characters or fewer`,
  });
}

async function coverUrl(ctx: QueryCtx, a: Doc<"articles">) {
  return a.coverStorageId ? await ctx.storage.getUrl(a.coverStorageId) : null;
}

async function getOrThrow(ctx: MutationCtx, articleId: Id<"articles">) {
  const article = await ctx.db.get(articleId);
  if (!article) {
    throw new ConvexError({ code: "not-found", message: "Article not found" });
  }
  return article;
}

// ---------------------------------------------------------- public reads ---

export const listPublished = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("articles")
      .withIndex("by_status_published", (q) => q.eq("status", "published"))
      .order("desc")
      .take(Math.min(Math.max(limit ?? 50, 1), 100));
    return Promise.all(
      rows.map(async (a) => ({
        _id: a._id,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt ?? null,
        category: a.category ?? null,
        publishedAt: a.publishedAt ?? a.createdAt,
        coverUrl: await coverUrl(ctx, a),
      })),
    );
  },
});

export const getPublishedBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const a = await ctx.db
      .query("articles")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!a || a.status !== "published") return null;
    return {
      _id: a._id,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt ?? null,
      body: a.body,
      category: a.category ?? null,
      publishedAt: a.publishedAt ?? a.createdAt,
      coverUrl: await coverUrl(ctx, a),
    };
  },
});

// ----------------------------------------------------------- admin reads ---

export const adminList = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const rows = await ctx.db.query("articles").collect();
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return rows.map((a) => ({
      _id: a._id,
      slug: a.slug,
      title: a.title,
      category: a.category ?? null,
      status: a.status,
      publishedAt: a.publishedAt ?? null,
      updatedAt: a.updatedAt,
    }));
  },
});

export const adminGet = query({
  args: { articleId: v.id("articles") },
  handler: async (ctx, { articleId }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const a = await ctx.db.get(articleId);
    if (!a) return null;
    return {
      _id: a._id,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt ?? "",
      body: a.body,
      category: a.category ?? "",
      status: a.status,
      publishedAt: a.publishedAt ?? null,
      updatedAt: a.updatedAt,
      coverStorageId: a.coverStorageId ?? null,
      coverUrl: await coverUrl(ctx, a),
    };
  },
});

// ------------------------------------------------------------- mutations ---

export const createDraft = mutation({
  args: { title: v.optional(v.string()) },
  handler: withAuditLog(async (ctx, { title }) => {
    const { userId } = await requireRole(ctx, [...ADMIN_ROLES]);
    const cleanTitle = (title ?? "").trim() || "Untitled article";
    if (cleanTitle.length > TITLE_MAX) tooLong("Title", TITLE_MAX);
    const now = Date.now();
    const id = await ctx.db.insert("articles", {
      title: cleanTitle,
      slug: await uniqueSlug(ctx, slugify(cleanTitle)),
      body: "",
      status: "draft",
      authorId: userId,
      createdAt: now,
      updatedAt: now,
    });
    return {
      action: "create-article",
      target: { type: "article", id },
      metadata: { title: cleanTitle },
      result: { articleId: id },
    };
  }),
});

export const update = mutation({
  args: {
    articleId: v.id("articles"),
    title: v.string(),
    slug: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    body: v.string(),
    category: v.optional(v.string()),
  },
  handler: withAuditLog(async (ctx, args) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const article = await getOrThrow(ctx, args.articleId);

    const title = args.title.trim();
    if (!title) {
      throw new ConvexError({ code: "validation", message: "Title is required" });
    }
    if (title.length > TITLE_MAX) tooLong("Title", TITLE_MAX);
    const excerpt = (args.excerpt ?? "").trim();
    if (excerpt.length > EXCERPT_MAX) tooLong("Excerpt", EXCERPT_MAX);
    const body = args.body.replace(/\r\n/g, "\n").trim();
    if (body.length > BODY_MAX) tooLong("Body", BODY_MAX);
    const category = (args.category ?? "").trim();
    if (category.length > CATEGORY_MAX) tooLong("Category", CATEGORY_MAX);
    if (article.status === "published" && !body) {
      throw new ConvexError({
        code: "validation",
        message: "A published article needs a body",
      });
    }

    const slug = await uniqueSlug(
      ctx,
      slugify(args.slug?.trim() || title),
      article._id,
    );

    await ctx.db.patch(article._id, {
      title,
      slug,
      excerpt: excerpt || undefined,
      body,
      category: category || undefined,
      updatedAt: Date.now(),
    });
    return {
      action: "update-article",
      target: { type: "article", id: article._id },
      metadata: { title, slug },
      result: { slug },
    };
  }),
});

export const setStatus = mutation({
  args: { articleId: v.id("articles"), status: statusValidator },
  handler: withAuditLog(async (ctx, { articleId, status }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const article = await getOrThrow(ctx, articleId);
    if (status === "published" && !article.body.trim()) {
      throw new ConvexError({
        code: "validation",
        message: "Add a body before publishing",
      });
    }
    const now = Date.now();
    await ctx.db.patch(article._id, {
      status,
      publishedAt:
        status === "published" ? (article.publishedAt ?? now) : article.publishedAt,
      updatedAt: now,
    });
    return {
      action: `article-${status}`,
      target: { type: "article", id: article._id },
      metadata: { title: article.title, from: article.status },
    };
  }),
});

export const remove = mutation({
  args: { articleId: v.id("articles") },
  handler: withAuditLog(async (ctx, { articleId }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const article = await getOrThrow(ctx, articleId);
    if (article.status === "published") {
      throw new ConvexError({
        code: "validation",
        message: "Unpublish the article before deleting it",
      });
    }
    if (article.coverStorageId) await ctx.storage.delete(article.coverStorageId);
    await ctx.db.delete(article._id);
    return {
      action: "delete-article",
      target: { type: "article", id: article._id },
      metadata: { title: article.title },
    };
  }),
});

// @no-audit-required: only mints an ephemeral upload token; attaching the file is audited in setCover.
export const generateCoverUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setCover = mutation({
  args: {
    articleId: v.id("articles"),
    storageId: v.optional(v.id("_storage")),
  },
  handler: withAuditLog(async (ctx, { articleId, storageId }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const article = await getOrThrow(ctx, articleId);
    if (article.coverStorageId && article.coverStorageId !== storageId) {
      await ctx.storage.delete(article.coverStorageId);
    }
    await ctx.db.patch(article._id, {
      coverStorageId: storageId,
      updatedAt: Date.now(),
    });
    return {
      action: storageId ? "set-article-cover" : "remove-article-cover",
      target: { type: "article", id: article._id },
      metadata: { title: article.title },
    };
  }),
});

// ------------------------------------------------------------------ seed ---

const SAMPLES: Array<{ title: string; category: string; daysAgo: number; body: string }> = [
  {
    title: "Network crosses 1,000 verified alumni",
    category: "Milestone",
    daysAgo: 3,
    body: "Six months after the soft launch, the AUF Alumni Network passed 1,000 fully verified members across the eight colleges.\n\nComputer Studies, Nursing, and Engineering lead by college share. The Office of Alumni Relations credits the milestone to batch-captain outreach and a faster registrar lookup added in March.",
  },
  {
    title: "Partner tier launches with founding employers",
    category: "Employers",
    daysAgo: 11,
    body: "Three founding employer partners go live this week with verified profiles and priority job posting.\n\nPartner-tier roles include alumni-only application windows and faster recruiter response SLAs.",
  },
  {
    title: "AUF tech mixer — registration opens",
    category: "Events",
    daysAgo: 18,
    body: "The annual AUF tech mixer returns to Clark, hosted at the AUF Innovation Lab. Open to all verified alumni and current Computer Studies and Engineering students.\n\nCapacity is capped at 300 — RSVP through the events tab once your account is verified.",
  },
];

/** Load sample articles into an empty newsroom. No-op once any article exists. */
export const seedSamples = mutation({
  args: {},
  handler: withAuditLog(async (ctx) => {
    const { userId } = await requireRole(ctx, [...ADMIN_ROLES]);
    const existing = await ctx.db.query("articles").take(1);
    if (existing.length > 0) {
      return {
        action: "seed-articles",
        target: { type: "articles", id: "articles" },
        reason: "skipped-nonempty",
        result: { seeded: false, count: 0 },
      };
    }
    const now = Date.now();
    for (const s of SAMPLES) {
      const at = now - s.daysAgo * 24 * 60 * 60 * 1000;
      await ctx.db.insert("articles", {
        title: s.title,
        slug: await uniqueSlug(ctx, slugify(s.title)),
        excerpt: s.body.split("\n\n")[0],
        body: s.body,
        category: s.category,
        status: "published",
        publishedAt: at,
        authorId: userId,
        createdAt: at,
        updatedAt: at,
      });
    }
    return {
      action: "seed-articles",
      target: { type: "articles", id: "articles" },
      result: { seeded: true, count: SAMPLES.length },
    };
  }),
});
