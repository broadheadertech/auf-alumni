/**
 * sendDigestEmail action (Epic 11 Story 11.2).
 *
 * Per-user weekly digest render + send, mirroring sendConnectionEmail.ts:
 * `"use node"` (React Email rendering needs the node runtime), compose via
 * internal.digest.composeDigest, render with @react-email/render, dispatch
 * through internal.actions.email.send (which already retries).
 *
 * A per-user failure is caught + logged so it never throws back to the
 * scheduler — other users' digests are unaffected; this user is skipped
 * this week.
 */

"use node";

import { createElement } from "react";
import { v } from "convex/values";
import { render } from "@react-email/render";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { WeeklyDigest } from "../../src/emails/WeeklyDigest";
import { digestHighlight } from "../digestModel";
import type { ComposedDigest } from "../digest";

const SUBJECT_MAX = 120;

/** Header-safe subject: no CR/LF, collapsed whitespace, capped length. */
function sanitizeSubject(raw: string): string {
  const collapsed = raw.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  // Truncate by code point so a surrogate pair (emoji in a display name)
  // is never split at the cap.
  const points = [...collapsed];
  if (points.length <= SUBJECT_MAX) return collapsed;
  return `${points.slice(0, SUBJECT_MAX - 1).join("").trimEnd()}…`;
}

export const sendDigestEmail = internalAction({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    { userId },
  ): Promise<{ sent: boolean; reason?: string }> => {
    try {
      const composed: ComposedDigest | null = await ctx.runQuery(
        internal.digest.composeDigest,
        { userId },
      );
      if (!composed) {
        // Zero-content rule (or ineligible/opted-out): send nothing.
        return { sent: false, reason: "no-content" };
      }
      const html = await render(createElement(WeeklyDigest, composed.model));
      const subject = sanitizeSubject(
        `Your AUF Alumni week — ${digestHighlight(composed.model)}`,
      );
      const result: { sent: boolean; reason?: string } = await ctx.runAction(
        internal.actions.email.send,
        { to: composed.to, subject, html },
      );
      // Propagate the provider result honestly — a skipped/failed send must
      // not be reported as sent.
      if (!result.sent) {
        return { sent: false, reason: result.reason ?? "send-failed" };
      }
      return { sent: true };
    } catch (err) {
      console.error("Weekly digest failed for user", userId, err);
      return { sent: false, reason: "error" };
    }
  },
});
