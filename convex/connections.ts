/**
 * Connection requests + acceptance + block lifecycle (Epic 5).
 *
 * Pair normalisation: (userA, userB) is stored with userA < userB by string
 * compare. This keeps the by_pair index order-independent — one lookup,
 * regardless of who sent the request.
 *
 * All mutations are user-self-service (they act on the authenticated user's
 * own connection graph), so they carry the `@no-audit-required:` annotation.
 * Auditable admin actions on the connection table (e.g., a moderator forcing
 * disconnect) would live in admin.ts and use withAuditLog + requireRole.
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

const NOTE_MAX_LENGTH = 200;
const REQUESTS_PER_DAY = 50;

function canonical(a: Id<"users">, b: Id<"users">): [Id<"users">, Id<"users">] {
  return a < b ? [a, b] : [b, a];
}

async function getConnectionRow(
  ctx: QueryCtx | MutationCtx,
  me: Id<"users">,
  other: Id<"users">,
): Promise<Doc<"connections"> | null> {
  const [userA, userB] = canonical(me, other);
  return await ctx.db
    .query("connections")
    .withIndex("by_pair", (q) => q.eq("userA", userA).eq("userB", userB))
    .unique();
}

async function isBlockedEither(
  ctx: QueryCtx | MutationCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<boolean> {
  const aBlockedB = await ctx.db
    .query("blocks")
    .withIndex("by_blocker_blocked", (q) =>
      q.eq("blockerId", a).eq("blockedId", b),
    )
    .unique();
  if (aBlockedB) return true;
  const bBlockedA = await ctx.db
    .query("blocks")
    .withIndex("by_blocker_blocked", (q) =>
      q.eq("blockerId", b).eq("blockedId", a),
    )
    .unique();
  return !!bBlockedA;
}

/**
 * Public: connection state with another user from the authenticated user's POV.
 */
export const stateWith = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const me = await getAuthUserId(ctx);
    if (!me) return { kind: "not-authenticated" as const };
    if (me === otherUserId) return { kind: "self" as const };

    const blocked = await isBlockedEither(ctx, me, otherUserId);
    if (blocked) return { kind: "blocked" as const };

    const row = await getConnectionRow(ctx, me, otherUserId);
    if (!row) return { kind: "not-connected" as const };
    if (row.status === "connected") {
      return { kind: "connected" as const, connectionId: row._id };
    }
    if (row.status === "pending") {
      return row.requesterId === me
        ? { kind: "request-sent" as const, connectionId: row._id }
        : { kind: "request-received" as const, connectionId: row._id };
    }
    return { kind: "not-connected" as const };
  },
});

/**
 * Send a connection request.
 */
// @no-audit-required: user self-service; user owns their own connection graph.
export const sendRequest = mutation({
  args: {
    recipientId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { recipientId, note }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (me === recipientId) {
      throw new ConvexError({
        code: "self-connection",
        message: "Cannot connect to yourself",
      });
    }
    if (await isBlockedEither(ctx, me, recipientId)) {
      throw new ConvexError({
        code: "blocked",
        message: "Connection unavailable",
      });
    }
    if (note && note.length > NOTE_MAX_LENGTH) {
      throw new ConvexError({
        code: "note-too-long",
        message: `Note must be ${NOTE_MAX_LENGTH} characters or fewer`,
      });
    }

    // Rate limit: 50 requests per 24h
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recent = await ctx.db
      .query("connections")
      .withIndex("by_requester_status", (q) => q.eq("requesterId", me))
      .collect();
    const recentCount = recent.filter((r) => r.createdAt >= dayAgo).length;
    if (recentCount >= REQUESTS_PER_DAY) {
      throw new ConvexError({
        code: "rate_limited",
        message: "You're sending requests too fast. Try again later.",
      });
    }

    const existing = await getConnectionRow(ctx, me, recipientId);
    if (existing) {
      if (existing.status === "connected") {
        return { connectionId: existing._id, status: "connected" };
      }
      if (existing.status === "pending") {
        return { connectionId: existing._id, status: "pending" };
      }
      // Previously declined — reopen by patching status back to pending.
      await ctx.db.patch(existing._id, {
        requesterId: me,
        recipientId,
        status: "pending",
        note: note?.trim() || undefined,
        createdAt: Date.now(),
        decidedAt: undefined,
      });
      return { connectionId: existing._id, status: "pending" };
    }

    const [userA, userB] = canonical(me, recipientId);
    const connectionId = await ctx.db.insert("connections", {
      requesterId: me,
      recipientId,
      userA,
      userB,
      status: "pending",
      note: note?.trim() || undefined,
      createdAt: Date.now(),
    });

    // Notify recipient asynchronously
    const recipient = await ctx.db.get(recipientId);
    const requester = await ctx.db.get(me);
    if (recipient?.email) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.sendConnectionEmail.sendConnectionEmail,
        {
          to: recipient.email,
          recipientName: recipient.name ?? undefined,
          requesterName: requester?.name ?? "an AUF alumnus",
          note: note?.trim() || undefined,
          kind: "request-received",
        },
      );
    }

    return { connectionId, status: "pending" };
  },
});

/**
 * Accept a pending incoming request.
 */
// @no-audit-required: user self-service; user accepts their own incoming request.
export const accept = mutation({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, { connectionId }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const row = await ctx.db.get(connectionId);
    if (!row) {
      throw new ConvexError({ code: "not-found", message: "Request not found" });
    }
    if (row.recipientId !== me) {
      throw new ConvexError({
        code: "forbidden",
        message: "Only the recipient can accept",
      });
    }
    if (row.status === "connected") return { alreadyConnected: true };
    if (row.status !== "pending") {
      throw new ConvexError({
        code: "invalid-state",
        message: `Cannot accept a ${row.status} request`,
      });
    }
    await ctx.db.patch(connectionId, {
      status: "connected",
      decidedAt: Date.now(),
    });

    // Notify the requester
    const requester = await ctx.db.get(row.requesterId);
    const meDoc = await ctx.db.get(me);
    if (requester?.email) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.sendConnectionEmail.sendConnectionEmail,
        {
          to: requester.email,
          recipientName: requester.name ?? undefined,
          requesterName: meDoc?.name ?? "an AUF alumnus",
          kind: "request-accepted",
        },
      );
    }

    return { alreadyConnected: false };
  },
});

/**
 * Decline a pending incoming request. Per UX spec, requester is NOT notified.
 */
// @no-audit-required: user self-service.
export const decline = mutation({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, { connectionId }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const row = await ctx.db.get(connectionId);
    if (!row) return { ok: true };
    if (row.recipientId !== me) {
      throw new ConvexError({
        code: "forbidden",
        message: "Only the recipient can decline",
      });
    }
    if (row.status === "pending") {
      await ctx.db.patch(connectionId, {
        status: "declined",
        decidedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

/**
 * Withdraw a request I sent. Deletes the row outright per UX spec
 * (withdrawn requests carry no historical meaning).
 */
// @no-audit-required: user self-service.
export const withdraw = mutation({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, { connectionId }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const row = await ctx.db.get(connectionId);
    if (!row) return { ok: true };
    if (row.requesterId !== me) {
      throw new ConvexError({
        code: "forbidden",
        message: "Only the requester can withdraw",
      });
    }
    if (row.status !== "pending") {
      throw new ConvexError({
        code: "invalid-state",
        message: "Can only withdraw a pending request",
      });
    }
    await ctx.db.delete(connectionId);
    return { ok: true };
  },
});

/**
 * Block another user. Removes any existing connection between us.
 */
// @no-audit-required: user self-service; managing their own block list.
export const block = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (me === otherUserId) {
      throw new ConvexError({
        code: "self-block",
        message: "Cannot block yourself",
      });
    }
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", me).eq("blockedId", otherUserId),
      )
      .unique();
    if (existing) return { alreadyBlocked: true };

    await ctx.db.insert("blocks", {
      blockerId: me,
      blockedId: otherUserId,
      createdAt: Date.now(),
    });

    // Tear down any existing connection
    const row = await getConnectionRow(ctx, me, otherUserId);
    if (row) await ctx.db.delete(row._id);

    return { alreadyBlocked: false };
  },
});

// @no-audit-required: user self-service.
export const unblock = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const me = await getAuthUserId(ctx);
    if (!me) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const existing = await ctx.db
      .query("blocks")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", me).eq("blockedId", otherUserId),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true };
  },
});

/**
 * Inbox: incoming pending requests, outgoing pending, and connected list.
 * Used by /connections page (Story 5.6).
 */
export const inbox = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;

    const incoming = await ctx.db
      .query("connections")
      .withIndex("by_recipient_status", (q) =>
        q.eq("recipientId", me).eq("status", "pending"),
      )
      .order("desc")
      .collect();
    const outgoing = await ctx.db
      .query("connections")
      .withIndex("by_requester_status", (q) =>
        q.eq("requesterId", me).eq("status", "pending"),
      )
      .order("desc")
      .collect();

    // Connected rows: connections live in by_pair (userA < userB).
    // Walk both sides — once where me is userA, once where me is userB.
    const asA = await ctx.db
      .query("connections")
      .withIndex("by_pair", (q) => q.eq("userA", me))
      .collect();
    const asB = await ctx.db
      .query("connections")
      .filter((q) => q.eq(q.field("userB"), me))
      .collect();
    const connected = [...asA, ...asB].filter(
      (r) => r.status === "connected",
    );

    async function decorate(rows: Doc<"connections">[]) {
      const out: Array<{
        connectionId: Id<"connections">;
        otherUserId: Id<"users">;
        otherProfileSlug: string | null;
        otherName: string | null;
        note: string | undefined;
        createdAt: number;
      }> = [];
      for (const r of rows) {
        const otherId =
          r.requesterId === me ? r.recipientId : r.requesterId;
        const otherProfile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", otherId))
          .unique();
        const otherUser = await ctx.db.get(otherId);
        out.push({
          connectionId: r._id,
          otherUserId: otherId,
          otherProfileSlug: otherProfile?.slug ?? null,
          otherName: otherProfile?.displayName ?? otherUser?.name ?? null,
          note: r.note,
          createdAt: r.createdAt,
        });
      }
      return out;
    }

    return {
      incoming: await decorate(incoming),
      outgoing: await decorate(outgoing),
      connected: await decorate(connected),
    };
  },
});

/**
 * Lightweight counts for the sidebar mini-stats. Returns just numbers so
 * the sidebar can render without paying the cost of `inbox`'s full decorate.
 */
export const myCounts = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const asA = await ctx.db
      .query("connections")
      .withIndex("by_pair", (q) => q.eq("userA", me))
      .collect();
    const asB = await ctx.db
      .query("connections")
      .filter((q) => q.eq(q.field("userB"), me))
      .collect();
    const all = [...asA, ...asB];
    return {
      connected: all.filter((r) => r.status === "connected").length,
      pendingIncoming: await ctx.db
        .query("connections")
        .withIndex("by_recipient_status", (q) =>
          q.eq("recipientId", me).eq("status", "pending"),
        )
        .collect()
        .then((rows) => rows.length),
    };
  },
});

/**
 * Count of verified profiles that are open-to mentorship.
 * The design's sidebar shows "Mentors online" — we surface the universe of
 * mentors signalling availability instead of presence (no presence infra yet).
 */
export const mentorsAvailableCount = query({
  args: {},
  handler: async (ctx) => {
    // @no-privacy-required: aggregate count only; no per-alumna data returned.
    const profiles = await ctx.db.query("profiles").collect();
    return profiles.filter(
      (p) =>
        p.verifiedAt != null &&
        (p.openTo ?? []).some((tag) => tag.toLowerCase().includes("mentor")),
    ).length;
  },
});
