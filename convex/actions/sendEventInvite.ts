/**
 * sendEventInvite action — emails an alumna an event invitation with one-tap
 * RSVP buttons (Yes / Maybe / No), via Resend. The RSVP links point at the
 * public /rsvp page. Public action so the admin event surface can call it.
 */

"use node";

import { v } from "convex/values";
import { render } from "@react-email/render";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { EventInviteEmail } from "../../src/emails/EventInvite";

export const sendEventInvite = action({
  args: {
    to: v.string(),
    recipientName: v.optional(v.string()),
    eventId: v.string(),
    eventTitle: v.string(),
    eventWhen: v.string(),
    eventLocation: v.string(),
    eventDescription: v.string(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const base = `${appUrl}/rsvp?e=${encodeURIComponent(args.eventId)}`;
    const html = await render(
      EventInviteEmail({
        recipientName: args.recipientName,
        eventTitle: args.eventTitle,
        eventWhen: args.eventWhen,
        eventLocation: args.eventLocation,
        eventDescription: args.eventDescription,
        yesUrl: `${base}&r=yes`,
        maybeUrl: `${base}&r=maybe`,
        noUrl: `${base}&r=no`,
      }),
    );
    return await ctx.runAction(internal.actions.email.send, {
      to: args.to,
      subject: `You're invited: ${args.eventTitle}`,
      html,
    });
  },
});
