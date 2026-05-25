/**
 * Compliance surface (Epic 7).
 *
 * - DSR tracking (Story 7.2)
 * - Incident response with 72-hour clock (Story 7.3, NFR34)
 *
 * Admin-only. All mutations wrapped with requireRole + withAuditLog per
 * Story 1.4 invariants.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";

const ACK_SLA_BUSINESS_DAYS = 5;
const FULFIL_SLA_BUSINESS_DAYS = 15;
const NPC_NOTIFICATION_WINDOW_HOURS = 72;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

// ============================================================================
// DSR (Data Subject Requests)
// ============================================================================

export const listDataSubjectRequests = query({
  args: {
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { type, limit }) => {
    await requireRole(ctx, ["super-admin"]);
    const rows = type
      ? await ctx.db
          .query("dataSubjectRequests")
          .withIndex("by_type_time", (q) => q.eq("type", type))
          .order("desc")
          .take(limit ?? 100)
      : await ctx.db
          .query("dataSubjectRequests")
          .order("desc")
          .take(limit ?? 100);

    const now = Date.now();
    const out = [];
    for (const r of rows) {
      const user = await ctx.db.get(r.userId);
      const sinceRequestedMs = now - r.requestedAt;
      const overdueAck =
        !r.acknowledgedAt && sinceRequestedMs > ACK_SLA_BUSINESS_DAYS * MS_PER_DAY;
      const overdueFulfil =
        !r.fulfilledAt &&
        sinceRequestedMs > FULFIL_SLA_BUSINESS_DAYS * MS_PER_DAY;
      out.push({
        ...r,
        userEmail: user?.email ?? null,
        overdueAck,
        overdueFulfil,
      });
    }
    return out;
  },
});

// ============================================================================
// Incidents (NFR34 — 72-hour breach notification window)
// ============================================================================

export const listIncidents = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["super-admin"]);
    const rows = await ctx.db
      .query("incidents")
      .withIndex("by_started_at")
      .order("desc")
      .take(100);
    const now = Date.now();
    return rows.map((r) => {
      const hoursElapsed = (now - r.startedAt) / MS_PER_HOUR;
      const hoursLeft = NPC_NOTIFICATION_WINDOW_HOURS - hoursElapsed;
      return {
        ...r,
        hoursElapsed,
        hoursLeft,
        npcOverdue: !r.npcNotifiedAt && hoursLeft < 0,
      };
    });
  },
});

export const startIncident = mutation({
  args: {
    title: v.string(),
    severity: v.string(),
    description: v.string(),
  },
  handler: withAuditLog(async (ctx, { title, severity, description }: { title: string; severity: string; description: string }) => {
    const { userId } = await requireRole(ctx, ["super-admin"]);
    if (!["low", "medium", "high", "critical"].includes(severity)) {
      throw new ConvexError({
        code: "invalid-severity",
        message: "Severity must be one of low/medium/high/critical",
      });
    }
    const now = Date.now();
    const incidentId = await ctx.db.insert("incidents", {
      title,
      severity,
      description,
      startedAt: now,
      startedBy: userId,
    });
    return {
      action: "start-incident",
      target: { type: "incident", id: incidentId },
      reason: `severity=${severity}`,
      result: { incidentId },
    };
  }),
});

export const markIncidentNotified = mutation({
  args: {
    incidentId: v.id("incidents"),
    kind: v.union(v.literal("npc"), v.literal("subjects")),
  },
  handler: withAuditLog(async (ctx, { incidentId, kind }: { incidentId: Id<"incidents">; kind: string }) => {
    await requireRole(ctx, ["super-admin"]);
    const incident = await ctx.db.get(incidentId);
    if (!incident) {
      throw new ConvexError({
        code: "not-found",
        message: "Incident not found",
      });
    }
    const now = Date.now();
    if (kind === "npc") {
      await ctx.db.patch(incidentId, { npcNotifiedAt: now });
    } else {
      await ctx.db.patch(incidentId, { subjectsNotifiedAt: now });
    }
    return {
      action: `incident-notified-${kind}`,
      target: { type: "incident", id: incidentId },
      reason: `marked ${kind} notification complete`,
    };
  }),
});

export const closeIncident = mutation({
  args: { incidentId: v.id("incidents"), closureNotes: v.string() },
  handler: withAuditLog(async (ctx, { incidentId, closureNotes }: { incidentId: Id<"incidents">; closureNotes: string }) => {
    const { userId } = await requireRole(ctx, ["super-admin"]);
    const incident = await ctx.db.get(incidentId);
    if (!incident) {
      throw new ConvexError({
        code: "not-found",
        message: "Incident not found",
      });
    }
    if (incident.closedAt) {
      return {
        action: "close-incident-noop",
        target: { type: "incident", id: incidentId },
        reason: "already closed",
      };
    }
    await ctx.db.patch(incidentId, {
      closedAt: Date.now(),
      closedBy: userId,
      closureNotes,
    });
    return {
      action: "close-incident",
      target: { type: "incident", id: incidentId },
      reason: closureNotes,
    };
  }),
});
