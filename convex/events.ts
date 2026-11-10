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
import { isChannelEnabled, maybeInsertNotification } from "./notifications";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";
import { applyPrivacy, getViewerContext } from "./helpers/privacy";

const categoryValidator = v.union(
  v.literal("reunion"),
  v.literal("webinar"),
  v.literal("meetup"),
  v.literal("by-program"),
  v.literal("online-meeting"),
  v.literal("other"),
);

const agendaValidator = v.array(
  v.object({
    time: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
  }),
);

/**
 * Server-side agenda limits shared by publishEvent and createEvent:
 * ≤ 50 rows; every row needs a non-empty title; title ≤ 200 chars,
 * time ≤ 40 chars, description ≤ 1000 chars.
 */
function validateAgenda(
  agenda:
    | Array<{ time: string; title: string; description?: string }>
    | undefined,
): void {
  if (!agenda) return;
  if (agenda.length > 50) {
    throw new ConvexError({
      code: "validation",
      message: "Agenda cannot have more than 50 items",
    });
  }
  for (const row of agenda) {
    if (!row.title.trim()) {
      throw new ConvexError({
        code: "validation",
        message: "Every agenda item needs a title",
      });
    }
    if (row.title.length > 200) {
      throw new ConvexError({
        code: "validation",
        message: "Agenda item titles must be 200 characters or fewer",
      });
    }
    if (row.time.length > 40) {
      throw new ConvexError({
        code: "validation",
        message: "Agenda item times must be 40 characters or fewer",
      });
    }
    if (row.description != null && row.description.length > 1000) {
      throw new ConvexError({
        code: "validation",
        message: "Agenda item descriptions must be 1000 characters or fewer",
      });
    }
  }
}

async function profileMatchesAudience(
  ctx: QueryCtx,
  userId: Id<"users">,
  audience: Doc<"events">["audienceFilter"],
): Promise<boolean> {
  if (!audience) return true;
  // @no-privacy-required: self-read: the viewer's own batch and program, tested against the event's audience filter; returns a boolean.
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
    coverImageStorageId: v.optional(v.id("_storage")),
    category: v.optional(categoryValidator),
    agenda: v.optional(agendaValidator),
  },
  handler: withAuditLog(async (ctx, args) => {
    const { userId } = await requireRole(ctx, ["moderator", "super-admin"]);
    if (!args.title.trim() || !args.description.trim()) {
      throw new ConvexError({
        code: "validation",
        message: "Title and description required",
      });
    }
    validateAgenda(args.agenda);
    if (args.endsAt != null && args.endsAt <= args.startsAt) {
      throw new ConvexError({
        code: "validation",
        message: "End time must be after start time",
      });
    }
    // Online meetings must ship with a working join link for that date.
    if (args.category === "online-meeting" && !args.onlineUrl?.trim()) {
      throw new ConvexError({
        code: "validation",
        message: "An online meeting needs a join link",
      });
    }
    // A By Program event must target at least one program (course).
    if (args.category === "by-program" && !args.audiencePrograms?.length) {
      throw new ConvexError({
        code: "validation",
        message: "Select at least one program for a By Program event",
      });
    }
    // Guard against attaching a non-image (or unrelated) stored blob as the
    // cover: verify the storage metadata before insert.
    if (args.coverImageStorageId) {
      const meta = await ctx.db.system.get(args.coverImageStorageId);
      if (
        !meta ||
        !("contentType" in meta) ||
        !meta.contentType?.startsWith("image/")
      ) {
        throw new ConvexError({
          code: "validation",
          message: "Cover image must be an uploaded image file",
        });
      }
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
      coverImageStorageId: args.coverImageStorageId,
      category: args.category,
      agenda: args.agenda?.length ? args.agenda : undefined,
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
  args: {
    scope: v.optional(v.union(v.literal("upcoming"), v.literal("past"))),
    category: v.optional(categoryValidator),
  },
  handler: async (ctx, { scope, category }) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    let matched: Array<Doc<"events">>;
    if (scope === "past") {
      // Walk newest-first lazily and stop once the cap of ended events is
      // kept. The index range bound skips the future-events prefix entirely
      // (an ended event always has startsAt <= now once endsAt > startsAt
      // is enforced at write time).
      matched = [];
      const newestFirst = ctx.db
        .query("events")
        .withIndex("by_starts_at", (q) => q.lte("startsAt", now))
        .order("desc");
      for await (const e of newestFirst) {
        if ((e.endsAt ?? e.startsAt) > now || e.cancelledAt != null) continue;
        if (category != null && e.category !== category) continue;
        matched.push(e);
        if (matched.length >= 50) break;
      }
    } else {
      const events = await ctx.db
        .query("events")
        .withIndex("by_starts_at")
        .order("asc")
        .collect();
      matched = events.filter(
        (e) =>
          e.startsAt > now &&
          e.cancelledAt == null &&
          (category == null || e.category === category),
      );
    }
    const out: Array<{
      _id: Id<"events">;
      title: string;
      description: string;
      startsAt: number;
      endsAt?: number;
      category?:
        | "reunion"
        | "webinar"
        | "meetup"
        | "by-program"
        | "online-meeting"
        | "other";
      locationLabel?: string;
      onlineUrl?: string;
      capacity?: number;
      audienceMatch: boolean;
      goingCount: number;
      maybeCount: number;
      waitlistCount: number;
      myRsvpStatus: string | null;
    }> = [];
    for (const e of matched) {
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
        endsAt: e.endsAt,
        category: e.category,
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
    category: v.optional(categoryValidator),
    agenda: v.optional(agendaValidator),
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
    // Online meetings must ship with a working join link for that date.
    if (args.category === "online-meeting" && !args.onlineUrl?.trim()) {
      throw new ConvexError({
        code: "validation",
        message: "An online meeting needs a join link",
      });
    }
    validateAgenda(args.agenda);
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
      category: args.category,
      agenda: args.agenda?.length ? args.agenda : undefined,
    });
    return { eventId: id };
  },
});

/**
 * Short-lived upload URL for an event cover image (admin publish form).
 * Mirrors the academy cover-image pattern: client POSTs the file to the
 * returned URL and passes the resulting storageId into `publishEvent`.
 */
// @no-audit-required: mints an ephemeral upload token only; the publish itself is audited.
export const generateCoverUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["moderator", "super-admin"]);
    return await ctx.storage.generateUploadUrl();
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

    // Viewer's own batch, resolved server-side; social proof only applies to
    // verified viewers with a profile (otherwise the count stays 0).
    let viewerBatch: number | null = null;
    if (userId) {
      const myProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      if (myProfile && myProfile.verifiedAt != null) {
        viewerBatch = myProfile.batch;
      }
    }

    const yesRsvps = active.filter((r) => r.status === "yes");
    const attendees: Array<{
      displayName: string;
      slug: string;
      program?: string;
      batch?: number;
    }> = [];
    let batchGoingCount = 0;
    for (const r of yesRsvps) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", r.userId))
        .unique();
      if (!profile) continue;
      const viewer = await getViewerContext(ctx, profile.userId);
      const safe = applyPrivacy(profile, viewer);
      // Batch social proof: count batchmates (never the viewer themselves,
      // mirroring digest.ts) whose batch SURVIVES privacy filtering — a
      // viewer-hidden batch excludes that attendee from the count.
      if (
        viewerBatch != null &&
        r.userId !== userId &&
        safe.batch === viewerBatch
      ) {
        batchGoingCount += 1;
      }
      if (attendees.length < 20) {
        attendees.push({
          displayName: safe.displayName ?? "Alumnus",
          slug: safe.slug ?? "",
          program: safe.program,
          batch: safe.batch,
        });
      }
    }

    // Organizer card: never expose the raw publishedBy id — only the
    // privacy-filtered always-include identity fields of their profile.
    const { publishedBy, coverImageStorageId, ...publicEvent } = event;
    let organizer: { displayName: string; slug: string } | null = null;
    const organizerProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", publishedBy))
      .unique();
    if (organizerProfile) {
      const viewer = await getViewerContext(ctx, organizerProfile.userId);
      const safe = applyPrivacy(organizerProfile, viewer);
      organizer = {
        displayName: safe.displayName ?? "Alumnus",
        slug: safe.slug ?? "",
      };
    }

    return {
      ...publicEvent,
      coverImageUrl: coverImageStorageId
        ? await ctx.storage.getUrl(coverImageStorageId)
        : null,
      organizer,
      batchGoingCount,
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

    // Window: events starting between now and now + 25h.
    // As an index range this reads only the window; as a .filter() it read
    // every event ever created, once an hour, forever.
    const upcoming = await ctx.db
      .query("events")
      .withIndex("by_starts_at", (q) =>
        q.gt("startsAt", now).lt("startsAt", now + 25 * hour),
      )
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
        const whenLabel = kind === "24h" ? "24 hours" : "1 hour";
        await maybeInsertNotification(ctx, r.userId, "eventReminderInApp", {
          kind: "event-reminder",
          title: `${event.title} starts in about ${whenLabel}`,
          body: event.locationLabel ?? (event.onlineUrl ? "Online event" : ""),
          href: `/events/${event._id}`,
        });
        if (
          !user?.email ||
          !(await isChannelEnabled(ctx, r.userId, "eventReminderEmail"))
        ) {
          // Still stamp the reminder so the in-app notice isn't repeated.
          await ctx.db.patch(r._id, {
            remindedAt24h: kind === "24h" ? Date.now() : r.remindedAt24h,
            remindedAt1h: kind === "1h" ? Date.now() : r.remindedAt1h,
          });
          sent += 1;
          continue;
        }
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

/**
 * Public, minimal event summary for the no-login RSVP confirmation page
 * (/rsvp?e=<eventId>). Accepts the raw id string from the URL so a malformed
 * or stale link returns null instead of throwing. Title/time/place only.
 */
export const getEventPublic = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const eventId = ctx.db.normalizeId("events", id);
    if (!eventId) return null;
    const event = await ctx.db.get(eventId);
    if (!event || event.cancelledAt) return null;
    return {
      title: event.title,
      startsAt: event.startsAt,
      location: event.locationLabel ?? (event.onlineUrl ? "Online" : null),
    };
  },
});


/**
 * Upcoming events for the public marketing site.
 *
 * Deliberately narrow: only events an admin has explicitly marked public,
 * only ones still to happen, and only the fields a stranger needs. Attendee
 * counts, capacity, the audience filter and the online joining URL are all
 * withheld — a visitor has no business knowing who is coming, and the join
 * link is the event's soft access control.
 */
export const listPublic = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const now = Date.now();
    const cap = Math.min(Math.max(limit ?? 6, 1), 24);

    const upcoming = ctx.db
      .query("events")
      .withIndex("by_starts_at", (q) => q.gt("startsAt", now))
      .order("asc");

    const out: Array<{
      _id: Id<"events">;
      title: string;
      description: string;
      startsAt: number;
      endsAt: number | null;
      location: string | null;
      category: string | null;
      coverUrl: string | null;
    }> = [];

    for await (const e of upcoming) {
      if (e.cancelledAt != null) continue;
      if (e.isPublic !== true) continue;
      out.push({
        _id: e._id,
        title: e.title,
        description: e.description,
        startsAt: e.startsAt,
        endsAt: e.endsAt ?? null,
        location: e.locationLabel ?? (e.onlineUrl ? "Online" : null),
        category: e.category ?? null,
        coverUrl: e.coverImageStorageId
          ? await ctx.storage.getUrl(e.coverImageStorageId)
          : null,
      });
      if (out.length >= cap) break;
    }

    return out;
  },
});

/**
 * Admin toggle for the above. Separate from publishing: an event is
 * "published" to alumni the moment it exists, whereas this decides whether
 * the outside world sees it at all.
 */
export const setEventPublic = mutation({
  args: { eventId: v.id("events"), isPublic: v.boolean() },
  // The type argument is needed because withAuditLog defaults Args to `any`,
  // which would widen ctx.db.get(eventId) to a union of every document type.
  handler: withAuditLog<{ eventId: Id<"events">; isPublic: boolean }>(async (
    ctx,
    { eventId, isPublic },
  ) => {
    await requireRole(ctx, ["super-admin", "moderator"]);
    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new ConvexError({ code: "not-found", message: "Event not found" });
    }
    await ctx.db.patch(eventId, { isPublic });
    // Exposing an event to logged-out visitors is a disclosure decision, so
    // who flipped it and in which direction belongs in the trail.
    return {
      action: "set-event-public",
      target: { type: "event", id: eventId as string },
      metadata: { isPublic, previousIsPublic: event.isPublic ?? false },
      result: { isPublic },
    };
  }),
});
