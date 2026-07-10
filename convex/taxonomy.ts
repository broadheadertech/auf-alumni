/**
 * Academic taxonomy — admin-managed colleges + courses/programs.
 *
 * The canonical, editable source for the college/program lists that power every
 * alumni-facing picker (profile, verification) and admin filter. Managed from
 * /admin/settings. Programs belong to a college, so college is derivable from a
 * profile's program by name lookup.
 *
 * - Public list queries (`listColleges`, `listPrograms`) return ACTIVE rows for
 *   dropdowns; callable by any signed-in user.
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

function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length === 0) {
    throw new ConvexError({ code: "validation", message: "Name is required" });
  }
  if (name.length > NAME_MAX) {
    throw new ConvexError({
      code: "validation",
      message: `Name must be ${NAME_MAX} characters or fewer`,
    });
  }
  return name;
}

async function nextSortOrder(
  ctx: MutationCtx,
  table: "colleges" | "programs",
): Promise<number> {
  const rows = await ctx.db.query(table).collect();
  return rows.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1;
}

// --------------------------------------------------------------- queries ---

/** Active colleges, sorted. Callable by any signed-in user (dropdowns). */
export const listColleges = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("colleges").withIndex("by_sort").collect();
    return rows
      .filter((c) => c.archivedAt == null)
      .map((c) => ({
        _id: c._id,
        name: c.name,
        shortName: c.shortName,
        sortOrder: c.sortOrder,
      }));
  },
});

/**
 * Active programs joined with their college name, sorted by college then
 * program. Callable by any signed-in user — powers the program pickers.
 */
export const listPrograms = query({
  args: {},
  handler: async (ctx) => {
    const [colleges, programs] = await Promise.all([
      ctx.db.query("colleges").collect(),
      ctx.db.query("programs").withIndex("by_sort").collect(),
    ]);
    const collegeById = new Map(colleges.map((c) => [c._id, c]));
    return programs
      .filter((p) => p.archivedAt == null)
      .map((p) => {
        const college = collegeById.get(p.collegeId);
        return {
          _id: p._id,
          name: p.name,
          degree: p.degree,
          collegeId: p.collegeId,
          collegeName: college?.name ?? "—",
          collegeSort: college?.sortOrder ?? 999,
          sortOrder: p.sortOrder,
        };
      })
      .sort(
        (a, b) => a.collegeSort - b.collegeSort || a.sortOrder - b.sortOrder,
      );
  },
});

/**
 * Full admin view: every college + program including archived, with a live
 * count of active programs per college. Powers the admin settings page.
 */
export const adminList = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const [colleges, programs] = await Promise.all([
      ctx.db.query("colleges").withIndex("by_sort").collect(),
      ctx.db.query("programs").withIndex("by_sort").collect(),
    ]);
    const activeProgramCount = new Map<Id<"colleges">, number>();
    for (const p of programs) {
      if (p.archivedAt == null) {
        activeProgramCount.set(
          p.collegeId,
          (activeProgramCount.get(p.collegeId) ?? 0) + 1,
        );
      }
    }
    return {
      colleges: colleges.map((c) => ({
        _id: c._id,
        name: c.name,
        shortName: c.shortName,
        sortOrder: c.sortOrder,
        archived: c.archivedAt != null,
        programCount: activeProgramCount.get(c._id) ?? 0,
      })),
      programs: programs.map((p) => ({
        _id: p._id,
        name: p.name,
        degree: p.degree,
        collegeId: p.collegeId,
        sortOrder: p.sortOrder,
        archived: p.archivedAt != null,
      })),
    };
  },
});

// -------------------------------------------------------------- colleges ---

export const createCollege = mutation({
  args: { name: v.string(), shortName: v.optional(v.string()) },
  handler: withAuditLog(async (ctx, { name, shortName }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const clean = cleanName(name);
    const existing = await ctx.db.query("colleges").collect();
    if (
      existing.some(
        (c) => c.archivedAt == null && c.name.toLowerCase() === clean.toLowerCase(),
      )
    ) {
      throw new ConvexError({
        code: "duplicate",
        message: "A college with that name already exists",
      });
    }
    const now = Date.now();
    const id = await ctx.db.insert("colleges", {
      name: clean,
      shortName: shortName?.trim() || undefined,
      sortOrder: await nextSortOrder(ctx, "colleges"),
      createdAt: now,
      updatedAt: now,
    });
    return {
      action: "create-college",
      target: { type: "college", id },
      metadata: { name: clean },
      result: { collegeId: id },
    };
  }),
});

export const updateCollege = mutation({
  args: {
    collegeId: v.id("colleges"),
    name: v.optional(v.string()),
    shortName: v.optional(v.string()),
  },
  handler: withAuditLog(async (ctx, { collegeId, name, shortName }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const college = await ctx.db.get(collegeId as Id<"colleges">);
    if (!college) {
      throw new ConvexError({ code: "not-found", message: "College not found" });
    }
    const patch: Partial<Doc<"colleges">> = { updatedAt: Date.now() };
    if (name != null) patch.name = cleanName(name);
    if (shortName != null) patch.shortName = shortName.trim() || undefined;
    await ctx.db.patch(collegeId, patch);
    return {
      action: "update-college",
      target: { type: "college", id: collegeId },
      metadata: { name: patch.name ?? college.name },
    };
  }),
});

/** Archive or restore a college. Archiving hides it AND its programs. */
export const setCollegeArchived = mutation({
  args: { collegeId: v.id("colleges"), archived: v.boolean() },
  handler: withAuditLog(async (ctx, { collegeId, archived }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const college = await ctx.db.get(collegeId as Id<"colleges">);
    if (!college) {
      throw new ConvexError({ code: "not-found", message: "College not found" });
    }
    await ctx.db.patch(collegeId, {
      archivedAt: archived ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return {
      action: archived ? "archive-college" : "restore-college",
      target: { type: "college", id: collegeId },
      metadata: { name: college.name },
    };
  }),
});

// -------------------------------------------------------------- programs ---

export const createProgram = mutation({
  args: {
    name: v.string(),
    collegeId: v.id("colleges"),
    degree: v.optional(v.string()),
  },
  handler: withAuditLog(async (ctx, { name, collegeId, degree }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const college = await ctx.db.get(collegeId as Id<"colleges">);
    if (!college) {
      throw new ConvexError({ code: "not-found", message: "College not found" });
    }
    const clean = cleanName(name);
    const existing = await ctx.db.query("programs").collect();
    if (
      existing.some(
        (p) => p.archivedAt == null && p.name.toLowerCase() === clean.toLowerCase(),
      )
    ) {
      throw new ConvexError({
        code: "duplicate",
        message: "A program with that name already exists",
      });
    }
    const now = Date.now();
    const id = await ctx.db.insert("programs", {
      name: clean,
      collegeId,
      degree: degree?.trim() || undefined,
      sortOrder: await nextSortOrder(ctx, "programs"),
      createdAt: now,
      updatedAt: now,
    });
    return {
      action: "create-program",
      target: { type: "program", id },
      metadata: { name: clean, college: college.name },
      result: { programId: id },
    };
  }),
});

export const updateProgram = mutation({
  args: {
    programId: v.id("programs"),
    name: v.optional(v.string()),
    collegeId: v.optional(v.id("colleges")),
    degree: v.optional(v.string()),
  },
  handler: withAuditLog(async (ctx, { programId, name, collegeId, degree }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const program = await ctx.db.get(programId as Id<"programs">);
    if (!program) {
      throw new ConvexError({ code: "not-found", message: "Program not found" });
    }
    const patch: Partial<Doc<"programs">> = { updatedAt: Date.now() };
    if (name != null) patch.name = cleanName(name);
    if (degree != null) patch.degree = degree.trim() || undefined;
    if (collegeId != null) {
      const college = await ctx.db.get(collegeId as Id<"colleges">);
      if (!college) {
        throw new ConvexError({
          code: "not-found",
          message: "College not found",
        });
      }
      patch.collegeId = collegeId;
    }
    await ctx.db.patch(programId, patch);
    return {
      action: "update-program",
      target: { type: "program", id: programId },
      metadata: { name: patch.name ?? program.name },
    };
  }),
});

export const setProgramArchived = mutation({
  args: { programId: v.id("programs"), archived: v.boolean() },
  handler: withAuditLog(async (ctx, { programId, archived }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const program = await ctx.db.get(programId as Id<"programs">);
    if (!program) {
      throw new ConvexError({ code: "not-found", message: "Program not found" });
    }
    await ctx.db.patch(programId, {
      archivedAt: archived ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return {
      action: archived ? "archive-program" : "restore-program",
      target: { type: "program", id: programId },
      metadata: { name: program.name },
    };
  }),
});

// ------------------------------------------------------------------ seed ---

/** Default AUF colleges → programs, used to seed an empty taxonomy. */
const SEED: Array<{ college: string; short: string; programs: string[] }> = [
  {
    college: "College of Computer Studies",
    short: "CCS",
    programs: ["BS Information Technology", "BS Computer Science"],
  },
  {
    college: "College of Engineering & Architecture",
    short: "CEA",
    programs: ["BS Architecture", "BS Civil Engineering"],
  },
  {
    college: "College of Business & Accountancy",
    short: "CBA",
    programs: ["BS Business Administration", "BS Accountancy"],
  },
  { college: "College of Nursing", short: "CON", programs: ["BS Nursing"] },
  {
    college: "College of Allied Medical Professions",
    short: "CAMP",
    programs: ["BS Medical Technology", "BS Physical Therapy"],
  },
  {
    college: "College of Arts & Sciences",
    short: "CAS",
    programs: ["BS Psychology"],
  },
  {
    college: "College of Education",
    short: "COE",
    programs: ["BS Education"],
  },
];

/**
 * Idempotently seed the default AUF colleges + programs. No-op once any college
 * exists, so it's safe to click the "Load AUF defaults" button repeatedly.
 */
export const seedDefaults = mutation({
  args: {},
  handler: withAuditLog(async (ctx) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const existing = await ctx.db.query("colleges").take(1);
    if (existing.length > 0) {
      return {
        action: "seed-taxonomy",
        target: { type: "taxonomy", id: "taxonomy" },
        reason: "skipped-nonempty",
        result: { seeded: false, colleges: 0 },
      };
    }
    const now = Date.now();
    let collegeOrder = 0;
    let programOrder = 0;
    for (const entry of SEED) {
      const collegeId = await ctx.db.insert("colleges", {
        name: entry.college,
        shortName: entry.short,
        sortOrder: collegeOrder++,
        createdAt: now,
        updatedAt: now,
      });
      for (const programName of entry.programs) {
        await ctx.db.insert("programs", {
          name: programName,
          collegeId,
          degree: "Undergraduate",
          sortOrder: programOrder++,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return {
      action: "seed-taxonomy",
      target: { type: "taxonomy", id: "taxonomy" },
      result: { seeded: true, colleges: SEED.length },
    };
  }),
});
