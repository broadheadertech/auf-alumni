/**
 * Clear seeded demo content (one-shot). Run with:
 *
 *   npx convex run clearDemo:run
 *
 * Deletes the demo profiles, jobs, employers, events, posts, etc. planted by
 * `seed:run` so the app starts clean. Leaves auth accounts (users /
 * authAccounts) intact — those are managed by seedAccounts:run.
 *
 * Destructive. Demo content is re-creatable via seed:run.
 */

import { internalMutation } from "./_generated/server";
import type { TableNames } from "./_generated/dataModel";

const CONTENT_TABLES: TableNames[] = [
  "profiles",
  "jobs",
  "applications",
  "employerOrgs",
  "events",
  "rsvps",
  "posts",
  "connections",
  "blocks",
  "follows",
  "endorsements",
  "recommendations",
  "academyCourses",
  "academyLessons",
  "academyEnrollments",
  "mentorshipRequests",
  "referrals",
  "notifications",
  "notificationPrefs",
  "messages",
  "messageThreads",
  "verificationSubmissions",
  "subscriptions",
  "billingEvents",
  "reports",
  "dataSubjectRequests",
  "incidents",
  "idCards",
  "cardActivations",
];

export const run = internalMutation({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    for (const table of CONTENT_TABLES) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) await ctx.db.delete(row._id);
      counts[table] = rows.length;
    }
    return counts;
  },
});
