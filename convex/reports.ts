/**
 * User reports (Epic 10 Story 10.3).
 * Surfaced to moderators via /admin/moderation/reports (Phase 3 expansion);
 * for Phase 2 the report itself + listing is what we need.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";

// @no-audit-required: user self-service report; admin resolution audit-logged.
export const createReport = mutation({
  args: {
    reportedUserId: v.id("users"),
    category: v.string(),
    details: v.string(),
  },
  handler: async (ctx, { reportedUserId, category, details }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (me === reportedUserId) {
      throw new ConvexError({
        code: "self-report",
        message: "Cannot report yourself",
      });
    }
    if (!["spam", "harassment", "impersonation", "other"].includes(category)) {
      throw new ConvexError({
        code: "invalid-category",
        message: "Unknown report category",
      });
    }
    if (!details.trim()) {
      throw new ConvexError({
        code: "empty",
        message: "Please describe the issue",
      });
    }
    const id = await ctx.db.insert("reports", {
      reporterId: me,
      reportedUserId,
      category,
      details: details.trim(),
      createdAt: Date.now(),
    });
    return { reportId: id };
  },
});

export const listReports = query({
  args: { onlyOpen: v.optional(v.boolean()) },
  handler: async (ctx, { onlyOpen }) => {
    await requireRole(ctx, ["moderator", "super-admin"]);
    const rows = await ctx.db
      .query("reports")
      .order("desc")
      .take(100);
    const filtered = onlyOpen ? rows.filter((r) => !r.resolvedAt) : rows;
    const out = [];
    for (const r of filtered) {
      const reporter = await ctx.db.get(r.reporterId);
      const reported = await ctx.db.get(r.reportedUserId);
      out.push({
        ...r,
        reporterEmail: reporter?.email ?? null,
        reportedEmail: reported?.email ?? null,
      });
    }
    return out;
  },
});

export const resolveReport = mutation({
  args: {
    reportId: v.id("reports"),
    resolution: v.string(),
  },
  handler: withAuditLog(async (ctx, { reportId, resolution }) => {
    const { userId } = await requireRole(ctx, ["moderator", "super-admin"]);
    if (!resolution.trim()) {
      throw new ConvexError({
        code: "empty",
        message: "Resolution notes required",
      });
    }
    await ctx.db.patch(reportId, {
      resolvedAt: Date.now(),
      resolvedBy: userId,
      resolution: resolution.trim(),
    });
    return {
      action: "resolve-report",
      target: { type: "report", id: reportId },
      reason: resolution,
    };
  }),
});
