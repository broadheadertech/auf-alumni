"use client";

/**
 * PostHog analytics provider — captures pageviews + lets us call
 * `posthog.identify` / `posthog.capture` from anywhere via the hook.
 *
 * Gracefully no-ops when `NEXT_PUBLIC_POSTHOG_KEY` is unset, so local dev
 * and demo deploys without an analytics project still work.
 */

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let initialised = false;

function ensureInit() {
  if (initialised || typeof window === "undefined" || !KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false, // we capture manually below so SPA navs are tracked
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
  initialised = true;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    ensureInit();
  }, []);

  useEffect(() => {
    if (!initialised) return;
    if (!pathname) return;
    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
