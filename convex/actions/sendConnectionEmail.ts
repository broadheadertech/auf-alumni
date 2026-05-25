/**
 * sendConnectionEmail action (Epic 5 Story 5.5).
 *
 * Wraps email.send with React Email templates for connection-request +
 * connection-accepted notifications.
 */

"use node";

import { v } from "convex/values";
import { render } from "@react-email/render";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { ConnectionRequestEmail } from "../../src/emails/ConnectionRequest";
import { ConnectionAcceptedEmail } from "../../src/emails/ConnectionAccepted";

export const sendConnectionEmail = internalAction({
  args: {
    to: v.string(),
    recipientName: v.optional(v.string()),
    requesterName: v.string(),
    note: v.optional(v.string()),
    kind: v.union(
      v.literal("request-received"),
      v.literal("request-accepted"),
    ),
  },
  handler: async (ctx, { to, recipientName, requesterName, note, kind }): Promise<unknown> => {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    let subject: string;
    let html: string;
    if (kind === "request-received") {
      subject = `${requesterName} wants to connect on AUF Alumni`;
      html = await render(
        ConnectionRequestEmail({
          recipientName,
          requesterName,
          note,
          inboxUrl: `${appUrl}/connections`,
        }),
      );
    } else {
      subject = `${requesterName} accepted your connection request`;
      html = await render(
        ConnectionAcceptedEmail({
          recipientName,
          requesterName,
          directoryUrl: `${appUrl}/directory`,
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
