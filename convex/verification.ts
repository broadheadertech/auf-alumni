/**
 * Verification flow (Epic 2 Stories 2.2, 2.3, 2.4).
 *
 * - submitManual: alumnus uploads ID + diploma; queues for admin review
 * - getMyVerification: real-time status for the alumna's status page (NFR6)
 * - tryFastPathVerify: school-email-domain-matched users skip the queue
 *
 * All admin-side actions (approve/reject/info-request/escalate) live in
 * convex/admin.ts and are wrapped with withAuditLog + requireRole per
 * Story 1.4 invariants.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { lookupAlumnus } from "./helpers/registry";

const AUF_DOMAINS_DEFAULT = ["auf.edu.ph", "students.auf.edu.ph"];

function getAufDomains(): string[] {
  const raw = process.env.AUF_EMAIL_DOMAINS;
  if (!raw) return AUF_DOMAINS_DEFAULT;
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);
}

export function isAufEmailDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return getAufDomains().includes(domain);
}

/**
 * Fast-path: when the user's email matches a configured AUF domain, mark them
 * verified immediately. Called from the post-signup hook and idempotent.
 */
// @no-audit-required: user self-service mutation; writes its own audit entry inline.
export const tryFastPathVerify = mutation({
  args: {
    claimedName: v.string(),
    claimedBatch: v.number(),
    claimedProgram: v.string(),
  },
  handler: async (ctx, { claimedName, claimedBatch, claimedProgram }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError({ code: "user-not-found", message: "User missing" });
    }
    const roles = user.roles ?? [];
    if (roles.includes("alumnus")) {
      // Already verified — idempotent no-op
      return { status: "approved-fast-path", alreadyVerified: true };
    }
    if (!user.email || !isAufEmailDomain(user.email)) {
      return { status: "manual-path-required", alreadyVerified: false };
    }

    const now = Date.now();
    const submissionId = await ctx.db.insert("verificationSubmissions", {
      userId,
      claimedName,
      claimedBatch,
      claimedProgram,
      registryMatched: false, // not consulted on fast path
      flags: [],
      status: "approved-fast-path",
      statusReason: "school-email-fast-path",
      decidedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(userId, {
      roles: [...new Set([...roles.filter((r) => r !== "alumnus-pending"), "alumnus"])],
    });

    await ctx.db.insert("auditEntries", {
      actorId: undefined,
      actorType: "system",
      actionType: "approve-verification",
      targetType: "verificationSubmission",
      targetId: submissionId,
      reason: "school-email-fast-path",
      timestamp: now,
    });

    return { status: "approved-fast-path", alreadyVerified: false };
  },
});

/**
 * Manual verification path: alumna uploads ID + diploma, system snapshots the
 * registry hook result, queues for admin review.
 */
// @no-audit-required: user self-service; no privileged action taken. Admin decision in admin.ts is audit-wrapped.
export const submitManual = mutation({
  args: {
    claimedName: v.string(),
    claimedBatch: v.number(),
    claimedProgram: v.string(),
    idStorageId: v.id("_storage"),
    diplomaStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }

    // Call registry hook (stub returns no-match in v1)
    const registry = await lookupAlumnus({
      name: args.claimedName,
      batch: args.claimedBatch,
      program: args.claimedProgram,
    });

    const flags: string[] = [];
    if (!registry.matched) flags.push("no-registry-match");
    else if ((registry.confidence ?? 1) < 0.85) flags.push("name-mismatch");

    const now = Date.now();
    const submissionId = await ctx.db.insert("verificationSubmissions", {
      userId,
      claimedName: args.claimedName,
      claimedBatch: args.claimedBatch,
      claimedProgram: args.claimedProgram,
      idStorageId: args.idStorageId,
      diplomaStorageId: args.diplomaStorageId,
      registryMatched: registry.matched,
      registryConfidence: registry.confidence,
      registryRecordSnapshot: registry.record,
      flags,
      status: "pending-review",
      createdAt: now,
      updatedAt: now,
    });

    // Notify the alumna asynchronously (NFR30 retry inside the action)
    const user = await ctx.db.get(userId);
    if (user?.email) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.sendVerificationEmail.sendVerificationEmail,
        {
          to: user.email,
          recipientName: user.name ?? args.claimedName,
          kind: "submitted",
        },
      );
    }

    return { submissionId, status: "pending-review" };
  },
});

/**
 * Get the current authenticated user's most recent verification submission.
 * Powers the in-flight status page (Story 2.4). Convex subscription keeps
 * it real-time (NFR6).
 */
export const getMyVerification = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const submissions = await ctx.db
      .query("verificationSubmissions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);
    return submissions[0] ?? null;
  },
});

/**
 * Re-trigger or update a verification submission after rejection / info-request.
 * The new submission replaces the previous one in user-facing UI.
 */
// @no-audit-required: user self-service; no privileged action taken.
export const updateSubmission = mutation({
  args: {
    claimedName: v.string(),
    claimedBatch: v.number(),
    claimedProgram: v.string(),
    idStorageId: v.optional(v.id("_storage")),
    diplomaStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }

    const prior = await ctx.db
      .query("verificationSubmissions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);
    const last = prior[0];

    if (!last || last.status === "approved" || last.status === "approved-fast-path") {
      throw new ConvexError({
        code: "no-actionable-submission",
        message: "No pending or rejected submission to update",
      });
    }

    // Re-query the registry against the updated claim
    const registry = await lookupAlumnus({
      name: args.claimedName,
      batch: args.claimedBatch,
      program: args.claimedProgram,
    });
    const flags: string[] = [];
    if (!registry.matched) flags.push("no-registry-match");
    else if ((registry.confidence ?? 1) < 0.85) flags.push("name-mismatch");

    const now = Date.now();
    await ctx.db.patch(last._id, {
      claimedName: args.claimedName,
      claimedBatch: args.claimedBatch,
      claimedProgram: args.claimedProgram,
      idStorageId: args.idStorageId ?? last.idStorageId,
      diplomaStorageId: args.diplomaStorageId ?? last.diplomaStorageId,
      registryMatched: registry.matched,
      registryConfidence: registry.confidence,
      registryRecordSnapshot: registry.record,
      flags,
      status: "pending-review",
      statusReason: undefined,
      decidedAt: undefined,
      decidedBy: undefined,
      updatedAt: now,
    });

    return { submissionId: last._id, status: "pending-review" };
  },
});

/**
 * Generate a short-lived upload URL for an ID or diploma photo.
 * Story 2.3 — used by the manual upload form.
 */
// @no-audit-required: user self-service helper that only mints an ephemeral upload token.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    return await ctx.storage.generateUploadUrl();
  },
});
