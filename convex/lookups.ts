/**
 * CMS reference lists — admin-managed areas (locations), employment statuses,
 * and skill sets.
 *
 * Same shape and rules as the academic taxonomy (convex/taxonomy.ts): the
 * canonical, editable source for pick lists across the app, managed from
 * /admin/lists/[kind] without a code change.
 *
 * - `listActive` returns ACTIVE rows for pickers; callable by anyone (these are
 *   non-sensitive labels also used on public pages).
 * - Admin mutations require moderator/super-admin and are audit-logged.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";

const ADMIN_ROLES = ["moderator", "super-admin"] as const;
const NAME_MAX = 120;
const GROUP_MAX = 80;
const DESCRIPTION_MAX = 300;

const kindValidator = v.union(
  v.literal("area"),
  v.literal("status"),
  v.literal("skill"),
);
type Kind = "area" | "status" | "skill";

function clean(raw: string | undefined, max: number, label: string): string {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  if (value.length > max) {
    throw new ConvexError({
      code: "validation",
      message: `${label} must be ${max} characters or fewer`,
    });
  }
  return value;
}

function cleanName(raw: string): string {
  const name = clean(raw, NAME_MAX, "Name");
  if (name.length === 0) {
    throw new ConvexError({ code: "validation", message: "Name is required" });
  }
  return name;
}

async function rowsOfKind(ctx: MutationCtx, kind: Kind) {
  return ctx.db
    .query("referenceItems")
    .withIndex("by_kind_sort", (q) => q.eq("kind", kind))
    .collect();
}

async function assertUnique(
  ctx: MutationCtx,
  kind: Kind,
  name: string,
  exceptId?: Id<"referenceItems">,
) {
  const rows = await rowsOfKind(ctx, kind);
  if (
    rows.some(
      (r) =>
        r._id !== exceptId &&
        r.archivedAt == null &&
        r.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new ConvexError({
      code: "duplicate",
      message: "An item with that name already exists",
    });
  }
}

// --------------------------------------------------------------- queries ---

/** Active items of one kind, sorted. Public — powers pickers + filters. */
export const listActive = query({
  args: { kind: kindValidator },
  handler: async (ctx, { kind }) => {
    const rows = await ctx.db
      .query("referenceItems")
      .withIndex("by_kind_sort", (q) => q.eq("kind", kind))
      .collect();
    return rows
      .filter((r) => r.archivedAt == null)
      .map((r) => ({
        _id: r._id,
        name: r.name,
        group: r.group,
        description: r.description,
      }));
  },
});

/** Every item of one kind including archived. Powers the admin list page. */
export const adminList = query({
  args: { kind: kindValidator },
  handler: async (ctx, { kind }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const rows = await ctx.db
      .query("referenceItems")
      .withIndex("by_kind_sort", (q) => q.eq("kind", kind))
      .collect();
    return rows.map((r) => ({
      _id: r._id,
      name: r.name,
      group: r.group,
      description: r.description,
      sortOrder: r.sortOrder,
      archived: r.archivedAt != null,
    }));
  },
});

// ------------------------------------------------------------- mutations ---

export const create = mutation({
  args: {
    kind: kindValidator,
    name: v.string(),
    group: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: withAuditLog(async (ctx, { kind, name, group, description }: {
    kind: Kind;
    name: string;
    group?: string;
    description?: string;
  }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const cleanedName = cleanName(name);
    await assertUnique(ctx, kind, cleanedName);
    const rows = await rowsOfKind(ctx, kind);
    const now = Date.now();
    const id = await ctx.db.insert("referenceItems", {
      kind,
      name: cleanedName,
      group: clean(group, GROUP_MAX, "Group") || undefined,
      description: clean(description, DESCRIPTION_MAX, "Description") || undefined,
      sortOrder: rows.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1,
      createdAt: now,
      updatedAt: now,
    });
    return {
      action: `create-${kind}`,
      target: { type: kind, id },
      metadata: { name: cleanedName },
      result: { itemId: id },
    };
  }),
});

export const update = mutation({
  args: {
    itemId: v.id("referenceItems"),
    name: v.optional(v.string()),
    group: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: withAuditLog(async (ctx, { itemId, name, group, description }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const item = await ctx.db.get(itemId as Id<"referenceItems">);
    if (!item) {
      throw new ConvexError({ code: "not-found", message: "Item not found" });
    }
    const patch: Partial<Doc<"referenceItems">> = { updatedAt: Date.now() };
    if (name != null) {
      patch.name = cleanName(name);
      await assertUnique(ctx, item.kind as Kind, patch.name, item._id);
    }
    if (group != null) patch.group = clean(group, GROUP_MAX, "Group") || undefined;
    if (description != null) {
      patch.description =
        clean(description, DESCRIPTION_MAX, "Description") || undefined;
    }
    await ctx.db.patch(item._id, patch);
    return {
      action: `update-${item.kind}`,
      target: { type: item.kind, id: item._id },
      metadata: { name: patch.name ?? item.name, previousName: item.name },
    };
  }),
});

/** Archive or restore. Archived items disappear from pickers but existing
 * profile values that reference them are left untouched. */
export const setArchived = mutation({
  args: { itemId: v.id("referenceItems"), archived: v.boolean() },
  handler: withAuditLog(async (ctx, { itemId, archived }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const item = await ctx.db.get(itemId as Id<"referenceItems">);
    if (!item) {
      throw new ConvexError({ code: "not-found", message: "Item not found" });
    }
    if (!archived) await assertUnique(ctx, item.kind as Kind, item.name, item._id);
    await ctx.db.patch(item._id, {
      archivedAt: archived ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return {
      action: `${archived ? "archive" : "restore"}-${item.kind}`,
      target: { type: item.kind, id: item._id },
      metadata: { name: item.name },
    };
  }),
});

/** Swap an item with its neighbour in sort order. */
export const move = mutation({
  args: {
    itemId: v.id("referenceItems"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: withAuditLog(async (ctx, { itemId, direction }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const item = await ctx.db.get(itemId as Id<"referenceItems">);
    if (!item) {
      throw new ConvexError({ code: "not-found", message: "Item not found" });
    }
    const rows = await rowsOfKind(ctx, item.kind as Kind);
    const index = rows.findIndex((r) => r._id === item._id);
    const neighbour = rows[direction === "up" ? index - 1 : index + 1];
    if (neighbour) {
      const now = Date.now();
      await ctx.db.patch(item._id, { sortOrder: neighbour.sortOrder, updatedAt: now });
      await ctx.db.patch(neighbour._id, { sortOrder: item.sortOrder, updatedAt: now });
    }
    return {
      action: `reorder-${item.kind}`,
      target: { type: item.kind, id: item._id },
      metadata: { name: item.name, direction },
    };
  }),
});

// ------------------------------------------------------------------ seed ---

export const LOOKUP_SEED: Record<Kind, Array<{ name: string; group?: string; description?: string }>> = {
  area: [
    { name: "Angeles City", group: "Central Luzon" },
    { name: "Clark Freeport Zone", group: "Central Luzon" },
    { name: "Mabalacat", group: "Central Luzon" },
    { name: "San Fernando, Pampanga", group: "Central Luzon" },
    { name: "Tarlac City", group: "Central Luzon" },
    { name: "Olongapo", group: "Central Luzon" },
    { name: "Makati", group: "Metro Manila" },
    { name: "Taguig (BGC)", group: "Metro Manila" },
    { name: "Pasig (Ortigas)", group: "Metro Manila" },
    { name: "Quezon City", group: "Metro Manila" },
    { name: "Manila", group: "Metro Manila" },
    { name: "Cebu City", group: "Visayas" },
    { name: "Davao City", group: "Mindanao" },
    { name: "Singapore", group: "Abroad" },
    { name: "Dubai", group: "Abroad" },
    { name: "United States", group: "Abroad" },
    { name: "Remote", group: "Remote" },
  ],
  status: [
    { name: "Employed — full-time", description: "Working full-time for an employer" },
    { name: "Employed — part-time", description: "Working part-time for an employer" },
    { name: "Self-employed / Business owner" },
    { name: "Freelance / Contractual" },
    { name: "Pursuing further studies" },
    { name: "Looking for work" },
    { name: "Not currently seeking work" },
    { name: "Working abroad (OFW)" },
  ],
  skill: [
    { name: "Software Development", group: "Technology" },
    { name: "Web Development", group: "Technology" },
    { name: "Data Analysis", group: "Technology" },
    { name: "UI/UX Design", group: "Technology" },
    { name: "Network Administration", group: "Technology" },
    { name: "Accounting", group: "Business" },
    { name: "Financial Analysis", group: "Business" },
    { name: "Project Management", group: "Business" },
    { name: "Sales & Marketing", group: "Business" },
    { name: "Patient Care", group: "Healthcare" },
    { name: "Clinical Laboratory", group: "Healthcare" },
    { name: "Physical Therapy", group: "Healthcare" },
    { name: "AutoCAD", group: "Engineering & Architecture" },
    { name: "Structural Design", group: "Engineering & Architecture" },
    { name: "Teaching & Curriculum Design", group: "Education" },
    { name: "Public Speaking", group: "Soft skills" },
    { name: "Leadership", group: "Soft skills" },
    { name: "Written Communication", group: "Soft skills" },
  ],
};

/** Idempotently seed defaults for one kind. No-op once any item exists. */
export const seedDefaults = mutation({
  args: { kind: kindValidator },
  handler: withAuditLog(async (ctx, { kind }: { kind: Kind }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const existing = await rowsOfKind(ctx, kind);
    if (existing.length > 0) {
      return {
        action: `seed-${kind}`,
        target: { type: kind, id: kind },
        reason: "skipped-nonempty",
        result: { seeded: false, count: 0 },
      };
    }
    const now = Date.now();
    let order = 0;
    for (const entry of LOOKUP_SEED[kind]) {
      await ctx.db.insert("referenceItems", {
        kind,
        name: entry.name,
        group: entry.group,
        description: entry.description,
        sortOrder: order++,
        createdAt: now,
        updatedAt: now,
      });
    }
    return {
      action: `seed-${kind}`,
      target: { type: kind, id: kind },
      result: { seeded: true, count: LOOKUP_SEED[kind].length },
    };
  }),
});
