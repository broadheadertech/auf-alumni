/**
 * In-app notifications + per-category preferences (Epic 11).
 *
 * Notifications are persisted (so the bell dropdown can render history).
 * Preferences gate which channels fire — checked at the point of insertion.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";

export const DEFAULT_PREFS: Record<string, boolean> = {
  connectionRequestEmail: true,
  connectionRequestInApp: true,
  connectionAcceptedEmail: true,
  connectionAcceptedInApp: true,
  dmEmail: true,
  dmInApp: true,
  eventReminderEmail: true,
  eventReminderInApp: true,
  digestEmail: true,
  milestonesAuto: true,
};

export const getMyPrefs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("notificationPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return {
      prefs: { ...DEFAULT_PREFS, ...(row?.prefs ?? {}) },
      digestFrequency: row?.digestFrequency ?? "weekly",
    };
  },
});

// @no-audit-required: user self-service preferences.
export const updatePrefs = mutation({
  args: {
    prefs: v.optional(v.record(v.string(), v.boolean())),
    digestFrequency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const row = await ctx.db
      .query("notificationPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const nextPrefs = { ...(row?.prefs ?? {}), ...(args.prefs ?? {}) };
    const nextFreq = args.digestFrequency ?? row?.digestFrequency ?? "weekly";
    if (row) {
      await ctx.db.patch(row._id, {
        prefs: nextPrefs,
        digestFrequency: nextFreq,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("notificationPrefs", {
        userId,
        prefs: nextPrefs,
        digestFrequency: nextFreq,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const listMine = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("notifications")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 30);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .collect();
    return rows.filter((r) => !r.readAt).length;
  },
});

// @no-audit-required: user self-service mark-read.
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .collect();
    for (const n of unread) {
      if (!n.readAt) {
        await ctx.db.patch(n._id, { readAt: Date.now() });
      }
    }
  },
});

// @no-audit-required: user self-service mark-read.
export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const row = await ctx.db.get(notificationId);
    if (!row || row.userId !== userId) return;
    if (!row.readAt) {
      await ctx.db.patch(notificationId, { readAt: Date.now() });
    }
  },
});

/**
 * Insert a notification, gated by the recipient's prefs.
 * Called from server-side mutations that need to alert a user (e.g.
 * connection accept, DM, RSVP reminder). Idempotent in the sense that the
 * caller is responsible for not double-firing.
 */
export async function maybeInsertNotification(
  ctx: MutationCtx,
  recipientId: Id<"users">,
  channelKey: string,
  body: { kind: string; title: string; body: string; href?: string },
): Promise<boolean> {
  const prefsRow = await ctx.db
    .query("notificationPrefs")
    .withIndex("by_user", (q) => q.eq("userId", recipientId))
    .unique();
  const enabled =
    prefsRow?.prefs?.[channelKey] ??
    DEFAULT_PREFS[channelKey] ??
    true;
  if (!enabled) return false;
  await ctx.db.insert("notifications", {
    userId: recipientId,
    kind: body.kind,
    title: body.title,
    body: body.body,
    href: body.href,
    createdAt: Date.now(),
  });
  return true;
}

/**
 * Weekly digest scheduling — selects users whose digestFrequency is "weekly"
 * and schedules an internal action per user. Run weekly via cron.
 */
export const scheduleWeeklyDigests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let scheduled = 0;
    for (const u of users) {
      if (u.deletedAt || u.suspendedAt || !u.email) continue;
      const prefs = await ctx.db
        .query("notificationPrefs")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .unique();
      const wantsDigest =
        (prefs?.digestFrequency ?? "weekly") === "weekly" &&
        (prefs?.prefs?.digestEmail ?? DEFAULT_PREFS.digestEmail);
      if (!wantsDigest) continue;
      // Defer the actual compose+send to an internal action so we don't
      // block this mutation transaction on external IO. 500ms stagger keeps
      // the dispatch rate at ~2 sends/sec (Resend's default rate limit).
      await ctx.scheduler.runAfter(
        scheduled * 500,
        internal.actions.sendDigestEmail.sendDigestEmail,
        { userId: u._id },
      );
      scheduled += 1;
    }
    return { scheduled };
  },
});
