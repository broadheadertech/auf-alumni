/**
 * Weekly digest compose (Epic 11 Story 11.2).
 *
 * `composeDigest` gathers the raw rows for one user and maps them through the
 * pure `buildDigestModel` helper (convex/digestModel.ts). Rendering + sending
 * live in `convex/actions/sendDigestEmail.ts` (a `"use node"` action — queries
 * cannot share a node-runtime file, so this module is query-only).
 *
 * Scheduled per-user by `internal.notifications.scheduleWeeklyDigests`
 * (Sunday 18:00 PHT cron). Zero-content users are skipped silently.
 *
 * Privacy invariant (NFR10): every peer profile row passes through
 * `applyPrivacy(profile, { kind: "alumnus", userId: recipient })` before any
 * field reaches the digest model — tier-gated fields (batch/program/city/
 * openTo) that an alumni viewer may not see are absent from the peer row, and
 * the model excludes that peer from any section needing the hidden field.
 */

import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { applyPrivacy } from "./helpers/privacy";
import { DEFAULT_PREFS } from "./notifications";
import {
  buildDigestModel,
  jobMatchesRecipient,
  type DigestEvent,
  type DigestJob,
  type DigestModel,
  type DigestPeer,
} from "./digestModel";

export type ComposedDigest = {
  to: string;
  model: DigestModel;
};

/**
 * Same audience semantics as `profileMatchesAudience` in convex/events.ts:
 * no filter matches everyone; a non-empty batches/programs list must include
 * the recipient's batch/program.
 */
function audienceMatches(
  profile: Doc<"profiles">,
  audience: Doc<"events">["audienceFilter"],
): boolean {
  if (!audience) return true;
  if (
    audience.batches &&
    audience.batches.length > 0 &&
    !audience.batches.includes(profile.batch)
  ) {
    return false;
  }
  if (
    audience.programs &&
    audience.programs.length > 0 &&
    !audience.programs.includes(profile.program)
  ) {
    return false;
  }
  return true;
}

const MAX_EVENT_CANDIDATES = 5;
// Bound the index walk itself, not just the kept rows — a recipient who
// matches no audienceFilter must not scan the entire future-events table.
const MAX_EVENT_SCAN = 200;

export const composeDigest = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<ComposedDigest | null> => {
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt || user.suspendedAt || !user.email) {
      return null;
    }
    // Only verified alumni receive digests.
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile || profile.verifiedAt == null) return null;

    // Re-check prefs at compose time (the user may have opted out between
    // scheduling and send) — same defaults as scheduleWeeklyDigests.
    const prefsRow = await ctx.db
      .query("notificationPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const wantsDigest =
      (prefsRow?.digestFrequency ?? "weekly") === "weekly" &&
      (prefsRow?.prefs?.digestEmail ?? DEFAULT_PREFS.digestEmail);
    if (!wantsDigest) return null;

    const now = Date.now();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Batchmates: verified profiles in the recipient's batch (any program) —
    // feeds both the "recently joined/verified" and mentorship sections.
    // Every peer row is privacy-filtered for an alumni viewer; only fields
    // that survive reach the model (NFR10).
    const batchProfiles = await ctx.db
      .query("profiles")
      .withIndex("by_batch_program", (q) => q.eq("batch", profile.batch))
      .collect();
    const peers: DigestPeer[] = batchProfiles
      .filter((p) => p.userId !== userId && p.verifiedAt != null)
      .map((p) => {
        const safe = applyPrivacy(p, { kind: "alumnus", userId });
        return {
          // Always-include fields (identity + system) per helpers/privacy.ts.
          displayName: safe.displayName ?? p.displayName,
          slug: safe.slug ?? p.slug,
          createdAt: safe.createdAt ?? p.createdAt,
          verifiedAt: safe.verifiedAt,
          // Tier-gated fields — absent when hidden from alumni viewers.
          batch: safe.batch,
          program: safe.program,
          city: safe.city,
          openTo: safe.openTo,
        };
      });

    // Recent published jobs: apply targeting BEFORE the per-job org lookup,
    // cap at 3, then resolve employer names for just those.
    const jobRows = await ctx.db
      .query("jobs")
      .withIndex("by_status_time", (q) => q.eq("status", "published"))
      .order("desc")
      .take(50);
    const matchedJobs = jobRows
      .filter((j) =>
        jobMatchesRecipient(
          {
            id: j._id,
            title: j.title,
            location: j.location,
            status: j.status,
            targetingBatches: j.targetingBatches,
            targetingPrograms: j.targetingPrograms,
          },
          { batch: profile.batch, program: profile.program },
        ),
      )
      .slice(0, 3);
    const jobs: DigestJob[] = [];
    for (const j of matchedJobs) {
      const org = await ctx.db.get(j.employerOrgId);
      jobs.push({
        id: j._id,
        title: j.title,
        companyName: org?.name,
        location: j.location,
        status: j.status,
        targetingBatches: j.targetingBatches,
        targetingPrograms: j.targetingPrograms,
      });
    }

    // Upcoming events (soonest first); skip cancelled / audience-mismatched
    // rows while gathering so a valid event is never lost to a fixed `take`.
    // buildDigestModel picks exactly one.
    const events: DigestEvent[] = [];
    let scannedEvents = 0;
    for await (const e of ctx.db
      .query("events")
      .withIndex("by_starts_at", (q) => q.gt("startsAt", now))
      .order("asc")) {
      if (++scannedEvents > MAX_EVENT_SCAN) break;
      if (e.cancelledAt != null) continue;
      if (!audienceMatches(profile, e.audienceFilter)) continue;
      events.push({
        id: e._id,
        title: e.title,
        startsAt: e.startsAt,
        locationLabel: e.locationLabel,
        cancelledAt: e.cancelledAt,
      });
      if (events.length >= MAX_EVENT_CANDIDATES) break;
    }

    const model = buildDigestModel({
      recipient: {
        displayName: profile.displayName,
        batch: profile.batch,
        program: profile.program,
        city: profile.city,
      },
      peers,
      jobs,
      events,
      now,
      appUrl,
      settingsUrl: `${appUrl}/settings/notifications`,
    });
    if (!model) return null;
    return { to: user.email, model };
  },
});
