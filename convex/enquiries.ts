/**
 * Contact enquiries — the public "talk to AUF" forms and the admin inbox.
 *
 * Every contact route used to be a `mailto:` link, which does nothing without
 * a desktop mail client and left no record. Submissions now land in the
 * `enquiries` table, notify the admins in-app, and are emailed to the right
 * AUF address (best effort — the record is the source of truth).
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";
import { maybeInsertNotification } from "./notifications";

const ADMIN_ROLES = ["moderator", "super-admin"] as const;

export const TOPICS = ["employer", "support", "general", "privacy", "security"] as const;
export type Topic = (typeof TOPICS)[number];

/** Where each topic is emailed, and how it reads in the admin list. */
export const TOPIC_META: Record<Topic, { label: string; email: string }> = {
  employer: { label: "Employer partnerships", email: "careers@auf.edu.ph" },
  support: { label: "Account support", email: "support@auf.edu.ph" },
  general: { label: "General enquiry", email: "alumni@auf.edu.ph" },
  privacy: { label: "Data privacy (DPO)", email: "dpo@auf.edu.ph" },
  security: { label: "Security", email: "security@auf.edu.ph" },
};

type Status = "new" | "in-progress" | "closed";
const topicValidator = v.union(
  v.literal("employer"),
  v.literal("support"),
  v.literal("general"),
  v.literal("privacy"),
  v.literal("security"),
);
const statusValidator = v.union(
  v.literal("new"),
  v.literal("in-progress"),
  v.literal("closed"),
);

const NAME_MAX = 120;
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 4000;
/** Per-email flood guard: at most this many submissions an hour. */
const MAX_PER_HOUR = 5;
const HOUR = 60 * 60 * 1000;

function clean(raw: string, max: number, label: string, min = 1): string {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < min) {
    throw new ConvexError({ code: "validation", message: `${label} is required` });
  }
  if (value.length > max) {
    throw new ConvexError({
      code: "validation",
      message: `${label} must be ${max} characters or fewer`,
    });
  }
  return value;
}

function escapeHtml(text: string): string {
  return text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
}

// @no-audit-required: public contact form; the enquiry row itself is the record, and admin handling is audited.
export const submit = mutation({
  args: {
    topic: topicValidator,
    name: v.string(),
    email: v.string(),
    organisation: v.optional(v.string()),
    message: v.string(),
    sourcePath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = clean(args.name, NAME_MAX, "Name");
    const email = clean(args.email, 200, "Email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError({ code: "validation", message: "Enter a valid email address" });
    }
    const message = clean(args.message, MESSAGE_MAX, "Message", MESSAGE_MIN);
    const organisation = args.organisation?.trim()
      ? clean(args.organisation, NAME_MAX, "Organisation")
      : undefined;

    const now = Date.now();
    const recent = await ctx.db
      .query("enquiries")
      .withIndex("by_email_time", (q) => q.eq("email", email).gte("createdAt", now - HOUR))
      .collect();
    if (recent.length >= MAX_PER_HOUR) {
      throw new ConvexError({
        code: "rate_limited",
        message: "You've sent several messages already — we'll reply to those first.",
      });
    }

    const submittedBy = (await getAuthUserId(ctx)) ?? undefined;
    const id = await ctx.db.insert("enquiries", {
      topic: args.topic,
      name,
      email,
      organisation,
      message,
      sourcePath: args.sourcePath?.slice(0, 200),
      submittedBy,
      status: "new",
      createdAt: now,
      updatedAt: now,
    });

    // Tell the admins in-app…
    const meta = TOPIC_META[args.topic as Topic];
    // @full-scan-ok: admin fan-out by role, and roles is an array Convex cannot index
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      const roles = u.roles ?? [];
      if (u.suspendedAt || u.deletedAt) continue;
      if (!roles.includes("super-admin") && !roles.includes("moderator")) continue;
      await maybeInsertNotification(ctx, u._id, "enquiryInApp", {
        kind: "enquiry",
        title: `New ${meta.label.toLowerCase()} enquiry`,
        body: `${name}${organisation ? ` · ${organisation}` : ""}: ${message.slice(0, 120)}`,
        href: "/admin/enquiries",
      });
    }

    // …and forward a copy to the AUF address for that topic.
    const to = process.env.ENQUIRY_INBOX_EMAIL ?? meta.email;
    await ctx.scheduler.runAfter(0, internal.actions.email.send, {
      to,
      subject: `[${meta.label}] ${name}`,
      html: `<p><strong>${escapeHtml(name)}</strong>${organisation ? ` · ${escapeHtml(organisation)}` : ""} &lt;${escapeHtml(email)}&gt;</p>
        <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
        <p style="color:#666">Sent from ${escapeHtml(args.sourcePath ?? "the website")} · manage at /admin/enquiries</p>`,
    });

    return { enquiryId: id };
  },
});

// ----------------------------------------------------------------- admin ---

export const adminList = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    // by_created gives newest-first straight from the index, so neither the
    // full read nor the in-memory sort is needed.
    const rows = await ctx.db
      .query("enquiries")
      .withIndex("by_created")
      .order("desc")
      .collect();
    const handlers = new Map<Id<"users">, string>();
    const out = [];
    for (const r of rows) {
      let handledByName: string | null = null;
      if (r.handledBy) {
        if (!handlers.has(r.handledBy)) {
          const u = await ctx.db.get(r.handledBy);
          handlers.set(r.handledBy, u?.name ?? u?.email ?? "Admin");
        }
        handledByName = handlers.get(r.handledBy) ?? null;
      }
      out.push({
        _id: r._id as string,
        topic: r.topic,
        topicLabel: TOPIC_META[r.topic as Topic]?.label ?? r.topic,
        name: r.name,
        email: r.email,
        organisation: r.organisation ?? null,
        message: r.message,
        sourcePath: r.sourcePath ?? null,
        status: r.status,
        adminNotes: r.adminNotes ?? null,
        handledByName,
        handledAt: r.handledAt ?? null,
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});

/** Count of unhandled enquiries — powers the admin nav badge. */
export const newCount = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const rows = await ctx.db
      .query("enquiries")
      .withIndex("by_status_time", (q) => q.eq("status", "new"))
      .collect();
    return rows.length;
  },
});

export const setStatus = mutation({
  args: { enquiryId: v.id("enquiries"), status: statusValidator },
  handler: withAuditLog(async (ctx, args: {
    enquiryId: Id<"enquiries">;
    status: Status;
  }) => {
    const { userId } = await requireRole(ctx, [...ADMIN_ROLES]);
    const row = await ctx.db.get(args.enquiryId);
    if (!row) throw new ConvexError({ code: "not-found", message: "Enquiry not found" });
    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: args.status,
      handledBy: userId,
      handledAt: now,
      updatedAt: now,
    });
    return {
      action: `enquiry-${args.status}`,
      target: { type: "enquiry", id: row._id },
      metadata: { from: row.status, name: row.name, topic: row.topic },
    };
  }),
});

export const setNotes = mutation({
  args: { enquiryId: v.id("enquiries"), notes: v.string() },
  handler: withAuditLog(async (ctx, args: { enquiryId: Id<"enquiries">; notes: string }) => {
    const { userId } = await requireRole(ctx, [...ADMIN_ROLES]);
    const row = await ctx.db.get(args.enquiryId);
    if (!row) throw new ConvexError({ code: "not-found", message: "Enquiry not found" });
    const notes = args.notes.trim().slice(0, 2000);
    await ctx.db.patch(row._id, {
      adminNotes: notes || undefined,
      handledBy: userId,
      updatedAt: Date.now(),
    });
    return {
      action: "enquiry-note",
      target: { type: "enquiry", id: row._id },
      metadata: { name: row.name },
    };
  }),
});
