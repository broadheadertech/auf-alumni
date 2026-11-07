import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";

const http = httpRouter();
auth.addHttpRoutes(http);

/**
 * Payment-processor webhook.
 *
 * `billing.recordWebhookEvent` used to be a public mutation anyone could call,
 * which would have let a stranger forge payment events once a real processor
 * was connected. It is internal now, and this endpoint is the only way in.
 *
 * Verification is HMAC-SHA256 over the raw body with a shared secret, which is
 * the scheme Stripe, PayMongo and Maya all use (header name differs per
 * processor; adjust `SIGNATURE_HEADERS` when wiring one up).
 *
 * Fails closed: with no BILLING_WEBHOOK_SECRET configured every request is
 * rejected, so an unconfigured deployment is shut rather than open.
 */
const SIGNATURE_HEADERS = [
  "x-signature",
  "stripe-signature",
  "paymongo-signature",
];

/** Timing-safe comparison, so a wrong signature leaks nothing by how long it took. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

http.route({
  path: "/billing/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.BILLING_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[billing] webhook rejected: BILLING_WEBHOOK_SECRET unset");
      return new Response("Webhook not configured", { status: 503 });
    }

    const provided = SIGNATURE_HEADERS.map((h) => request.headers.get(h)).find(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (!provided) return new Response("Missing signature", { status: 401 });

    // Read the body once, as text — the signature covers the raw bytes.
    const raw = await request.text();
    const expected = await hmacHex(secret, raw);
    if (!safeEqual(provided.trim().toLowerCase(), expected)) {
      return new Response("Bad signature", { status: 401 });
    }

    let payload: {
      employerOrgId?: string;
      processor?: string;
      eventId?: string;
      eventType?: string;
      amountMinor?: number;
      currency?: string;
    };
    try {
      payload = JSON.parse(raw);
    } catch {
      return new Response("Malformed JSON", { status: 400 });
    }

    const { employerOrgId, processor, eventId, eventType } = payload;
    if (!employerOrgId || !processor || !eventId || !eventType) {
      return new Response("Missing required fields", { status: 400 });
    }

    const result = await ctx.runMutation(internal.billing.recordWebhookEvent, {
      employerOrgId: employerOrgId as never,
      processor,
      eventId,
      eventType,
      amountMinor: payload.amountMinor,
      currency: payload.currency,
      raw: payload,
    });

    return Response.json(result);
  }),
});

export default http;
