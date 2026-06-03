/**
 * Sentry instrumentation entrypoint (Next.js 16 convention).
 *
 * Runs once per server / edge runtime boot. We initialise Sentry only when
 * `NEXT_PUBLIC_SENTRY_DSN` is set — that way local dev and the demo deploy
 * don't try to ship events to a non-existent project.
 */

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function register() {
  if (!DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: DSN,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
    });
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: DSN,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
