/**
 * sendCardIssued action — emails an alumna that her physical Alumni ID card
 * has been issued, with a single-use link to set her PIN. Sent via Resend
 * through the shared `email.send` action.
 *
 * Public action so the admin ID-card surface can call it after binding a card.
 */

"use node";

import { v } from "convex/values";
import { render } from "@react-email/render";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { CardIssuedEmail } from "../../src/emails/CardIssued";

export const sendCardIssued = action({
  args: {
    to: v.string(),
    recipientName: v.optional(v.string()),
    activationUrl: v.string(),
  },
  handler: async (ctx, { to, recipientName, activationUrl }): Promise<unknown> => {
    const html = await render(
      CardIssuedEmail({ recipientName, activationUrl }),
    );
    return await ctx.runAction(internal.actions.email.send, {
      to,
      subject: "Your AUF Alumni ID is ready — set your PIN",
      html,
    });
  },
});
