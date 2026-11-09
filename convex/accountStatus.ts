/**
 * Admin account lifecycle for alumni and employers — Deactivate, Reject,
 * Reactivate — stored on the same `suspendedAt` / `suspendedReason` fields the
 * rest of the system already enforces:
 *
 *   - alumni → `users`: requireRole blocks sign-in, the directory hides them,
 *     and User management shows them as suspended;
 *   - employers → `employerOrgs`: hidden from company pages and the job board,
 *     and their admins can't message applicants.
 *
 * `suspendedKind` records *why* ("deactivated" | "rejected" | "suspended").
 * Replaces the prototype's localStorage store (src/lib/account-status.ts).
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";

const ADMIN_ROLES = ["moderator", "super-admin"] as const;
const kindValidator = v.union(v.literal("deactivated"), v.literal("rejected"));
type Kind = "deactivated" | "rejected";

export type AccountStatusView = {
  kind: "deactivated" | "rejected" | "suspended";
  at: number;
  reason: string;
} | null;

/** Shared read helper for roster/detail queries. */
export function accountStatusOf(
  row: Pick<Doc<"users">, "suspendedAt" | "suspendedReason" | "suspendedKind"> |
    Pick<Doc<"employerOrgs">, "suspendedAt" | "suspendedReason" | "suspendedKind"> |
    null | undefined,
): AccountStatusView {
  if (!row?.suspendedAt) return null;
  const kind = row.suspendedKind === "rejected" || row.suspendedKind === "deactivated"
    ? row.suspendedKind
    : "suspended";
  return { kind, at: row.suspendedAt, reason: row.suspendedReason ?? "" };
}

function requireReason(reason: string): string {
  const r = reason.trim();
  if (!r) throw new ConvexError({ code: "reason-required", message: "A reason is required" });
  if (r.length > 500) {
    throw new ConvexError({ code: "validation", message: "Reason must be 500 characters or fewer" });
  }
  return r;
}

export const setAlumnusStatus = mutation({
  args: { profileId: v.id("profiles"), kind: kindValidator, reason: v.string() },
  handler: withAuditLog(async (ctx, args: { profileId: Id<"profiles">; kind: Kind; reason: string }) => {
    const { userId } = await requireRole(ctx, [...ADMIN_ROLES]);
    const reason = requireReason(args.reason);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new ConvexError({ code: "not-found", message: "Alumnus not found" });
    if (profile.userId === userId) {
      throw new ConvexError({ code: "self-lockout", message: "You can't deactivate your own account" });
    }
    await ctx.db.patch(profile.userId, {
      suspendedAt: Date.now(),
      suspendedReason: reason,
      suspendedKind: args.kind,
    });
    return {
      action: `${args.kind === "rejected" ? "reject" : "deactivate"}-alumnus`,
      target: { type: "user", id: profile.userId },
      reason,
      metadata: { profileId: profile._id, name: profile.displayName },
    };
  }),
});

export const reactivateAlumnus = mutation({
  args: { profileId: v.id("profiles") },
  handler: withAuditLog(async (ctx, { profileId }: { profileId: Id<"profiles"> }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new ConvexError({ code: "not-found", message: "Alumnus not found" });
    await ctx.db.patch(profile.userId, {
      suspendedAt: undefined,
      suspendedReason: undefined,
      suspendedKind: undefined,
    });
    return {
      action: "reactivate-alumnus",
      target: { type: "user", id: profile.userId },
      metadata: { profileId, name: profile.displayName },
    };
  }),
});

export const setEmployerStatus = mutation({
  args: { employerOrgId: v.id("employerOrgs"), kind: kindValidator, reason: v.string() },
  handler: withAuditLog(async (ctx, args: { employerOrgId: Id<"employerOrgs">; kind: Kind; reason: string }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const reason = requireReason(args.reason);
    const org = await ctx.db.get(args.employerOrgId);
    if (!org) throw new ConvexError({ code: "not-found", message: "Employer not found" });
    await ctx.db.patch(org._id, {
      suspendedAt: Date.now(),
      suspendedReason: reason,
      suspendedKind: args.kind,
      updatedAt: Date.now(),
    });
    return {
      action: `${args.kind === "rejected" ? "reject" : "deactivate"}-employer`,
      target: { type: "employerOrg", id: org._id },
      reason,
      metadata: { name: org.name },
    };
  }),
});

export const reactivateEmployer = mutation({
  args: { employerOrgId: v.id("employerOrgs") },
  handler: withAuditLog(async (ctx, { employerOrgId }: { employerOrgId: Id<"employerOrgs"> }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const org = await ctx.db.get(employerOrgId);
    if (!org) throw new ConvexError({ code: "not-found", message: "Employer not found" });
    await ctx.db.patch(org._id, {
      suspendedAt: undefined,
      suspendedReason: undefined,
      suspendedKind: undefined,
      updatedAt: Date.now(),
    });
    return {
      action: "reactivate-employer",
      target: { type: "employerOrg", id: org._id },
      metadata: { name: org.name },
    };
  }),
});
