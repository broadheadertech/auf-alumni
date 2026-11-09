/**
 * Direct messages (Epic 10).
 *
 * Who can message whom (`canMessage`):
 *   - any verified alumnus → any other verified alumnus (connection not
 *     required; blocks and the per-recipient rate limit still apply);
 *   - an employer admin → anyone who applied to one of that employer's
 *     postings (the application is the consent to be contacted);
 *   - that applicant → the employer admin, but only replying in a thread the
 *     employer started (applicants can't cold-message recruiters).
 * Rate-limited per recipient. Threads are pair-keyed (userA < userB) so one
 * row per relationship.
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
import { internal } from "./_generated/api";
import { isChannelEnabled, maybeInsertNotification } from "./notifications";

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

/** True if `applicantId` applied to a posting of an org `employerUserId` administers. */
async function appliedToEmployerOf(
  ctx: QueryCtx | MutationCtx,
  employerUserId: Id<"users">,
  applicantId: Id<"users">,
): Promise<boolean> {
  const apps = await ctx.db
    .query("applications")
    .withIndex("by_applicant_time", (q) => q.eq("applicantId", applicantId))
    .collect();
  for (const a of apps) {
    const job = await ctx.db.get(a.jobId);
    if (!job) continue;
    if (job.createdBy === employerUserId) return true;
    const org = await ctx.db.get(job.employerOrgId);
    if (org && !org.suspendedAt && (org.adminUserIds ?? []).includes(employerUserId)) {
      return true;
    }
  }
  return false;
}

async function findThread(
  ctx: QueryCtx | MutationCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<Doc<"messageThreads"> | null> {
  const [userA, userB] = pair(a, b);
  return ctx.db
    .query("messageThreads")
    .withIndex("by_pair", (q) => q.eq("userA", userA).eq("userB", userB))
    .unique();
}

/** Verified alumni can reach each other directly (both sides verified). */
async function bothVerifiedAlumni(
  ctx: QueryCtx | MutationCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<boolean> {
  const profiles = await Promise.all(
    [a, b].map((id) =>
      ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", id))
        .unique(),
    ),
  );
  return profiles.every((p) => p?.verifiedAt != null);
}

async function canMessage(
  ctx: QueryCtx | MutationCtx,
  me: Id<"users">,
  other: Id<"users">,
): Promise<boolean> {
  if (await isConnected(ctx, me, other)) return true;
  if (await bothVerifiedAlumni(ctx, me, other)) return true;
  if (await appliedToEmployerOf(ctx, me, other)) return true;
  // Applicant replying to an employer who already opened the conversation.
  if (await appliedToEmployerOf(ctx, other, me)) {
    const thread = await findThread(ctx, me, other);
    return !!thread && thread.lastMessagePreview !== "";
  }
  return false;
}

/** How the recipient should be addressed and where their inbox lives. */
async function inboxOf(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const user = await ctx.db.get(userId);
  return {
    name: profile?.displayName ?? user?.name ?? null,
    email: user?.email ?? null,
    // Employer admins (no alumni profile) read messages on the employer surface.
    href: profile ? "/messages" : "/employer/messages",
  };
}

/** Employer org names a user administers (labels employer threads). */
async function employerLabel(ctx: QueryCtx, userId: Id<"users">): Promise<string | null> {
  const orgs = await ctx.db.query("employerOrgs").collect();
  const names = orgs.filter((o) => (o.adminUserIds ?? []).includes(userId)).map((o) => o.name);
  return names.length ? names.join(", ") : null;
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
    if (!(await canMessage(ctx, me, recipientId))) {
      throw new ConvexError({
        code: "not-connected",
        message:
          "You can message verified alumni, and applicants to your postings",
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
    const unreadBefore = isUserA ? thread.unreadForUserB : thread.unreadForUserA;
    await ctx.db.patch(thread._id, {
      lastMessageAt: now,
      lastMessagePreview: preview,
      unreadForUserA: isUserA ? thread.unreadForUserA : thread.unreadForUserA + 1,
      unreadForUserB: isUserA ? thread.unreadForUserB + 1 : thread.unreadForUserB,
    });

    // Tell the recipient: in-app bell always, email only for the first unread
    // message in a thread (so a burst of replies is one email, not ten).
    const sender = await inboxOf(ctx, me);
    const recipient = await inboxOf(ctx, recipientId);
    const senderOrg = await employerLabel(ctx, me);
    const senderLabel = senderOrg
      ? `${sender.name ?? "A recruiter"} · ${senderOrg}`
      : sender.name ?? "An AUF alumnus";
    await maybeInsertNotification(ctx, recipientId, "dmInApp", {
      kind: "message",
      title: `New message from ${senderLabel}`,
      body: preview,
      href: recipient.href,
    });
    if (
      unreadBefore === 0 &&
      recipient.email &&
      (await isChannelEnabled(ctx, recipientId, "dmEmail"))
    ) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      await ctx.scheduler.runAfter(0, internal.actions.email.send, {
        to: recipient.email,
        subject: `New message from ${senderLabel}`,
        html: `<p>Hi ${recipient.name ?? "there"},</p>
          <p><strong>${senderLabel}</strong> sent you a message on the AUF Alumni Network:</p>
          <blockquote>${preview.replace(/[<>]/g, "")}</blockquote>
          <p><a href="${appUrl}${recipient.href}">Read and reply</a></p>
          <p>— AUF Alumni Network</p>`,
      });
    }
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
      const org = otherProfile ? null : await employerLabel(ctx, otherId);
      out.push({
        threadId: t._id,
        otherUserId: otherId,
        otherName:
          otherProfile?.displayName ??
          (org ? `${other?.name ?? "Recruiter"} · ${org}` : other?.name ?? "Alumna"),
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
    const other = otherProfile ? null : await ctx.db.get(otherId);
    const org = otherProfile ? null : await employerLabel(ctx, otherId);
    return {
      threadId: thread._id,
      otherUserId: otherId,
      otherName:
        otherProfile?.displayName ??
        (org ? `${other?.name ?? "Recruiter"} · ${org}` : other?.name ?? null),
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

    // Clear the matching bell notifications too, so the badge can't keep
    // announcing messages the user has already read.
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_time", (q) => q.eq("userId", me))
      .collect();
    for (const n of notifications) {
      if (n.kind === "message" && !n.readAt) {
        await ctx.db.patch(n._id, { readAt: Date.now() });
      }
    }
  },
});

/**
 * Employer-side: the thread (if any) with one applicant, plus whether the
 * viewer may message them. Powers /employer/messages.
 */
export const threadWith = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const me = await getAuthUserId(ctx);
    if (!me || me === otherUserId) return null;
    const allowed = await canMessage(ctx, me, otherUserId);
    const thread = await findThread(ctx, me, otherUserId);
    const otherProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", otherUserId))
      .unique();
    const otherUser = otherProfile ? null : await ctx.db.get(otherUserId);
    const org = otherProfile ? null : await employerLabel(ctx, otherUserId);
    const other = {
      otherName:
        otherProfile?.displayName ??
        (org ? `${otherUser?.name ?? "Recruiter"} · ${org}` : otherUser?.name ?? "Conversation"),
      otherSlug: otherProfile?.slug ?? null,
    };
    if (!thread) return { threadId: null, allowed, unread: 0, messages: [], ...other };
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_time", (q) => q.eq("threadId", thread._id))
      .order("asc")
      .take(200);
    return {
      threadId: thread._id,
      allowed,
      unread: thread.userA === me ? thread.unreadForUserA : thread.unreadForUserB,
      ...other,
      messages: messages.map((m) => ({
        _id: m._id,
        mine: m.senderId === me,
        content: m.content,
        sentAt: m.sentAt,
        readAt: m.readAt ?? null,
      })),
    };
  },
});
