/**
 * Email sender — Resend integration (Story 2.5).
 *
 * Actions can make external HTTP calls; mutations cannot. All email sends go
 * through this action so the Resend SDK is only invoked here.
 *
 * Tolerates Resend outages with exponential backoff (NFR30): up to 3 retries
 * on transient failures. Permanent failures (4xx-class errors not 429) log
 * and surface; transient errors retry.
 *
 * Email templates are React Email components in web/src/emails/.
 */

"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internalAction } from "../_generated/server";

const FROM_DEFAULT = "AUF Alumni <hello@aufalumni.example.com>";

async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseMs = 500 }: { attempts?: number; baseMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Retry on network / 5xx / 429. Resend SDK throws; treat all as transient
      // unless we can identify a 4xx-permanent.
      const status = (err as { statusCode?: number })?.statusCode;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err; // permanent
      }
      const delay = baseMs * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export const send = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    from: v.optional(v.string()),
    replyTo: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        "RESEND_API_KEY not set — skipping email send. (",
        args.to,
        ":",
        args.subject,
        ")",
      );
      return { sent: false, reason: "no-api-key" } as const;
    }
    const resend = new Resend(apiKey);
    const from = args.from ?? process.env.EMAIL_FROM_ADDRESS ?? FROM_DEFAULT;

    const result = await withRetry(() =>
      resend.emails.send({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        replyTo: args.replyTo,
      }),
    );
    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
    return { sent: true, id: result.data?.id ?? null } as const;
  },
});
