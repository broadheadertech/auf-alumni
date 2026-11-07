"use client";

/**
 * Route-level error boundary.
 *
 * Before this existed, anything that threw during render gave the visitor a
 * blank white page: no message, no way back, and nothing reported. Next needs
 * an explicit boundary to catch it.
 *
 * `reset()` re-renders the segment, which is usually enough for a transient
 * failure (a dropped Convex socket, a slow query that timed out). The digest
 * is shown because it is the id Sentry and the server logs share — quoting it
 * in a support message makes the error findable.
 */

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { RefreshCw } from "lucide-react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[520px] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-serif text-[26px] font-semibold">
        Something went wrong
      </h1>
      <p className="mt-2 text-[14.5px] ink-2">
        This page didn&apos;t load. It is usually temporary — try again, and if
        it keeps happening let the Alumni Relations office know.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11.5px] ink-3">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={reset} className="auf-btn auf-btn-primary">
          <RefreshCw size={14} /> Try again
        </button>
        <Link href="/" className="auf-btn auf-btn-outline">
          Go to the home page
        </Link>
        <Link href="/contact" className="auf-btn auf-btn-ghost">
          Report it
        </Link>
      </div>
    </div>
  );
}
