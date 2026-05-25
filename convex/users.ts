/**
 * User queries and post-signup bootstrap mutation (Epic 2).
 *
 * - getMe: returns the authenticated user's record + role list, or null.
 * - bootstrapAfterSignup: sets roles, DPA-consent timestamp, and default
 *   plan-tier on a fresh Convex Auth user record. Called from the client
 *   immediately after `signIn("password", { flow: "signUp", ... })` resolves.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt) return null;
    return user;
  },
});

/**
 * Idempotent post-signup setup. Convex Auth creates the row with `email`
 * already populated; we add our domain fields. Safe to call multiple times.
 */
export const bootstrapAfterSignup = mutation({
  args: {
    consentVersion: v.string(),
  },
  handler: async (ctx, { consentVersion }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError({
        code: "user-not-found",
        message: "Auth user missing — Convex Auth setup may have failed",
      });
    }

    // Idempotent: if roles already set, only refresh lastLoginAt.
    if (user.roles && user.roles.length > 0) {
      await ctx.db.patch(userId, { lastLoginAt: Date.now() });
      return { userId, alreadyBootstrapped: true };
    }

    const now = Date.now();
    await ctx.db.patch(userId, {
      roles: ["alumnus-pending"],
      createdAt: now,
      lastLoginAt: now,
      consentAcknowledgedAt: now,
      consentVersion,
      planTier: "free",
    });
    return { userId, alreadyBootstrapped: false };
  },
});
