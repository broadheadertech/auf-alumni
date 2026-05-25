/**
 * Privacy-aware query helper (Story 1.3) — the architectural invariant for NFR10.
 *
 * Every Convex query that reads profile data MUST pass results through
 * `applyPrivacy` (or carry an explicit `// @no-privacy-required:` annotation).
 * The lint script at web/scripts/lint-privacy-usage.mjs enforces this; the
 * test at web/convex/tests/privacy.test.ts enumerates the full matrix.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type PrivacyTier = "public" | "alumni" | "connections" | "private";

const TIER_RANK: Record<PrivacyTier, number> = {
  public: 0,
  alumni: 1,
  connections: 2,
  private: 3,
};

export type ViewerContext =
  | { kind: "stranger" }
  | { kind: "alumnus"; userId: Id<"users"> }
  | { kind: "connection"; userId: Id<"users"> }
  | { kind: "self"; userId: Id<"users"> };

const VIEWER_RANK: Record<ViewerContext["kind"], number> = {
  stranger: 0,
  alumnus: 1,
  connection: 2,
  self: 3,
};

/**
 * Fields always returned regardless of viewer entitlement.
 * These are identity + system fields the schema considers non-tieable.
 */
const ALWAYS_INCLUDE = new Set<string>([
  "_id",
  "_creationTime",
  "userId",
  "slug",
  "displayName",
  "initials",
  "verifiedAt",
  "createdAt",
  "updatedAt",
  "excludeFromSearchEngines",
]);

const DEFAULT_TIER: PrivacyTier = "alumni";

export function applyPrivacy<T extends Doc<"profiles">>(
  profile: T,
  viewer: ViewerContext,
): Partial<T> {
  const viewerRank = VIEWER_RANK[viewer.kind];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(profile)) {
    if (ALWAYS_INCLUDE.has(key)) {
      result[key] = value;
      continue;
    }
    // privacyTiers metadata itself is visible to self only
    if (key === "privacyTiers") {
      if (viewer.kind === "self") result[key] = value;
      continue;
    }
    const tierStr = profile.privacyTiers?.[key];
    const fieldTier: PrivacyTier =
      tierStr && TIER_RANK[tierStr as PrivacyTier] !== undefined
        ? (tierStr as PrivacyTier)
        : DEFAULT_TIER;
    if (viewerRank >= TIER_RANK[fieldTier]) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

/**
 * Resolves the viewer's relationship to a profile.
 *
 * NOTE: `connection` detection is stubbed in v1 — it currently returns "alumnus"
 * for any authenticated non-owner because the `connections` table lands in
 * Story 5.1. When 5.1 ships, replace the TODO with a real check.
 */
export async function getViewerContext(
  ctx: QueryCtx,
  profileUserId: Id<"users">,
): Promise<ViewerContext> {
  const viewerId = await getAuthUserId(ctx);
  if (!viewerId) return { kind: "stranger" };
  const viewerUser = await ctx.db.get(viewerId);
  if (!viewerUser || viewerUser.deletedAt) return { kind: "stranger" };

  if (viewerUser._id === profileUserId) {
    return { kind: "self", userId: viewerUser._id };
  }

  // Story 5.1: check connections table — promote to "connection" if a
  // "connected" row exists between viewer and profile owner. Pair normalised
  // (userA < userB) so one indexed lookup suffices regardless of order.
  const [userA, userB] =
    viewerUser._id < profileUserId
      ? [viewerUser._id, profileUserId]
      : [profileUserId, viewerUser._id];
  const conn = await ctx.db
    .query("connections")
    .withIndex("by_pair", (q) => q.eq("userA", userA).eq("userB", userB))
    .unique();
  if (conn && conn.status === "connected") {
    return { kind: "connection", userId: viewerUser._id };
  }

  const roles = viewerUser.roles ?? [];
  if (
    roles.includes("alumnus") ||
    roles.includes("current-student") ||
    roles.includes("super-admin") ||
    roles.includes("verifier") ||
    roles.includes("moderator")
  ) {
    return { kind: "alumnus", userId: viewerUser._id };
  }
  return { kind: "stranger" };
}
