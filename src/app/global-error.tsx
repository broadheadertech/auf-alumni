"use client";

/**
 * Last-resort boundary, for errors thrown in the root layout itself.
 *
 * At this level the app's own layout never rendered, so this component must
 * supply its own <html> and <body> and cannot rely on the stylesheet or any
 * shared component. Styles are inline for that reason.
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafaf8",
          color: "#1a1a1a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
            The AUF Alumni Network couldn&apos;t load
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#555" }}>
            Something failed before the page could start. Try again — if it
            keeps happening, please tell the Alumni Relations office.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11.5, fontFamily: "ui-monospace, monospace", color: "#777" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "9px 18px",
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
              background: "#0f2d5c",
              border: 0,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
