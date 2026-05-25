/**
 * Direct messages (Epic 10).
 *
 * Connected alumni only. Rate-limited per-recipient to prevent spam.
 * Threads are pair-keyed (userA < userB) so one row per relationship.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const MESSAGES_PER_RECIPIENT_PER_DAY = 30;
const MAX_LENGTH = 4000;

function pair(a: Id<"users">, b: Id<"users">): [Id<"users">, Id<"users">] {
  return a < b ? [a, b] : [b, a];
}

async function isConnected(
  ctx: QueryCtx | MutationCtx,
  meId: Id<"users">,
  otherId: Id<"users">,
): Promise<boolean> {
  const [userA, userB] = pair(meId, otherId);
  const row = await ctx.db
    .query("connections")
    .withIndex("by_pair", (q) => q.eq("userA", userA).eq("userB", userB))
    .unique();
  return !!row && row.status === "connected";
}

async function ensureThread(
  ctx: MutationCtx,
  me: Id<"users">,
  other: Id<"users">,
): Promise<Doc<"messageThreads">> {
  const [userA, userB] = pair(me, other);
  const existing = await ctx.db
    .query("messageThreads")
    .withIndex("by_pair", (q) => q.eq("userA", userA).eq("userB", userB))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("messageThreads", {
    userA,
    userB,
    lastMessageAt: Date.now(),
    lastMessagePreview: "",
    unreadForUserA: 0,
    unreadForUserB: 0,
  });
  return (await ctx.db.get(id))!;
}

// @no-audit-required: user self-service messaging.
export const sendMessage = mutation({
  args: {
    recipientId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, { recipientId, content }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (me === recipientId) {
      throw new ConvexError({
        code: "self-message",
        message: "Cannot message yourself",
      });
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new ConvexError({ code: "empty", message: "Message is empty" });
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new ConvexError({
        code: "too-long",
        message: `Message must be ${MAX_LENGTH} characters or fewer`,
      });
    }
    if (!(await isConnected(ctx, me, recipientId))) {
      throw new ConvexError({
        code: "not-connected",
        message: "You must be connected to message this alumna",
      });
    }

    // Per-recipient rate limit
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recent = await ctx.db
      .query("messages")
      .withIndex("by_recipient_sent", (q) =>
        q.eq("recipientId", recipientId).gte("sentAt", dayAgo),
      )
      .collect();
    const fromMe = recent.filter((m) => m.senderId === me).length;
    if (fromMe >= MESSAGES_PER_RECIPIENT_PER_DAY) {
      throw new ConvexError({
        code: "rate_limited",
        message: "Daily message limit reached for this recipient",
      });
    }

    const thread = await ensureThread(ctx, me, recipientId);
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      threadId: thread._id,
      senderId: me,
      recipientId,
      content: trimmed,
      sentAt: now,
    });
    const preview = trimmed.slice(0, 120);
    const isUserA = thread.userA === me;
    await ctx.db.patch(thread._id, {
      lastMessageAt: now,
      lastMessagePreview: preview,
      unreadForUserA: isUserA ? thread.unreadForUserA : thread.unreadForUserA + 1,
      unreadForUserB: isUserA ? thread.unreadForUserB + 1 : thread.unreadForUserB,
    });
    return { messageId, threadId: thread._id };
  },
});

export const listMyThreads = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];

    const asA = await ctx.db
      .query("messageThreads")
      .withIndex("by_lastA", (q) => q.eq("userA", me))
      .order("desc")
      .collect();
    const asB = await ctx.db
      .query("messageThreads")
      .withIndex("by_lastB", (q) => q.eq("userB", me))
      .order("desc")
      .collect();

    const merged = [...asA, ...asB].sort(
      (x, y) => y.lastMessageAt - x.lastMessageAt,
    );

    const out = [];
    for (const t of merged) {
      const otherId = t.userA === me ? t.userB : t.userA;
      const other = await ctx.db.get(otherId);
      const otherProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", otherId))
        .unique();
      out.push({
        threadId: t._id,
        otherUserId: otherId,
        otherName: otherProfile?.displayName ?? other?.name ?? "Alumna",
        otherSlug: otherProfile?.slug ?? null,
        lastMessageAt: t.lastMessageAt,
        lastMessagePreview: t.lastMessagePreview,
        unread:
          t.userA === me ? t.unreadForUserA : t.unreadForUserB,
      });
    }
    return out;
  },
});

export const getThread = query({
  args: { threadId: v.id("messageThreads") },
  handler: async (ctx, { threadId }) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const thread = await ctx.db.get(threadId);
    if (!thread) return null;
    if (thread.userA !== me && thread.userB !== me) return null;

    const otherId = thread.userA === me ? thread.userB : thread.userA;
    const otherProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", otherId))
      .unique();
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_time", (q) => q.eq("threadId", threadId))
      .order("asc")
      .take(200);
    return {
      threadId: thread._id,
      otherUserId: otherId,
      otherName: otherProfile?.displayName ?? null,
      otherSlug: otherProfile?.slug ?? null,
      messages: messages.map((m) => ({
        _id: m._id,
        senderId: m.senderId,
        content: m.content,
        sentAt: m.sentAt,
        readAt: m.readAt,
      })),
    };
  },
});

// @no-audit-required: user self-service marking their own thread read.
export const markThreadRead = mutation({
  args: { threadId: v.id("messageThreads") },
  handler: async (ctx, { threadId }) => {
    const me = await getAuthUserId(ctx);
    if (!me) return;
    const thread = await ctx.db.get(threadId);
    if (!thread) return;
    if (thread.userA !== me && thread.userB !== me) return;
    const patch =
      thread.userA === me
        ? { unreadForUserA: 0 }
        : { unreadForUserB: 0 };
    await ctx.db.patch(threadId, patch);
    // Mark individual messages read
    const unread = await ctx.db
      .query("messages")
      .withIndex("by_thread_time", (q) => q.eq("threadId", threadId))
      .collect();
    for (const m of unread) {
      if (m.recipientId === me && !m.readAt) {
        await ctx.db.patch(m._id, { readAt: Date.now() });
      }
    }
  },
});
