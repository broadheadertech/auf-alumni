/**
 * Client-side Sentry init. Mirrors `instrumentation.ts` but runs in the
 * browser. Gated on `NEXT_PUBLIC_SENTRY_DSN` being set.
 */

import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
    ),
    replaysSessionSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SAMPLE_RATE ?? 0,
    ),
    replaysOnErrorSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ERROR_SAMPLE_RATE ?? 0.1,
    ),
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
  });
}

export const onRouterTransitionStart =
  Sentry.captureRouterTransitionStart;
