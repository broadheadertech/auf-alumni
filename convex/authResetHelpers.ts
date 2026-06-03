/**
 * V8-runtime helpers for the password-reset flow in `authReset.ts`.
 * Lives in a separate (non-node) file because `"use node"` modules can't
 * declare mutations.
 */

import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

export const findPasswordAccount = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (!user) return null;
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    if (!account) return null;
    return { userId: user._id, accountId: account._id };
  },
});

export const storeResetToken = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { userId, token, expiresAt }) => {
    await ctx.db.insert("passwordResetTokens", {
      userId,
      token,
      expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const consumeResetToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!row) return null;
    if (row.usedAt != null) return null;
    if (row.expiresAt < Date.now()) return null;
    await ctx.db.patch(row._id, { usedAt: Date.now() });
    return { userId: row.userId };
  },
});

export const updatePasswordHash = internalMutation({
  args: {
    userId: v.id("users"),
    passwordHash: v.string(),
  },
  handler: async (ctx, { userId, passwordHash }) => {
    const user = await ctx.db.get(userId);
    if (!user || !user.email) {
      // No email — nothing to do.
      return;
    }
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", user.email!),
      )
      .unique();
    if (!account) return;
    await ctx.db.patch(account._id, { secret: passwordHash });
  },
});

// Public-facing wrappers — the actual logic + Scrypt hashing lives in the
// `"use node"` actions; these wrappers just expose them at predictable
// `api.*` paths for the frontend to call from `useAction`.
export const requestPasswordReset = action({
  args: { email: v.string() },
  handler: async (
    ctx,
    { email },
  ): Promise<{ ok: true; resetUrl?: string }> => {
    return await ctx.runAction(internal.authReset.requestPasswordReset, {
      email,
    });
  },
});

export const resetPassword = action({
  args: { token: v.string(), newPassword: v.string() },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    return await ctx.runAction(internal.authReset.resetPassword, args);
  },
});
