import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useServerPagination, pageWindow } from "@/lib/use-pagination";

/**
 * The bug this hook fixes was invisible in the UI: /admin/directory asked for
 * 60 rows, paginated those client-side, and looked perfectly healthy while
 * eleven of the 71 verified alumni could not be reached on any page. So these
 * tests are mostly about the cursor — the number that decides which rows the
 * server is even asked for.
 */

type Row = { id: number };
const rows = (n: number, from = 0): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: from + i }));

describe("useServerPagination — the cursor", () => {
  it("starts at offset 0", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    expect(result.current.cursor).toBe("0");
    expect(result.current.pageSize).toBe(25);
  });

  it("advances by a whole page, so no row is skipped or repeated", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    const offsets = ["0"];
    for (let i = 0; i < 3; i++) {
      act(() => result.current.withRows(rows(25), 200).next());
      offsets.push(result.current.cursor);
    }
    // Contiguous windows of 25: every row is asked for exactly once.
    expect(offsets).toEqual(["0", "25", "50", "75"]);
  });

  it("stops at the last page's offset rather than running off the end", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    // 71 rows at 25/page is 3 pages, so offset 75 must never be requested.
    for (let i = 0; i < 6; i++) {
      act(() => result.current.withRows(rows(25), 71).next());
    }
    expect(result.current.cursor).toBe("50");
  });

  it("tracks the page size, so 50-per-page asks for offset 50 not 25", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    act(() => result.current.withRows(rows(25), 71).setPageSize(50));
    expect(result.current.pageSize).toBe(50);
    expect(result.current.cursor).toBe("0"); // page size change returns to page 1
    act(() => result.current.withRows(rows(50), 71).next());
    expect(result.current.cursor).toBe("50");
  });

  it("returns to offset 0 when the filters change", () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useServerPagination<Row>({ resetKey: key }),
      { initialProps: { key: "a" } },
    );
    act(() => result.current.withRows(rows(25), 71).setPage(3));
    expect(result.current.cursor).toBe("50");
    rerender({ key: "b" });
    // Critical: the reset happens before the query reads the cursor, so the
    // server is never asked for an offset the new filters have invalidated.
    expect(result.current.cursor).toBe("0");
  });

  it("never emits a negative offset", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    act(() => result.current.withRows(rows(25), 71).setPage(-5));
    expect(Number(result.current.cursor)).toBeGreaterThanOrEqual(0);
  });
});

describe("useServerPagination — withRows", () => {
  it("reports the server's total, not the page's row count", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    const p = result.current.withRows(rows(25), 71);
    // The old bug in one assertion: 25 rows in hand, 71 rows available.
    expect(p.pageItems).toHaveLength(25);
    expect(p.total).toBe(71);
    expect(p.totalPages).toBe(3);
    expect(p.from).toBe(1);
    expect(p.to).toBe(25);
  });

  it("makes the last partial page reachable", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    act(() => result.current.withRows(rows(25), 71).setPage(3));
    const p = result.current.withRows(rows(21), 71);
    expect(p.page).toBe(3);
    expect(p.from).toBe(51);
    expect(p.to).toBe(71);
    expect(p.hasNext).toBe(false);
    expect(p.hasPrev).toBe(true);
  });

  it("clamps a page that the new total no longer has", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    act(() => result.current.withRows(rows(25), 71).setPage(3));
    // A filter cut the result to a single page while the reader sat on page 3.
    const p = result.current.withRows(rows(2), 2);
    expect(p.page).toBe(1);
    expect(p.totalPages).toBe(1);
    expect(p.hasNext).toBe(false);
  });

  it("holds the requested page while the total is still loading", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    act(() => result.current.withRows(rows(25), 71).setPage(4));
    // Asking for page 4 is what made the query undefined; bouncing to page 1
    // here would make the page number controls unusable.
    const p = result.current.withRows(undefined, undefined);
    expect(p.page).toBe(4);
    expect(p.pageItems).toEqual([]);
  });

  it("does not read 'Showing 1–0 of 0' mid-flight", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    const p = result.current.withRows(rows(25), undefined);
    expect(p.total).toBe(25);
    expect(p.to).toBe(25);
  });

  it("reports an empty result honestly", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    const p = result.current.withRows([], 0);
    expect(p.total).toBe(0);
    expect(p.from).toBe(0);
    expect(p.to).toBe(0);
    expect(p.hasNext).toBe(false);
    expect(p.hasPrev).toBe(false);
  });

  it("cannot be pushed past the last page", () => {
    const { result } = renderHook(() => useServerPagination<Row>());
    for (let i = 0; i < 10; i++) {
      act(() => result.current.withRows(rows(25), 71).next());
    }
    const p = result.current.withRows(rows(21), 71);
    expect(p.page).toBe(3);
    expect(p.hasNext).toBe(false);
  });
});

describe("pageWindow still collapses gaps for a server-paged list", () => {
  it("keeps both ends reachable", () => {
    const w = pageWindow(5, 12);
    expect(w[0]).toBe(1);
    expect(w[w.length - 1]).toBe(12);
    expect(w).toContain(5);
  });
});
