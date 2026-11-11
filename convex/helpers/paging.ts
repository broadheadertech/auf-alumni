/**
 * The page contract shared by every paged query.
 *
 * Four queries had grown their own copy of "clamp the page size, parse the
 * cursor, slice, work out whether that was the last page" — directory.list,
 * admin.auditLog, admin.listUsers and compliance.listDataSubjectRequests.
 * Four copies of an off-by-one waiting to happen, so there is one now.
 *
 * The cursor is a plain row offset rendered as a string. That is deliberately
 * simple: it keeps the client contract identical to a real Convex `paginate()`
 * cursor, so swapping to one later does not change any page component. The
 * trade is that a large offset still costs the server the rows it skips, which
 * is why callers bound their candidate read first.
 *
 * `total` must be the count the query can actually serve for the current
 * filters — not a count taken before filtering, and not a count from a
 * separate query that applies different ones. Page numbers are computed from
 * it, so a `total` larger than the query will return offers pages that come
 * back empty.
 */

export type Page<T> = {
  page: T[];
  total: number;
  isDone: boolean;
  continueCursor: string;
};

export type PageArgs = {
  cursor?: string | null;
  pageSize?: number;
};

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

/** Parse the requested page size, clamped to something a client cannot abuse. */
export function resolvePageSize(
  requested: number | undefined,
  max: number = MAX_PAGE_SIZE,
): number {
  if (requested === undefined || !Number.isFinite(requested)) {
    return Math.min(DEFAULT_PAGE_SIZE, max);
  }
  return Math.min(Math.max(Math.floor(requested), 1), max);
}

/**
 * Parse the cursor into a row offset.
 *
 * Anything unparseable is offset 0 rather than an error: a cursor is an opaque
 * token to the client, and handing back page one beats throwing because a
 * stale URL carried a junk value.
 */
export function resolveOffset(cursor: string | null | undefined): number {
  const n = Number(cursor ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Slice an already-filtered array into the requested page.
 *
 * `rows` must be the full matching set, filtered before it gets here. Slicing
 * first and filtering after is the bug this helper exists downstream of: the
 * audit log read the newest 200 entries and then applied the target filter, so
 * filtering returned whichever matches happened to fall in that window instead
 * of the ones that matched.
 */
export function pageOf<T>(rows: T[], args: PageArgs, maxPageSize?: number): Page<T> {
  const pageSize = resolvePageSize(args.pageSize, maxPageSize);
  const offset = resolveOffset(args.cursor);
  const page = rows.slice(offset, offset + pageSize);
  const next = offset + page.length;
  return {
    page,
    total: rows.length,
    // An offset past the end yields an empty page, and that is the end of the
    // road: reporting isDone false there would invite an endless Next button.
    isDone: next >= rows.length,
    continueCursor: String(next),
  };
}
