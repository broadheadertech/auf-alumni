"use client";

/**
 * A "current time" for Convex queries with time-relative fields (upcoming
 * events, contract expiry, "this week"), rounded down to `stepMs`.
 *
 * Passing it as a query arg makes results refresh as time passes, while the
 * rounding keeps the arg stable between steps so subscriptions aren't
 * re-created on every render. See `asOfArg` in convex/adminData.ts.
 */

import { useEffect, useState } from "react";

const FIVE_MINUTES = 5 * 60 * 1000;

function rounded(stepMs: number): number {
  return Math.floor(Date.now() / stepMs) * stepMs;
}

export function useAsOf(stepMs: number = FIVE_MINUTES): number {
  const [asOf, setAsOf] = useState(() => rounded(stepMs));
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = rounded(stepMs);
      setAsOf((prev) => (prev === next ? prev : next));
    }, Math.min(stepMs, 60_000));
    return () => window.clearInterval(id);
  }, [stepMs]);
  return asOf;
}
