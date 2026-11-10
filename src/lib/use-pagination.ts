"use client";

/**
 * Client-side pagination for list pages.
 *
 * Every list in the app rendered every row it had: 95 users, the whole alumni
 * roster, every applicant. Fine at demo size, miserable to use — you scroll
 * past hundreds of rows to reach the end of a list, and there is no way to
 * say "the fourth page" to a colleague.
 *
 * This paginates the array the page already holds, which suits these screens
 * because they filter and sort in memory: a server-side cursor would have to
 * re-implement all of that, and would fight the instant filtering the pages
 * rely on. The ceiling is the fetch itself, not the rendering — see the note
 * on scale at the bottom of this file.
 *
 * The page number is clamped when it is read rather than corrected in an
 * effect. Filtering a list down to one page while sitting on page 5 would
 * otherwise need a setState inside an effect, which is the cascading render
 * this codebase's lint rule exists to prevent — and it would also flash the
 * empty page before correcting itself.
 */

import { useCallback, useMemo, useState } from "react";

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type Pagination<T> = {
  /** The rows for the current page. */
  pageItems: T[];
  /** 1-based, already clamped to the available range. */
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  total: number;
  /** 1-based index of the first row shown, or 0 when empty. */
  from: number;
  /** 1-based index of the last row shown. */
  to: number;
  next: () => void;
  prev: () => void;
  hasPrev: boolean;
  hasNext: boolean;
};

export function usePagination<T>(
  items: T[],
  options?: {
    pageSize?: number;
    /**
     * Changing this sends the reader back to page one. Pass something that
     * identifies the current filters — landing on page 5 of a result that now
     * has one page is worse than losing your place.
     */
    resetKey?: string;
  },
): Pagination<T> {
  const [pageSize, setPageSizeState] = useState(
    options?.pageSize ?? DEFAULT_PAGE_SIZE,
  );
  const [rawPage, setRawPage] = useState(1);
  const [lastKey, setLastKey] = useState(options?.resetKey ?? "");

  const resetKey = options?.resetKey ?? "";

  // Derive rather than correct in an effect: if the filters changed since the
  // last render, this render is page one.
  const keyChanged = resetKey !== lastKey;
  if (keyChanged) {
    // Safe during render: both are plain state updates on this component and
    // React re-renders immediately rather than committing the stale values.
    setLastKey(resetKey);
    setRawPage(1);
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = keyChanged ? 1 : Math.min(Math.max(1, rawPage), totalPages);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const setPage = useCallback(
    (next: number) => setRawPage(Math.max(1, next)),
    [],
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    // Row 30 is on a different page at 25/page than at 100/page, so there is
    // no meaningful "same place" to keep. Page one is the honest answer.
    setRawPage(1);
  }, []);

  return {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    total,
    from: total === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, total),
    next: () => setRawPage((p) => Math.min(p + 1, totalPages)),
    prev: () => setRawPage((p) => Math.max(1, p - 1)),
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}

/**
 * Page numbers to render, with gaps collapsed: [1, "…", 4, 5, 6, "…", 12].
 * Always shows the first and last page so you can jump to either end.
 */
export function pageWindow(
  page: number,
  totalPages: number,
  span = 1,
): Array<number | "gap"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, page]);
  for (let i = 1; i <= span; i++) {
    if (page - i > 1) pages.add(page - i);
    if (page + i < totalPages) pages.add(page + i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push("gap");
    out.push(p);
    previous = p;
  }
  return out;
}

/*
 * On scale: this paginates rows already in memory, so the page is fast but
 * the query behind it still fetches everything. At a few thousand alumni that
 * fetch is the thing to fix, and the fix is a Convex `paginate()` cursor —
 * which also means moving filtering and sorting server-side, since you cannot
 * sort a page you have not read. That is a larger change than this one and
 * belongs on its own.
 */

/**
 * Server-paged variant: the rows for the current page come from a query, not
 * from an array the page already holds.
 *
 * usePagination() above slices an array that has been fetched in full, which
 * is the right trade for screens that filter and sort in memory. It is the
 * wrong trade when the query has a row cap, because then the rows past the cap
 * are not merely slow to reach — they are unreachable. /admin/directory asked
 * for 60 rows and paginated those, so with 71 verified alumni eleven of them
 * could not be shown on any page.
 *
 * Two phases, because the cursor has to exist before the query that needs it:
 *
 *   const pager = useServerPagination({ resetKey });
 *   const result = useQuery(api.x.list, { cursor: pager.cursor, ... });
 *   const paged = pager.withRows(result?.page, result?.total);
 *
 * `withRows` is a plain function, not a hook, so this does not depend on call
 * order beyond the one hook. It returns the same `Pagination<T>` shape as
 * usePagination, so <Pagination> renders unchanged.
 *
 * `total` must be the count the query itself can serve for the current
 * filters — see the note on `total` in convex/directory.ts for why a separate
 * count query is not interchangeable with it.
 */
export type ServerPager<T> = {
  /** Pass to the query as its `cursor` argument. */
  cursor: string;
  /** Pass to the query as its `pageSize` argument. */
  pageSize: number;
  withRows: (rows: T[] | undefined, total: number | undefined) => Pagination<T>;
};

export function useServerPagination<T>(options?: {
  pageSize?: number;
  /** Changing this sends the reader back to page one. Same contract as above. */
  resetKey?: string;
}): ServerPager<T> {
  const [pageSize, setPageSizeState] = useState(
    options?.pageSize ?? DEFAULT_PAGE_SIZE,
  );
  const [rawPage, setRawPage] = useState(1);
  const [lastKey, setLastKey] = useState(options?.resetKey ?? "");

  const resetKey = options?.resetKey ?? "";

  // Derive rather than correct in an effect, as usePagination does. This also
  // happens to be what keeps the cursor honest: a filter change resets to page
  // one before the query runs, so the query is never asked for an offset that
  // the new filters have already invalidated.
  const keyChanged = resetKey !== lastKey;
  if (keyChanged) {
    setLastKey(resetKey);
    setRawPage(1);
  }

  const page = keyChanged ? 1 : Math.max(1, rawPage);

  const setPage = useCallback((next: number) => setRawPage(Math.max(1, next)), []);
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    // Row 30 is on a different page at 25/page than at 100/page.
    setRawPage(1);
  }, []);

  return {
    // The server reads this as a row offset.
    cursor: String((page - 1) * pageSize),
    pageSize,
    withRows: (rows, total) => {
      // While the count is in flight there is nothing to clamp against, and
      // clamping to 1 would bounce the reader back to page one on every page
      // change — asking for page 4 is what made the count undefined.
      const known = total !== undefined;
      const totalPages = known
        ? Math.max(1, Math.ceil(total / pageSize))
        : Math.max(1, page);
      const shown = Math.min(page, totalPages);
      const pageItems = rows ?? [];
      // Before the first response, report this page's own row count rather
      // than 0, so the summary does not read "Showing 1–0 of 0" mid-flight.
      const reportedTotal = known ? total : pageItems.length;

      return {
        pageItems,
        page: shown,
        setPage,
        pageSize,
        setPageSize,
        totalPages,
        total: reportedTotal,
        from: reportedTotal === 0 ? 0 : (shown - 1) * pageSize + 1,
        to: Math.min(shown * pageSize, reportedTotal),
        next: () => setRawPage((p) => Math.min(p + 1, totalPages)),
        prev: () => setRawPage((p) => Math.max(1, p - 1)),
        hasPrev: shown > 1,
        hasNext: shown < totalPages,
      };
    },
  };
}
