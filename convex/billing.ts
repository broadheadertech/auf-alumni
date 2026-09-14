/**
 * Billing surface (Epic 16).
 *
 * - Employer can subscribe via processor-hosted checkout (returns a URL).
 * - Webhook handler processes processor events (signed verification + dedup).
 * - Super-admin can comp an employer to a tier.
 * - PCI scope: SAQ-A — card data never touches our servers.
 *
 * v1 returns a placeholder checkout URL; live processor integration lands
 * when the processor (Stripe / PayMongo / Maya) is chosen at Phase 3 start.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";

// @no-audit-required: user self-service initiating checkout; processor handles money.
export const startCheckout = mutation({
  args: {
    employerOrgId: v.id("employerOrgs"),
    planTier: v.string(),
  },
  handler: async (ctx, { employerOrgId, planTier }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const org = await ctx.db.get(employerOrgId);
    if (!org) {
      throw new ConvexError({
        code: "not-found",
        message: "Employer not found",
      });
    }
    // Processor selection deferred. Until live processor is wired in,
    // return a placeholder so the UI flow can be tested end-to-end.
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return {
      checkoutUrl: `${appUrl}/employer/billing?placeholder=true&plan=${encodeURIComponent(
        planTier,
      )}`,
    };
  },
});

/**
 * Plan pricing/quotas. Single source of truth for the demo activation and the
 * billing UI. amountMinor is in centavos (₱ minor units).
 */
export const PLAN_CONFIG: Record<
  string,
  { label: string; quota?: number; amountMinor?: number }
> = {
  starter: { label: "Starter", quota: 1, amountMinor: 200000 },
  growth: { label: "Growth", quota: 5, amountMinor: 500000 },
  scale: { label: "Scale", quota: undefined, amountMinor: undefined },
};

/**
 * Demo plan activation. Until a live payment processor is wired in, this
 * applies the chosen plan directly so the pricing/billing flow works
 * end-to-end (updates the org's tier + monthly quota, records a subscription
 * and a billing event). No real charge is made.
 */
// @no-audit-required: employer self-service plan change (demo — no real money moves).
export const activateDemoPlan = mutation({
  args: {
    employerOrgId: v.id("employerOrgs"),
    planTier: v.string(),
  },
  handler: async (ctx, { employerOrgId, planTier }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const org = await ctx.db.get(employerOrgId);
    if (!org) {
      throw new ConvexError({
        code: "not-found",
        message: "Employer not found",
      });
    }
    // Only an admin of this org (or a platform admin) can change its plan.
    const user = await ctx.db.get(userId);
    const roles = new Set(user?.roles ?? []);
    const isPlatform = roles.has("super-admin") || roles.has("moderator");
    const isMember = (org.adminUserIds ?? []).includes(userId);
    if (!isPlatform && !isMember) {
      throw new ConvexError({
        code: "forbidden",
        message: "You don't manage this employer organisation",
      });
    }
    const plan = PLAN_CONFIG[planTier];
    if (!plan) {
      throw new ConvexError({
        code: "validation",
        message: `Unknown plan: ${planTier}`,
      });
    }

    const now = Date.now();
    // Retire any current active subscription so getMyBilling's .unique() holds.
    const actives = await ctx.db
      .query("subscriptions")
      .withIndex("by_employer_status", (q) =>
        q.eq("employerOrgId", employerOrgId).eq("status", "active"),
      )
      .collect();
    for (const s of actives) {
      await ctx.db.patch(s._id, { status: "canceled", cancelledAt: now });
    }
    await ctx.db.insert("subscriptions", {
      employerOrgId,
      processor: "demo",
      planTier,
      status: "active",
      quotaPerMonth: plan.quota,
      activatedAt: now,
    });
    await ctx.db.patch(employerOrgId, {
      planTier,
      jobPostQuota: plan.quota,
      updatedAt: now,
    });
    await ctx.db.insert("billingEvents", {
      employerOrgId,
      processor: "demo",
      eventId: `demo-${employerOrgId}-${now}`,
      eventType: `plan.activated:${planTier}`,
      amountMinor: plan.amountMinor,
      currency: "PHP",
      raw: { demo: true, planTier },
      receivedAt: now,
    });
    return { ok: true, planTier, quota: plan.quota ?? null };
  },
});

export const recordWebhookEvent = mutation({
  args: {
    employerOrgId: v.id("employerOrgs"),
    processor: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    amountMinor: v.optional(v.number()),
    currency: v.optional(v.string()),
    raw: v.any(),
  },
  handler: async (ctx, args) => {
    // Dedup
    const existing = await ctx.db
      .query("billingEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (existing) return { deduped: true };
    await ctx.db.insert("billingEvents", {
      employerOrgId: args.employerOrgId,
      processor: args.processor,
      eventId: args.eventId,
      eventType: args.eventType,
      amountMinor: args.amountMinor,
      currency: args.currency,
      raw: args.raw,
      receivedAt: Date.now(),
    });
    return { deduped: false };
  },
});

export const getMyBilling = query({
  args: { employerOrgId: v.id("employerOrgs") },
  handler: async (ctx, { employerOrgId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const org = await ctx.db.get(employerOrgId);
    if (!org) return null;

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_employer_status", (q) =>
        q.eq("employerOrgId", employerOrgId).eq("status", "active"),
      )
      .unique();
    const events = await ctx.db
      .query("billingEvents")
      .withIndex("by_employer_time", (q) =>
        q.eq("employerOrgId", employerOrgId),
      )
      .order("desc")
      .take(20);
    return {
      org: {
        name: org.name,
        planTier: org.planTier,
        jobPostsUsed: org.jobPostsUsed,
        jobPostQuota: org.jobPostQuota,
      },
      subscription: sub,
      events,
    };
  },
});

export const compEmployer = mutation({
  args: {
    employerOrgId: v.id("employerOrgs"),
    tier: v.string(),
    reason: v.string(),
  },
  handler: withAuditLog(async (ctx, { employerOrgId, tier, reason }) => {
    await requireRole(ctx, ["super-admin"]);
    const org = await ctx.db.get(employerOrgId);
    if (!org) {
      throw new ConvexError({
        code: "not-found",
        message: "Employer not found",
      });
    }
    await ctx.db.patch(employerOrgId, { tier, planTier: `${tier}-comp` });
    const now = Date.now();
    await ctx.db.insert("subscriptions", {
      employerOrgId,
      processor: "manual-comp",
      planTier: `${tier}-comp`,
      status: "comp",
      quotaPerMonth: undefined,
      activatedAt: now,
    });
    return {
      action: "comp-employer",
      target: { type: "employerOrg", id: employerOrgId },
      reason,
      metadata: { tier },
    };
  }),
});
