/**
 * Server-side role-based access control (Story 1.4) — invariant for NFR12.
 *
 * Every admin / moderation mutation MUST call `requireRole` before any other
 * logic. The lint script at web/scripts/lint-admin-mutations.mjs enforces this
 * alongside `withAuditLog`.
 */

import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type Role =
  | "alumnus-pending"
  | "alumnus"
  | "current-student"
  | "partner-employer-admin"
  | "verified-employer-admin"
  | "moderator"
  | "verifier"
  | "super-admin";

export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  allowed: Role[],
): Promise<{ userId: Id<"users">; user: Doc<"users"> }> {
  // Convex Auth populates a stable user ID via `getAuthUserId`. The older
  // `ctx.auth.getUserIdentity()` returns an OpenID-style identity whose
  // `email` claim isn't guaranteed by Convex Auth's Password provider, so
  // that path was throwing "Sign in required" even for valid sessions.
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError({
      code: "unauthenticated",
      message: "Sign in required",
    });
  }
  const user = await ctx.db.get(userId);
  if (!user || user.deletedAt) {
    throw new ConvexError({
      code: "unauthenticated",
      message: "Account not found",
    });
  }
  if (user.suspendedAt) {
    throw new ConvexError({
      code: "suspended",
      message: "Account suspended",
    });
  }

  const hasRole = (user.roles ?? []).some((r) => allowed.includes(r as Role));
  if (!hasRole) {
    throw new ConvexError({
      code: "forbidden",
      message: `Requires one of: ${allowed.join(", ")}`,
    });
  }
  return { userId, user };
}
