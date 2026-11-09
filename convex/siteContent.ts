/**
 * CMS page copy — admin-editable text blocks for marketing pages.
 *
 * Each page (`key`) declares its editable fields below: label, default copy,
 * and length cap. The server is the single source of truth for that registry,
 * so:
 *   - `get` (public) returns the stored copy merged over the defaults — pages
 *     render the original copy even before an admin has saved anything;
 *   - `adminGet` returns the field definitions + current values, which the
 *     /admin/content editor renders generically;
 *   - `save` rejects unknown keys and over-long values, and is audit-logged.
 *
 * To make another page editable, add an entry to PAGES and read it with
 * `fetchQuery(api.siteContent.get, { key })` on that page.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";
import { PAGES, defaultsFor, type PageDef } from "./helpers/siteContentPages";

const ADMIN_ROLES = ["moderator", "super-admin"] as const;

function pageOrThrow(key: string): PageDef {
  const page = PAGES[key];
  if (!page) {
    throw new ConvexError({ code: "not-found", message: `Unknown page "${key}"` });
  }
  return page;
}

// --------------------------------------------------------------- queries ---

/** Public: stored copy merged over defaults. Unknown page → defaults-less {}. */
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const page = PAGES[key];
    if (!page) return {} as Record<string, string>;
    const row = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    return { ...defaultsFor(page), ...(row?.fields ?? {}) };
  },
});

/** Admin: editable pages, for the content index. */
export const adminPages = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const rows = await ctx.db.query("siteContent").collect();
    return Object.entries(PAGES).map(([key, page]) => ({
      key,
      title: page.title,
      path: page.path,
      updatedAt: rows.find((r) => r.key === key)?.updatedAt ?? null,
    }));
  },
});

/** Admin: field definitions + current values for one page. */
export const adminGet = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const page = pageOrThrow(key);
    const row = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const stored = row?.fields ?? {};
    let updatedByName: string | null = null;
    if (row?.updatedBy) {
      const user = await ctx.db.get(row.updatedBy);
      updatedByName = user?.name ?? user?.email ?? null;
    }
    return {
      key,
      title: page.title,
      path: page.path,
      updatedAt: row?.updatedAt ?? null,
      updatedByName,
      sections: page.sections.map((s) => ({
        title: s.title,
        fields: s.fields.map((f) => ({
          key: f.key,
          label: f.label,
          help: f.help ?? null,
          multiline: f.multiline ?? false,
          max: f.max,
          default: f.default,
          value: stored[f.key] ?? f.default,
        })),
      })),
    };
  },
});

// ------------------------------------------------------------- mutations ---

export const save = mutation({
  args: { key: v.string(), fields: v.record(v.string(), v.string()) },
  handler: withAuditLog(async (ctx, { key, fields }: {
    key: string;
    fields: Record<string, string>;
  }) => {
    const { userId } = await requireRole(ctx, [...ADMIN_ROLES]);
    const page = pageOrThrow(key);
    const defs = new Map(
      page.sections.flatMap((s) => s.fields).map((f) => [f.key, f]),
    );

    const clean: Record<string, string> = {};
    for (const [fieldKey, raw] of Object.entries(fields)) {
      const def = defs.get(fieldKey);
      if (!def) {
        throw new ConvexError({
          code: "validation",
          message: `Unknown field "${fieldKey}"`,
        });
      }
      const value = raw.replace(/\r\n/g, "\n").trim();
      if (value.length === 0) {
        throw new ConvexError({
          code: "validation",
          message: `"${def.label}" can't be empty`,
        });
      }
      if (value.length > def.max) {
        throw new ConvexError({
          code: "validation",
          message: `"${def.label}" must be ${def.max} characters or fewer`,
        });
      }
      clean[fieldKey] = value;
    }

    const existing = await ctx.db
      .query("siteContent")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const merged = { ...(existing?.fields ?? {}), ...clean };
    const changed = Object.keys(clean).filter(
      (k) => (existing?.fields?.[k] ?? defs.get(k)?.default) !== clean[k],
    );
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { fields: merged, updatedAt: now, updatedBy: userId });
    } else {
      await ctx.db.insert("siteContent", { key, fields: merged, updatedAt: now, updatedBy: userId });
    }
    return {
      action: "update-site-content",
      target: { type: "siteContent", id: key },
      metadata: { changedFields: changed },
      result: { changed: changed.length },
    };
  }),
});
