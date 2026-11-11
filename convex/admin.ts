/**
 * Admin verification queue mutations (Epic 2 Story 2.5; expanded in Epic 6).
 *
 * Every mutation in this file MUST use `withAuditLog` + `requireRole` per the
 * NFR11/NFR12 invariants. The lint script at scripts/lint-admin-mutations.mjs
 * enforces this.
 *
 * Each decision mutation schedules an internal email action to notify the
 * alumna of the status change (NFR30 — retry handled inside the action).
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";
import { pageOf } from "./helpers/paging";

export const approveVerification = mutation({
  args: { submissionId: v.id("verificationSubmissions") },
  handler: withAuditLog(async (ctx, { submissionId }: { submissionId: Id<"verificationSubmissions"> }) => {
    await requireRole(ctx, ["verifier", "super-admin"]);
    const submission = await ctx.db.get(submissionId);
    if (!submission) {
      throw new ConvexError({
        code: "not-found",
        message: "Submission not found",
      });
    }
    if (
      submission.status === "approved" ||
      submission.status === "approved-fast-path"
    ) {
      throw new ConvexError({
        code: "already-decided",
        message: "Submission is already approved",
      });
    }

    const now = Date.now();
    const { userId } = (await requireRole(ctx, ["verifier", "super-admin"]));

    await ctx.db.patch(submissionId, {
      status: "approved",
      statusReason: undefined,
      decidedAt: now,
      decidedBy: userId,
      updatedAt: now,
    });

    const user = await ctx.db.get(submission.userId);
    if (user) {
      await ctx.db.patch(submission.userId, {
        roles: [
          ...new Set([
            ...(user.roles ?? []).filter((r) => r !== "alumnus-pending"),
            "alumnus",
          ]),
        ],
      });
      if (user.email) {
        await ctx.scheduler.runAfter(
          0,
          internal.actions.sendVerificationEmail.sendVerificationEmail,
          {
            to: user.email,
            recipientName: user.name ?? submission.claimedName,
            kind: "approved",
          },
        );
      }
    }

    return {
      action: "approve-verification",
      target: { type: "verificationSubmission", id: submissionId },
      reason: "manual-admin-approval",
    };
  }),
});

export const rejectVerification = mutation({
  args: {
    submissionId: v.id("verificationSubmissions"),
    reason: v.string(),
  },
  handler: withAuditLog(async (ctx, { submissionId, reason }: { submissionId: Id<"verificationSubmissions">; reason: string }) => {
    await requireRole(ctx, ["verifier", "super-admin"]);
    if (!reason || reason.trim().length === 0) {
      throw new ConvexError({
        code: "reason-required",
        message: "Reject reason is required",
      });
    }
    const submission = await ctx.db.get(submissionId);
    if (!submission) {
      throw new ConvexError({
        code: "not-found",
        message: "Submission not found",
      });
    }

    const now = Date.now();
    const { userId } = await requireRole(ctx, ["verifier", "super-admin"]);

    await ctx.db.patch(submissionId, {
      status: "rejected",
      statusReason: reason,
      decidedAt: now,
      decidedBy: userId,
      updatedAt: now,
    });

    const user = await ctx.db.get(submission.userId);
    if (user?.email) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.sendVerificationEmail.sendVerificationEmail,
        {
          to: user.email,
          recipientName: user.name ?? submission.claimedName,
          kind: "rejected",
          message: reason,
        },
      );
    }

    return {
      action: "reject-verification",
      target: { type: "verificationSubmission", id: submissionId },
      reason,
    };
  }),
});

export const requestVerificationInfo = mutation({
  args: {
    submissionId: v.id("verificationSubmissions"),
    message: v.string(),
  },
  handler: withAuditLog(async (ctx, { submissionId, message }: { submissionId: Id<"verificationSubmissions">; message: string }) => {
    await requireRole(ctx, ["verifier", "super-admin"]);
    if (!message || message.trim().length === 0) {
      throw new ConvexError({
        code: "message-required",
        message: "Message is required when requesting more info",
      });
    }
    const submission = await ctx.db.get(submissionId);
    if (!submission) {
      throw new ConvexError({
        code: "not-found",
        message: "Submission not found",
      });
    }

    const now = Date.now();
    const { userId } = await requireRole(ctx, ["verifier", "super-admin"]);

    await ctx.db.patch(submissionId, {
      status: "info-requested",
      statusReason: message,
      decidedBy: userId,
      updatedAt: now,
    });

    const user = await ctx.db.get(submission.userId);
    if (user?.email) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.sendVerificationEmail.sendVerificationEmail,
        {
          to: user.email,
          recipientName: user.name ?? submission.claimedName,
          kind: "info-requested",
          message,
        },
      );
    }

    return {
      action: "request-verification-info",
      target: { type: "verificationSubmission", id: submissionId },
      reason: message,
    };
  }),
});

export const escalateVerification = mutation({
  args: {
    submissionId: v.id("verificationSubmissions"),
    reason: v.string(),
  },
  handler: withAuditLog(async (ctx, { submissionId, reason }: { submissionId: Id<"verificationSubmissions">; reason: string }) => {
    await requireRole(ctx, ["verifier", "super-admin"]);
    if (!reason || reason.trim().length === 0) {
      throw new ConvexError({
        code: "reason-required",
        message: "Escalation reason is required",
      });
    }
    const submission = await ctx.db.get(submissionId);
    if (!submission) {
      throw new ConvexError({
        code: "not-found",
        message: "Submission not found",
      });
    }

    const now = Date.now();
    const { userId } = await requireRole(ctx, ["verifier", "super-admin"]);

    await ctx.db.patch(submissionId, {
      status: "escalated",
      statusReason: reason,
      decidedBy: userId,
      updatedAt: now,
    });

    return {
      action: "escalate-verification",
      target: { type: "verificationSubmission", id: submissionId },
      reason,
    };
  }),
});

// ============================================================================
// Admin queries (Epic 6)
// ============================================================================

/**
 * Admin dashboard metrics — queue depth, oldest pending, weekly throughput,
 * median turnaround vs ≤24h target (NFR17).
 */
export const dashboardMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["verifier", "moderator", "super-admin"]);

    const pending = await ctx.db
      .query("verificationSubmissions")
      .withIndex("by_status_time", (q) => q.eq("status", "pending-review"))
      .collect();
    const flagged = pending.filter((s) => (s.flags ?? []).length > 0);
    const now = Date.now();
    const oldestAgeMs =
      pending.length === 0
        ? 0
        : Math.max(...pending.map((s) => now - s.createdAt));

    // Throughput this week + median turnaround
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const approvedThisWeek = await ctx.db
      .query("verificationSubmissions")
      .withIndex("by_status_decided", (q) =>
        q.eq("status", "approved").gte("decidedAt", oneWeekAgo),
      )
      .collect();
    const turnarounds = approvedThisWeek
      .map((s) => (s.decidedAt ?? 0) - s.createdAt)
      .filter((d) => d > 0)
      .sort((a, b) => a - b);
    const median =
      turnarounds.length === 0
        ? 0
        : turnarounds[Math.floor(turnarounds.length / 2)];
    const targetMs = 24 * 60 * 60 * 1000;

    return {
      queueDepth: pending.length,
      flaggedCount: flagged.length,
      oldestPendingAgeMs: oldestAgeMs,
      approvedThisWeek: approvedThisWeek.length,
      medianTurnaroundMs: median,
      targetTurnaroundMs: targetMs,
      onTrack: median === 0 || median <= targetMs,
    };
  },
});

/**
 * Verification queue (Story 6.2). Returns pending submissions newest-first,
 * with the relevant user context attached for the side-by-side review UI.
 */
export const verificationQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["verifier", "super-admin"]);

    const submissions = await ctx.db
      .query("verificationSubmissions")
      .withIndex("by_status_time", (q) => q.eq("status", "pending-review"))
      .order("desc")
      .take(50);

    const out = [];
    for (const s of submissions) {
      const user = await ctx.db.get(s.userId);
      out.push({
        submissionId: s._id,
        userId: s.userId,
        userEmail: user?.email,
        claimedName: s.claimedName,
        claimedBatch: s.claimedBatch,
        claimedProgram: s.claimedProgram,
        flags: s.flags ?? [],
        registryMatched: s.registryMatched,
        registryConfidence: s.registryConfidence,
        registryRecordSnapshot: s.registryRecordSnapshot,
        createdAt: s.createdAt,
        ageMs: Date.now() - s.createdAt,
      });
    }
    return out;
  },
});

/**
 * Audit log viewer with filters (Story 6.5).
 */
/**
 * Upper bound on the audit window a single request will read.
 *
 * auditEntries is the fastest-growing table in the schema -- every audited
 * mutation appends to it and nothing prunes it -- so an unbounded read here
 * would get slower every day the system is used. 5000 rows is far more than
 * anyone pages through, and `atCap` tells the client when it was hit.
 */
const AUDIT_SCAN_CAP = 5000;

export const auditLog = query({
  args: {
    actionType: v.optional(v.string()),
    targetType: v.optional(v.string()),
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    /** Offset cursor from a previous page's `continueCursor`. */
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["verifier", "moderator", "super-admin"]);
    // Newest-first window. Bounded, because this is the fastest-growing table
    // in the schema -- every audited mutation adds a row forever.
    const candidates = args.actionType
      ? await ctx.db
          .query("auditEntries")
          .withIndex("by_action_time", (q) => q.eq("actionType", args.actionType!))
          .order("desc")
          .take(AUDIT_SCAN_CAP)
      : await ctx.db
          .query("auditEntries")
          .order("desc")
          .take(AUDIT_SCAN_CAP);
    const atCap = candidates.length >= AUDIT_SCAN_CAP;

    // Filter the whole window BEFORE paging it. These three ran after the
    // take, so asking for targetType "event" returned only the event rows
    // that happened to fall inside the newest page -- not the matching ones.
    let matched = candidates;
    if (args.targetType) {
      matched = matched.filter((r) => r.targetType === args.targetType);
    }
    if (args.fromMs) {
      matched = matched.filter((r) => r.timestamp >= args.fromMs!);
    }
    if (args.toMs) {
      matched = matched.filter((r) => r.timestamp <= args.toMs!);
    }
    const sliced = pageOf(matched, args);
    const rows = sliced.page;

    // Attach actor email for display (with self-fetched IDs to be DB-safe)
    const out: Array<
      (typeof rows)[number] & { actorEmail: string | null }
    > = [];
    for (const r of rows) {
      let email: string | null = null;
      if (r.actorId) {
        const actor = await ctx.db.get(r.actorId);
        email = actor?.email ?? null;
      }
      out.push({ ...r, actorEmail: email });
    }
    return {
      ...sliced,
      // `out` is `sliced.page` with actor emails attached, same order, same
      // length — so the counts above still describe it.
      page: out,
      /**
       * True when the bounded window was full, so `total` counts the newest
       * AUDIT_SCAN_CAP entries rather than the whole table. The UI says so
       * rather than presenting the window as the complete history -- showing a
       * truncated audit trail as if it were everything is the failure this
       * query already had.
       */
      atCap,
    };
  },
});

/**
 * User listing for admin role-management surface (Story 6.7). Limited fields.
 */
export const listUsers = query({
  args: {
    search: v.optional(v.string()),
    /** Only users holding this role; "none" = users with no roles. */
    role: v.optional(v.string()),
    /** "active" | "suspended" | "deleted" */
    status: v.optional(v.string()),
    pageSize: v.optional(v.number()),
    /** Offset cursor from a previous page's `continueCursor`. */
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { search, role, status, pageSize: rawPageSize, cursor }) => {
    await requireRole(ctx, ["super-admin"]);
    // Filter the whole table, then cap. (Capping first meant search only saw
    // the first 100 users, so results disagreed with what's in the database.)
    // @full-scan-ok: admin user list with no filter applied; the fix here is pagination, not an index
    const rows = await ctx.db.query("users").collect();
    const q = (search ?? "").trim().toLowerCase();
    const filtered = rows.filter((u) => {
      if (q && !`${u.email ?? ""} ${u.name ?? ""}`.toLowerCase().includes(q)) return false;
      const roles = u.roles ?? [];
      if (role === "none" ? roles.length > 0 : role && !roles.includes(role)) return false;
      const state = u.deletedAt ? "deleted" : u.suspendedAt ? "suspended" : "active";
      if (status && state !== status) return false;
      return true;
    });
    // The page used to ask for 500 and paginate those in the browser, so a
    // 501st account could not be reached and the summary line reported the
    // cap as the total.
    const sliced = pageOf(filtered, { cursor, pageSize: rawPageSize });
    return {
      ...sliced,
      page: sliced.page.map((u) => ({
        _id: u._id,
        email: u.email ?? null,
        name: u.name ?? null,
        roles: u.roles ?? [],
        suspendedAt: u.suspendedAt ?? null,
        deletedAt: u.deletedAt ?? null,
        createdAt: u.createdAt ?? null,
      })),
    };
  },
});

// ============================================================================
// Admin mutations: role mgmt, suspend, weekly report compose
// ============================================================================

export const grantRole = mutation({
  args: { targetUserId: v.id("users"), role: v.string() },
  handler: withAuditLog(async (ctx, { targetUserId, role }: { targetUserId: Id<"users">; role: string }) => {
    await requireRole(ctx, ["super-admin"]);
    const target = await ctx.db.get(targetUserId);
    if (!target) {
      throw new ConvexError({ code: "not-found", message: "User not found" });
    }
    const next = [...new Set([...(target.roles ?? []), role])];
    await ctx.db.patch(targetUserId, { roles: next });
    return {
      action: "grant-role",
      target: { type: "user", id: targetUserId },
      reason: "admin-granted",
      metadata: { role },
    };
  }),
});

export const revokeRole = mutation({
  args: { targetUserId: v.id("users"), role: v.string() },
  handler: withAuditLog(async (ctx, { targetUserId, role }: { targetUserId: Id<"users">; role: string }) => {
    const { userId: actorId } = await requireRole(ctx, ["super-admin"]);
    if (actorId === targetUserId && role === "super-admin") {
      throw new ConvexError({
        code: "self-lockout",
        message: "Cannot remove your own super-admin role",
      });
    }
    const target = await ctx.db.get(targetUserId);
    if (!target) {
      throw new ConvexError({ code: "not-found", message: "User not found" });
    }
    const next = (target.roles ?? []).filter((r) => r !== role);
    await ctx.db.patch(targetUserId, { roles: next });
    return {
      action: "revoke-role",
      target: { type: "user", id: targetUserId },
      reason: "admin-revoked",
      metadata: { role },
    };
  }),
});

export const suspendUser = mutation({
  args: { targetUserId: v.id("users"), reason: v.string() },
  handler: withAuditLog(async (ctx, { targetUserId, reason }: { targetUserId: Id<"users">; reason: string }) => {
    await requireRole(ctx, ["super-admin"]);
    if (!reason || reason.trim().length === 0) {
      throw new ConvexError({
        code: "reason-required",
        message: "Suspension reason is required",
      });
    }
    const target = await ctx.db.get(targetUserId);
    if (!target) {
      throw new ConvexError({ code: "not-found", message: "User not found" });
    }
    await ctx.db.patch(targetUserId, {
      suspendedAt: Date.now(),
      suspendedReason: reason,
      suspendedKind: "suspended",
    });
    return {
      action: "suspend-user",
      target: { type: "user", id: targetUserId },
      reason,
    };
  }),
});

export const unsuspendUser = mutation({
  args: { targetUserId: v.id("users") },
  handler: withAuditLog(async (ctx, { targetUserId }: { targetUserId: Id<"users"> }) => {
    await requireRole(ctx, ["super-admin"]);
    const target = await ctx.db.get(targetUserId);
    if (!target) {
      throw new ConvexError({ code: "not-found", message: "User not found" });
    }
    await ctx.db.patch(targetUserId, {
      suspendedAt: undefined,
      suspendedReason: undefined,
      suspendedKind: undefined,
    });
    return {
      action: "unsuspend-user",
      target: { type: "user", id: targetUserId },
      reason: "admin-unsuspended",
    };
  }),
});
