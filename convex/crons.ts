/**
 * Scheduled cron jobs.
 *
 * Each job is bounded to small batch sizes per run. Convex's built-in retry
 * semantics (NFR22) handle transient failures.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Epic 3 / 7 — SPI + soft-delete cleanup
crons.daily(
  "purge old verification artifacts",
  { hourUTC: 17, minuteUTC: 0 }, // 01:00 PHT
  internal.profiles.purgeOldVerificationArtifacts,
);
crons.daily(
  "hard-delete soft-deleted users past grace",
  { hourUTC: 18, minuteUTC: 0 }, // 02:00 PHT
  internal.profiles.purgeExpiredSoftDeletes,
);

// Epic 8 — work-anniversary auto-posts
crons.daily(
  "generate work-anniversary posts",
  { hourUTC: 0, minuteUTC: 0 }, // 08:00 PHT
  internal.feed.generateWorkAnniversaryPosts,
);

// Epic 9 — event reminders (24h + 1h windows)
crons.hourly(
  "send event reminders",
  { minuteUTC: 5 },
  internal.events.sendDueReminders,
);

// Epic 11 — weekly digest scheduling
crons.weekly(
  "schedule weekly digests",
  { dayOfWeek: "sunday", hourUTC: 10, minuteUTC: 0 }, // 18:00 PHT Sunday
  internal.notifications.scheduleWeeklyDigests,
);

export default crons;
