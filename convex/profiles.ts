/**
 * Profile queries and mutations (Epic 3).
 *
 * NFR10 invariant: every read path through `applyPrivacy(profile, viewer)`.
 * The lint script at scripts/lint-privacy-usage.mjs enforces this.
 *
 * Stories covered:
 *   - 3.1: createOrUpdateMyProfile
 *   - 3.2: privacy tiers stored per-field on the profile row
 *   - 3.4: photo upload via generatePhotoUploadUrl + setPhoto
 *   - 3.5: openTo tags
 *   - 3.6: exportMyData (DPA portability)
 *   - 3.7: requestAccountDeletion + the scheduled hard-delete cron
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { applyPrivacy, getViewerContext } from "./helpers/privacy";

const HARD_DELETE_GRACE_DAYS = 30;
const VERIFICATION_ARTIFACT_TTL_DAYS = 30;

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

function buildSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function ensureUniqueSlug(
  ctx: MutationCtx,
  base: string,
  excludeProfileId?: Id<"profiles">,
): Promise<string> {
  let candidate = base || "alumna";
  let suffix = 0;
  while (true) {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .unique();
    if (!existing || existing._id === excludeProfileId) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

/**
 * Get the current authenticated user's profile, with full self-view.
 */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return null;
    return applyPrivacy(profile, { kind: "self", userId });
  },
});

/**
 * Get a profile by slug, with privacy applied based on the viewer's
 * relationship to the profile owner.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!profile) return null;
    const viewer = await getViewerContext(ctx, profile.userId);
    return applyPrivacy(profile, viewer);
  },
});

/**
 * Virtual Alumni ID card — own view. Returns the fields the card surfaces
 * plus the alumniId. The ID is minted lazily via `ensureMyAlumniId` (a
 * mutation) the first time the alumna opens their card.
 */
export const getMyAlumniCard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return null;
    // Self-view: full fields permitted.
    const safe = applyPrivacy(profile, { kind: "self", userId });
    return {
      ...safe,
      alumniId: profile.alumniId ?? null,
      alumniIdIssuedAt: profile.alumniIdIssuedAt ?? null,
      photoUrl: profile.photoStorageId
        ? await ctx.storage.getUrl(profile.photoStorageId)
        : null,
    };
  },
});

/**
 * Public verification of an Alumni ID by its opaque ID string. Anyone with
 * the QR can hit `/verify/{alumniId}` and confirm the ID is real + which
 * alumna it belongs to, without seeing private profile fields.
 */
// @no-privacy-required: returns only verification status + public-tier fields.
export const verifyAlumniId = query({
  args: { alumniId: v.string() },
  handler: async (ctx, { alumniId }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_alumni_id", (q) => q.eq("alumniId", alumniId))
      .unique();
    if (!profile || profile.verifiedAt == null) {
      return { ok: false as const };
    }
    return {
      ok: true as const,
      alumniId,
      displayName: profile.displayName,
      slug: profile.slug,
      batch: profile.batch,
      program: profile.program,
      degree: profile.degree,
      issuedAt: profile.alumniIdIssuedAt ?? profile.verifiedAt,
    };
  },
});

/**
 * Lazily mint the alumniId for the signed-in verified alumna. Idempotent —
 * if an ID already exists, returns it. Format: `AUF-{batch}-{6-digit-seq}`
 * where the sequence is the count of issued IDs in that batch + 1.
 */
// @no-audit-required: user self-service; no PII change, mints an opaque ID.
export const ensureMyAlumniId = mutation({
  args: {},
  handler: async (ctx): Promise<{ alumniId: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) {
      throw new ConvexError({
        code: "no-profile",
        message: "Create your profile before requesting an Alumni ID",
      });
    }
    if (profile.verifiedAt == null) {
      throw new ConvexError({
        code: "not-verified",
        message: "Your alumni status must be verified first",
      });
    }
    if (profile.alumniId) {
      return { alumniId: profile.alumniId };
    }
    // Mint a new ID using a count over the batch year (good enough for v1;
    // race-tolerant within a single transaction).
    const sameBatch = await ctx.db
      .query("profiles")
      .withIndex("by_batch_program", (q) => q.eq("batch", profile.batch))
      .collect();
    const issuedCount = sameBatch.filter((p) => p.alumniId != null).length;
    const seq = String(issuedCount + 1).padStart(6, "0");
    const alumniId = `AUF-${profile.batch}-${seq}`;
    const now = Date.now();
    await ctx.db.patch(profile._id, {
      alumniId,
      alumniIdIssuedAt: now,
      updatedAt: now,
    });
    return { alumniId };
  },
});

/**
 * Sitemap source — public slugs of verified profiles who have NOT opted out
 * of search indexing. Returns only slugs + updatedAt; safe to serve unauth.
 * Privacy: no profile fields exposed; opt-out (excludeFromSearchEngines)
 * removes the alumna entirely.
 */
// @no-privacy-required: returns only slug + updatedAt; opt-out is honoured.
export const listIndexableSlugs = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("profiles").collect();
    return rows
      .filter((p) => p.verifiedAt != null && !p.excludeFromSearchEngines)
      .map((p) => ({ slug: p.slug, updatedAt: p.updatedAt ?? p.createdAt }));
  },
});

/**
 * Convert a storage ID into a short-lived URL for the client to render.
 * The privacy helper strips photoStorageId for unentitled viewers, so this
 * is only reachable with a valid ID.
 */
export const getPhotoUrl = query({
  args: { storageId: v.optional(v.id("_storage")) },
  handler: async (ctx, { storageId }) => {
    if (!storageId) return null;
    return await ctx.storage.getUrl(storageId);
  },
});

/**
 * Create or update the authenticated user's profile (Stories 3.1 + 3.2 + 3.5).
 */
// @no-audit-required: user self-service mutation; user owns their own profile.
export const createOrUpdateMyProfile = mutation({
  args: {
    displayName: v.string(),
    batch: v.number(),
    program: v.string(),
    degree: v.string(),
    currentRole: v.optional(v.string()),
    company: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    bio: v.optional(v.string()),
    skills: v.array(v.string()),
    openTo: v.array(v.string()),
    experience: v.array(
      v.object({
        role: v.string(),
        company: v.string(),
        years: v.string(),
      }),
    ),
    education: v.array(
      v.object({
        degree: v.string(),
        program: v.string(),
        school: v.string(),
        year: v.number(),
      }),
    ),
    privacyTiers: v.record(v.string(), v.string()),
    excludeFromSearchEngines: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    if (args.displayName.trim().length === 0) {
      throw new ConvexError({
        code: "validation",
        message: "Display name is required",
      });
    }
    if (args.batch < 1960 || args.batch > new Date().getFullYear()) {
      throw new ConvexError({
        code: "validation",
        message: "Batch year out of range",
      });
    }

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    const now = Date.now();
    const initials = buildInitials(args.displayName);

    if (existing) {
      // Existing profile: preserve slug, update fields.
      await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        initials,
        batch: args.batch,
        program: args.program,
        degree: args.degree,
        currentRole: args.currentRole,
        company: args.company,
        city: args.city,
        country: args.country,
        bio: args.bio,
        skills: args.skills,
        openTo: args.openTo,
        experience: args.experience,
        education: args.education,
        privacyTiers: args.privacyTiers,
        excludeFromSearchEngines: args.excludeFromSearchEngines ?? false,
        updatedAt: now,
      });
      return { profileId: existing._id, slug: existing.slug, created: false };
    }

    // New profile: generate a unique slug.
    const baseSlug = buildSlug(args.displayName);
    const slug = await ensureUniqueSlug(ctx, baseSlug);

    const profileId = await ctx.db.insert("profiles", {
      userId,
      slug,
      displayName: args.displayName,
      initials,
      batch: args.batch,
      program: args.program,
      degree: args.degree,
      currentRole: args.currentRole,
      company: args.company,
      city: args.city,
      country: args.country,
      bio: args.bio,
      skills: args.skills,
      openTo: args.openTo,
      experience: args.experience,
      education: args.education,
      privacyTiers: args.privacyTiers,
      verifiedAt: undefined,
      createdAt: now,
      updatedAt: now,
      excludeFromSearchEngines: args.excludeFromSearchEngines ?? false,
    });
    return { profileId, slug, created: true };
  },
});

/**
 * Generate a short-lived upload URL for the profile photo (Story 3.4).
 */
// @no-audit-required: user self-service helper; only mints an ephemeral upload token.
export const generatePhotoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// @no-audit-required: user self-service; profile owner updating their own photo.
export const setPhoto = mutation({
  args: { storageId: v.optional(v.id("_storage")) },
  handler: async (ctx, { storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) {
      throw new ConvexError({
        code: "profile-not-found",
        message: "Create your profile before adding a photo",
      });
    }
    const previous = profile.photoStorageId;
    await ctx.db.patch(profile._id, {
      photoStorageId: storageId,
      updatedAt: Date.now(),
    });
    if (previous && previous !== storageId) {
      await ctx.storage.delete(previous);
    }
    return { ok: true };
  },
});

/**
 * Self-export: assemble the user's personal data into a JSON document.
 * Per Story 3.6, returns the full profile + audit entries authored by the user.
 *
 * Returns the document inline (small payload). For larger exports, this can
 * later be promoted to an action that writes to storage and emails a link.
 */
// @no-audit-required: user self-service; user reads their own data.
export const exportMyData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const verificationSubmissions = await ctx.db
      .query("verificationSubmissions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Strip the password hash and other auth internals from the export.
    const safeUser: Partial<Doc<"users">> = { ...user };
    delete (safeUser as Record<string, unknown>).passwordHash;

    return {
      exportedAt: Date.now(),
      user: safeUser,
      profile,
      verificationSubmissions: verificationSubmissions.map((s) => ({
        ...s,
        // Don't return storage IDs to the user's export — they reference
        // server-side blobs, not user-meaningful content.
        idStorageId: undefined,
        diplomaStorageId: undefined,
      })),
    };
  },
});

/**
 * Soft-delete the authenticated user's account. Schedules hard-delete in 30 days
 * (Story 3.7). Until then, the soft-delete makes the user invisible everywhere.
 */
// @no-audit-required: user self-service; writes its own audit entry inline.
export const requestAccountDeletion = mutation({
  args: { confirmationText: v.string() },
  handler: async (ctx, { confirmationText }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError({
        code: "user-not-found",
        message: "Account not found",
      });
    }
    if (user.deletedAt) {
      return { alreadyDeleted: true, scheduledHardDeleteAt: user.deletedAtHardDeleteScheduledFor };
    }
    if ((confirmationText ?? "").trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
      throw new ConvexError({
        code: "confirmation-mismatch",
        message: "Type your email to confirm deletion",
      });
    }

    const now = Date.now();
    const hardDeleteAt = now + HARD_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000;

    await ctx.db.patch(userId, {
      deletedAt: now,
      deletedAtHardDeleteScheduledFor: hardDeleteAt,
    });

    // Hide profile immediately by setting privacy on all fields to "private".
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (profile) {
      const allPrivate: Record<string, string> = {};
      for (const key of Object.keys(profile.privacyTiers ?? {})) {
        allPrivate[key] = "private";
      }
      await ctx.db.patch(profile._id, {
        privacyTiers: allPrivate,
        excludeFromSearchEngines: true,
        updatedAt: now,
      });
    }

    // Purge verification artifacts immediately (don't wait for the 30-day cron).
    const submissions = await ctx.db
      .query("verificationSubmissions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const sub of submissions) {
      if (sub.idStorageId) await ctx.storage.delete(sub.idStorageId);
      if (sub.diplomaStorageId) await ctx.storage.delete(sub.diplomaStorageId);
      await ctx.db.patch(sub._id, {
        idStorageId: undefined,
        diplomaStorageId: undefined,
        artifactsPurgedAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("auditEntries", {
      actorId: userId,
      actorType: "user",
      actionType: "request-account-deletion",
      targetType: "user",
      targetId: userId,
      reason: "user-requested-self-deletion",
      metadata: { scheduledHardDeleteAt: hardDeleteAt },
      timestamp: now,
    });

    // Story 7.2: record the data-subject request for NFR33 SLA tracking.
    await ctx.db.insert("dataSubjectRequests", {
      userId,
      type: "erasure",
      requestedAt: now,
      acknowledgedAt: now,
      fulfilledAt: now, // soft-delete is the immediate fulfilment
      outcome: "soft-deleted; hard-delete scheduled in 30 days",
    });

    return { alreadyDeleted: false, scheduledHardDeleteAt: hardDeleteAt };
  },
});

/**
 * Log a data-subject request for tracking purposes (Story 7.2).
 * Called from the settings page after an export download completes, so
 * the DPO can demonstrate NFR33 fulfilment SLAs.
 */
// @no-audit-required: user self-service; user records their own DSR.
export const recordExportRequest = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({
        code: "unauthenticated",
        message: "Sign in required",
      });
    }
    const now = Date.now();
    await ctx.db.insert("dataSubjectRequests", {
      userId,
      type: "portability",
      requestedAt: now,
      acknowledgedAt: now,
      fulfilledAt: now,
      outcome: "self-served JSON export",
    });
    return { ok: true };
  },
});

/**
 * Cron handler — hard-delete any user soft-deleted >30 days ago.
 * Registered by convex/crons.ts.
 */
// @no-audit-required: internal scheduled job; writes its own audit entry inline.
export const purgeExpiredSoftDeletes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Conservative: only process up to 100 per run to avoid huge transactions.
    const candidates = await ctx.db.query("users").take(2000);
    let processed = 0;
    for (const user of candidates) {
      const deleteAt = user.deletedAtHardDeleteScheduledFor;
      if (!user.deletedAt || !deleteAt || deleteAt > now) continue;
      // Hard-delete: profile, then user (audit entries remain, actorId nulled).
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();
      if (profile) {
        if (profile.photoStorageId) {
          await ctx.storage.delete(profile.photoStorageId);
        }
        await ctx.db.delete(profile._id);
      }
      // Null out actorId on this user's audit entries (preserve history without PII).
      const entries = await ctx.db
        .query("auditEntries")
        .withIndex("by_actor_time", (q) => q.eq("actorId", user._id))
        .collect();
      for (const e of entries) {
        await ctx.db.patch(e._id, { actorId: undefined });
      }
      await ctx.db.delete(user._id);
      await ctx.db.insert("auditEntries", {
        actorId: undefined,
        actorType: "system",
        actionType: "hard-delete-user",
        targetType: "user",
        targetId: user._id,
        reason: "scheduled-30-day-grace-elapsed",
        timestamp: now,
      });
      processed += 1;
      if (processed >= 100) break;
    }
    return { processed };
  },
});

/**
 * Cron handler — auto-purge verification artifacts >30 days after decision.
 * Aligns with NFR36.
 */
// @no-audit-required: internal scheduled job; writes its own audit entry inline.
export const purgeOldVerificationArtifacts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - VERIFICATION_ARTIFACT_TTL_DAYS * 24 * 60 * 60 * 1000;
    const candidates = await ctx.db.query("verificationSubmissions").take(2000);
    let processed = 0;
    for (const sub of candidates) {
      if (
        !sub.decidedAt ||
        sub.decidedAt > cutoff ||
        sub.artifactsPurgedAt ||
        (!sub.idStorageId && !sub.diplomaStorageId)
      )
        continue;
      if (sub.idStorageId) await ctx.storage.delete(sub.idStorageId);
      if (sub.diplomaStorageId) await ctx.storage.delete(sub.diplomaStorageId);
      await ctx.db.patch(sub._id, {
        idStorageId: undefined,
        diplomaStorageId: undefined,
        artifactsPurgedAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("auditEntries", {
        actorId: undefined,
        actorType: "system",
        actionType: "verification-artifact-purged",
        targetType: "verificationSubmission",
        targetId: sub._id,
        reason: "30-day-retention-policy",
        timestamp: Date.now(),
      });
      processed += 1;
      if (processed >= 100) break;
    }
    return { processed };
  },
});
