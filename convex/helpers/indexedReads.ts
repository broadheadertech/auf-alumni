/**
 * Indexed reads for the two filters almost every read path repeats.
 *
 * Both of these used to be written as "collect the whole table, then filter in
 * JavaScript". That is correct but it reads every row, so the cost grows with
 * the roster rather than with the answer — and the directory, which is the
 * hottest page in the app, did it twice per request.
 *
 * The trick both helpers rely on: `suspendedAt`, `deletedAt` and `verifiedAt`
 * are all `v.optional(v.number())`, and Convex sorts `undefined` below every
 * number. So a `.gt(field, 0)` range over an index on that field returns
 * exactly the rows where the field is set — the same set as `field != null`,
 * without touching the rows where it isn't. `0` is a safe floor because these
 * are all epoch-millisecond stamps, and a real one is never <= 0.
 *
 * Privacy note: verifiedProfiles() returns raw `profiles` documents, exactly
 * as `ctx.db.query("profiles").collect()` did. Callers remain responsible for
 * passing rows through applyPrivacy() before returning them, and
 * scripts/lint-privacy-usage.mjs treats a call to this helper as a profiles
 * read so routing through it does not escape that check.
 */

import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/**
 * Every verified profile.
 *
 * Replaces `ctx.db.query("profiles").collect()` followed by a
 * `p.verifiedAt != null` filter. Unverified rows are never read.
 */
export async function verifiedProfiles(ctx: QueryCtx): Promise<Array<Doc<"profiles">>> {
  // @no-privacy-required: returns raw rows by design; callers apply privacy. See the module docstring.
  return await ctx.db
    .query("profiles")
    .withIndex("by_verified", (q) => q.gt("verifiedAt", 0))
    .collect();
}

/**
 * Users an admin deactivated, rejected, suspended or deleted — never listed.
 *
 * Reads the two "switched off" indexes instead of the whole users table. The
 * two sets overlap (a deleted account is usually suspended first), so this
 * unions them.
 */
export async function hiddenUserIds(ctx: QueryCtx): Promise<Set<string>> {
  const [suspended, deleted] = await Promise.all([
    ctx.db
      .query("users")
      .withIndex("by_suspended", (q) => q.gt("suspendedAt", 0))
      .collect(),
    ctx.db
      .query("users")
      .withIndex("by_deleted", (q) => q.gt("deletedAt", 0))
      .collect(),
  ]);
  const hidden = new Set<string>();
  for (const u of suspended) hidden.add(u._id as string);
  for (const u of deleted) hidden.add(u._id as string);
  return hidden;
}
