/**
 * Events + RSVPs (Epic 9).
 *
 * - Admins publish events targeting a batch/program audience filter.
 * - Verified alumni RSVP; capacity enforces waitlist when full.
 * - Reminder cron handles 24h + 1h notifications (Story 9.3).
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";
import { applyPrivacy, getViewerContext } from "./helpers/privacy";

async function profileMatchesAudience(
  ctx: QueryCtx,
  userId: Id<"users">,
  audience: Doc<"events">["audienceFilter"],
): Promise<boolean> {
  if (!audience) return true;
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) return false;
  if (audience.batches && audience.batches.length > 0) {
    if (!audience.batches.includes(profile.batch)) return false;
  }
  if (audience.programs && audience.programs.length > 0) {
    if (!audience.programs.includes(profile.program)) return false;
  }
  return true;
}

export const publishEvent = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    locationLabel: v.optional(v.string()),
    onlineUrl: v.optional(v.string()),
    capacity: v.optional(v.number()),
    audienceBatches: v.optional(v.array(v.number())),
    audiencePrograms: v.optional(v.array(v.string())),
  },
  handler: withAuditLog(async (ctx, args) => {
    const { userId } = await requireRole(ctx, ["moderator", "super-admin"]);
    if (!args.title.trim() || !args.description.trim()) {
      throw new ConvexError({
        code: "validation",
        message: "Title and description required",
      });
    }
    const audience =
      args.audienceBatches?.length || args.audiencePrograms?.length
        ? {
            batches: args.audienceBatches,
            programs: args.audiencePrograms,
          }
        : undefined;
    const id = await ctx.db.insert("events", {
      title: args.title.trim(),
      description: args.description.trim(),
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      locationLabel: args.locationLabel,
      onlineUrl: args.onlineUrl,
      capacity: args.capacity,
      audienceFilter: audience,
      publishedBy: userId,
      publishedAt: Date.now(),
    });
    return {
      action: "publish-event",
      target: { type: "event", id },
      reason: args.title,
      result: { eventId: id },
    };
  }),
});

export const cancelEvent = mutation({
  args: { eventId: v.id("events"), reason: v.string() },
  handler: withAuditLog(async (ctx, { eventId, reason }) => {
    await requireRole(ctx, ["moderator", "super-admin"]);
    await ctx.db.patch(eventId, { cancelledAt: Date.now() });
    return {
      action: "cancel-event",
      target: { type: "event", id: eventId },
      reason,
    };
  }),
});

export const listUpcoming = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    const events = await ctx.db
      .query("events")
      .withIndex("by_starts_at")
      .order("asc")
      .collect();
    const future = events.filter(
      (e) => e.startsAt > now && e.cancelledAt == null,
    );
    const out: Array<{
      _id: Id<"events">;
      title: string;
      description: string;
      startsAt: number;
      locationLabel?: string;
      onlineUrl?: string;
      capacity?: number;
      audienceMatch: boolean;
      goingCount: number;
      maybeCount: number;
      waitlistCount: number;
      myRsvpStatus: string | null;
    }> = [];
    for (const e of future) {
      const audienceMatch = userId
        ? await profileMatchesAudience(ctx, userId, e.audienceFilter)
        : !e.audienceFilter;
      // Show event in the list even if user doesn't match (transparency).
      const rsvps = await ctx.db
        .query("rsvps")
        .withIndex("by_event_status", (q) => q.eq("eventId", e._id))
        .collect();
      const counts = {
        yes: rsvps.filter((r) => r.status === "yes").length,
        maybe: rsvps.filter((r) => r.status === "maybe").length,
        waitlist: rsvps.filter((r) => r.status === "waitlist").length,
      };
      const mine = userId
        ? rsvps.find((r) => r.userId === userId && r.status !== "cancelled")
        : undefined;
      out.push({
        _id: e._id,
        title: e.title,
        description: e.description,
        startsAt: e.startsAt,
        locationLabel: e.locationLabel,
        onlineUrl: e.onlineUrl,
        capacity: e.capacity,
        audienceMatch,
        goingCount: counts.yes,
        maybeCount: counts.maybe,
        waitlistCount: counts.waitlist,
        myRsvpStatus: mine?.status ?? null,
      });
    }
    return out;
  },
});

export const myRsvps = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rsvps = await ctx.db
      .query("rsvps")
      .withIndex("by_user_status", (q) => q.eq("userId", userId))
      .collect();
    const active = rsvps.filter((r) => r.status !== "cancelled");
    const out = [];
    for (const r of active) {
      const event = await ctx.db.get(r.eventId);
      if (!event || event.cancelledAt) continue;
      out.push({
        rsvpId: r._id,
        eventId: r.eventId,
        status: r.status,
        eventTitle: event.title,
        startsAt: event.startsAt,
      });
    }
    return out;
  },
});

// @no-audit-required: alumnus-authored event (no audience-targeting privileges).
export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    locationLabel: v.optional(v.string()),
    onlineUrl: v.optional(v.string()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (!args.title.trim() || !args.description.trim()) {
      throw new ConvexError({
        code: "validation",
        message: "Title and description required",
      });
    }
    if (args.startsAt <= Date.now()) {
      throw new ConvexError({
        code: "validation",
        message: "Start time must be in the future",
      });
    }
    if (args.endsAt != null && args.endsAt <= args.startsAt) {
      throw new ConvexError({
        code: "validation",
        message: "End time must be after start time",
      });
    }
    const id = await ctx.db.insert("events", {
      title: args.title.trim(),
      description: args.description.trim(),
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      locationLabel: args.locationLabel?.trim() || undefined,
      onlineUrl: args.onlineUrl?.trim() || undefined,
      capacity: args.capacity,
      publishedBy: userId,
      publishedAt: Date.now(),
    });
    return { eventId: id };
  },
});

export const getEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) return null;
    const userId = await getAuthUserId(ctx);
    const rsvps = await ctx.db
      .query("rsvps")
      .withIndex("by_event_status", (q) => q.eq("eventId", eventId))
      .collect();
    const active = rsvps.filter((r) => r.status !== "cancelled");
    const goingCount = active.filter((r) => r.status === "yes").length;
    const maybeCount = active.filter((r) => r.status === "maybe").length;
    const waitlistCount = active.filter((r) => r.status === "waitlist").length;
    const mine = userId
      ? active.find((r) => r.userId === userId)
      : undefined;

    const yesRsvps = active
      .filter((r) => r.status === "yes")
      .slice(0, 20);
    const attendees: Array<{
      displayName: string;
      slug: string;
      program?: string;
      batch?: number;
    }> = [];
    for (const r of yesRsvps) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", r.userId))
        .unique();
      if (!profile) continue;
      const viewer = await getViewerContext(ctx, profile.userId);
      const safe = applyPrivacy(profile, viewer);
      attendees.push({
        displayName: safe.displayName ?? "Alumnus",
        slug: safe.slug ?? "",
        program: safe.program,
        batch: safe.batch,
      });
    }

    return {
      ...event,
      myRsvpStatus: mine?.status ?? null,
      goingCount,
      maybeCount,
      waitlistCount,
      attendees,
    };
  },
});

// @no-audit-required: user self-service RSVP.
export const rsvp = mutation({
  args: {
    eventId: v.id("events"),
    status: v.union(
      v.literal("yes"),
      v.literal("maybe"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, { eventId, status }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new ConvexError({ code: "not-found", message: "Event not found" });
    }
    if (event.cancelledAt) {
      throw new ConvexError({
        code: "cancelled",
        message: "This event has been cancelled",
      });
    }
    if (!(await profileMatchesAudience(ctx, userId, event.audienceFilter))) {
      throw new ConvexError({
        code: "audience-mismatch",
        message: "This event isn't open to your batch/program",
      });
    }

    const existing = await ctx.db
      .query("rsvps")
      .withIndex("by_user_status", (q) => q.eq("userId", userId))
      .collect();
    const myCurrent = existing.find(
      (r) => r.eventId === eventId && r.status !== "cancelled",
    );

    // Capacity check for "yes" RSVPs
    let nextStatus: "yes" | "maybe" | "cancelled" | "waitlist" = status;
    if (status === "yes" && event.capacity != null) {
      const yesCount = (
        await ctx.db
          .query("rsvps")
          .withIndex("by_event_status", (q) =>
            q.eq("eventId", eventId).eq("status", "yes"),
          )
          .collect()
      ).length;
      if (yesCount >= event.capacity && !myCurrent) {
        nextStatus = "waitlist";
      }
    }

    if (myCurrent) {
      await ctx.db.patch(myCurrent._id, {
        status: nextStatus,
        rsvpedAt: Date.now(),
      });
      return { rsvpId: myCurrent._id, status: nextStatus };
    }
    const id = await ctx.db.insert("rsvps", {
      eventId,
      userId,
      status: nextStatus,
      rsvpedAt: Date.now(),
    });
    return { rsvpId: id, status: nextStatus };
  },
});

/**
 * Send 24-hour and 1-hour reminders. Run hourly via cron.
 */
export const sendDueReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    // Window: events starting between now and now + 25h
    const upcoming = await ctx.db
      .query("events")
      .filter((q) => q.gt(q.field("startsAt"), now))
      .filter((q) => q.lt(q.field("startsAt"), now + 25 * hour))
      .collect();

    let sent = 0;
    for (const event of upcoming) {
      if (event.cancelledAt) continue;
      const timeUntil = event.startsAt - now;
      const rsvps = await ctx.db
        .query("rsvps")
        .withIndex("by_event_status", (q) =>
          q.eq("eventId", event._id).eq("status", "yes"),
        )
        .collect();
      for (const r of rsvps) {
        let kind: "24h" | "1h" | null = null;
        if (
          timeUntil <= day + hour &&
          timeUntil > day - hour &&
          !r.remindedAt24h
        ) {
          kind = "24h";
        } else if (timeUntil <= hour && timeUntil > 0 && !r.remindedAt1h) {
          kind = "1h";
        }
        if (!kind) continue;
        const user = await ctx.db.get(r.userId);
        if (!user?.email) continue;
        await ctx.scheduler.runAfter(
          0,
          internal.actions.email.send,
          {
            to: user.email,
            subject: `Reminder: ${event.title}`,
            html: `<p>Hi ${user.name ?? "there"},</p>
              <p>This is a reminder that <strong>${event.title}</strong>
              starts in about ${kind === "24h" ? "24 hours" : "1 hour"}.</p>
              <p>${event.locationLabel ?? ""}${event.onlineUrl ? ` · <a href="${event.onlineUrl}">${event.onlineUrl}</a>` : ""}</p>
              <p>— AUF Alumni Network</p>`,
          },
        );
        await ctx.db.patch(r._id, {
          remindedAt24h:
            kind === "24h" ? Date.now() : r.remindedAt24h,
          remindedAt1h: kind === "1h" ? Date.now() : r.remindedAt1h,
        });
        sent += 1;
      }
    }
    return { sent };
  },
});
