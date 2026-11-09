"use client";

/**
 * Pagination controls for a list page.
 *
 * Shows where you are in words ("Showing 26–50 of 412") as well as in page
 * numbers, because the count is what people actually want to know and a row
 * of numbers alone does not tell you how much is left.
 *
 * Renders nothing when everything fits on one page — controls that can only
 * ever be disabled are noise.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageWindow, PAGE_SIZES, type Pagination as PaginationState } from "@/lib/use-pagination";
import { cn } from "@/lib/utils";

export function Pagination<T>({
  state,
  noun = "row",
  plural: pluralProp,
  className,
  showPageSize = true,
}: {
  state: PaginationState<T>;
  /** Singular noun for the summary, e.g. "alumnus". */
  noun?: string;
  /**
   * Plural, when adding "s" is wrong. Without this, "alumnus" became
   * "alumnuss" — which is exactly the kind of detail that makes an interface
   * look unfinished.
   */
  plural?: string;
  className?: string;
  showPageSize?: boolean;
}) {
  const { page, totalPages, total, from, to, hasPrev, hasNext } = state;
  const plural = total === 1 ? noun : (pluralProp ?? `${noun}s`);

  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 py-2.5 text-[12px] text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span>
          Showing{" "}
          <span className="font-medium tabular-nums text-foreground">
            {from}&ndash;{to}
          </span>{" "}
          of{" "}
          <span className="font-medium tabular-nums text-foreground">
            {total}
          </span>{" "}
          {plural}
        </span>

        {showPageSize && total > PAGE_SIZES[0] && (
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Rows per page</span>
            <select
              value={state.pageSize}
              onChange={(e) => state.setPageSize(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-1.5 py-1 text-[12px]"
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            onClick={state.prev}
            disabled={!hasPrev}
            aria-label="Previous page"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {pageWindow(page, totalPages).map((p, i) =>
            p === "gap" ? (
              <span
                key={`gap-${i}`}
                className="px-1 text-muted-foreground/60"
                aria-hidden
              >
                &hellip;
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => state.setPage(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={cn(
                  "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 tabular-nums transition-colors",
                  p === page
                    ? "bg-foreground font-medium text-background"
                    : "border border-border hover:bg-muted",
                )}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={state.next}
            disabled={!hasNext}
            aria-label="Next page"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </nav>
      )}
    </div>
  );
}
