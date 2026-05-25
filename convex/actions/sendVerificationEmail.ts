/**
 * sendVerificationEmail action (Story 2.5).
 *
 * Renders the appropriate React Email template and dispatches via the `send`
 * action. Called from admin mutations via `ctx.scheduler.runAfter(0, ...)`
 * because mutations cannot perform network IO.
 *
 * Email kinds:
 *   - "submitted"     — auto-sent on manual submission
 *   - "approved"      — admin approved
 *   - "rejected"      — admin rejected (carries reason)
 *   - "info-requested" — admin asked for more info (carries message)
 */

"use node";

import { v } from "convex/values";
import { render } from "@react-email/render";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { VerificationSubmittedEmail } from "../../src/emails/VerificationSubmitted";
import { VerificationApprovedEmail } from "../../src/emails/VerificationApproved";
import { VerificationRejectedEmail } from "../../src/emails/VerificationRejected";
import { VerificationInfoRequestedEmail } from "../../src/emails/VerificationInfoRequested";

export const sendVerificationEmail = internalAction({
  args: {
    to: v.string(),
    recipientName: v.optional(v.string()),
    kind: v.union(
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("info-requested"),
    ),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { to, recipientName, kind, message }): Promise<unknown> => {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    let subject: string;
    let html: string;

    if (kind === "submitted") {
      subject = "We received your AUF verification";
      html = await render(VerificationSubmittedEmail({ recipientName }));
    } else if (kind === "approved") {
      subject = "You're verified — welcome to AUF Alumni";
      html = await render(
        VerificationApprovedEmail({
          recipientName,
          directoryUrl: `${appUrl}/directory`,
        }),
      );
    } else if (kind === "rejected") {
      subject = "An update on your AUF verification";
      html = await render(
        VerificationRejectedEmail({
          recipientName,
          reason: message ?? "Your submission did not match our records.",
          reapplyUrl: `${appUrl}/verify`,
        }),
      );
    } else {
      subject = "We need a small update to your AUF verification";
      html = await render(
        VerificationInfoRequestedEmail({
          recipientName,
          message:
            message ?? "Please re-upload a clearer copy of your documents.",
          updateUrl: `${appUrl}/verify`,
        }),
      );
    }

    return await ctx.runAction(internal.actions.email.send, {
      to,
      subject,
      html,
    });
  },
});
