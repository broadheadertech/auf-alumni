import { describe, it, expect } from "vitest";
import type { Page } from "../helpers/paging";
import {
  pageOf,
  resolveOffset,
  resolvePageSize,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "../helpers/paging";

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("resolvePageSize", () => {
  it("defaults when unspecified", () => {
    expect(resolvePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("clamps a client asking for the whole table", () => {
    expect(resolvePageSize(100_000)).toBe(MAX_PAGE_SIZE);
  });

  it("never returns zero or negative, which would page forever", () => {
    expect(resolvePageSize(0)).toBe(1);
    expect(resolvePageSize(-5)).toBe(1);
  });

  it("honours a caller's lower ceiling", () => {
    expect(resolvePageSize(500, 50)).toBe(50);
    expect(resolvePageSize(undefined, 10)).toBe(10);
  });

  it("ignores nonsense", () => {
    expect(resolvePageSize(Number.NaN)).toBe(DEFAULT_PAGE_SIZE);
    expect(resolvePageSize(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("floors a fractional size", () => {
    expect(resolvePageSize(25.9)).toBe(25);
  });
});

describe("resolveOffset", () => {
  it("treats absent, null and junk cursors as page one", () => {
    for (const c of [undefined, null, "", "abc", "-1", "NaN"]) {
      expect(resolveOffset(c as string | null | undefined)).toBe(0);
    }
  });

  it("parses a real offset", () => {
    expect(resolveOffset("50")).toBe(50);
  });
});

describe("pageOf", () => {
  it("returns the first page and the true total", () => {
    const p = pageOf(rows(71), { pageSize: 25 });
    expect(p.page).toHaveLength(25);
    expect(p.total).toBe(71);
    expect(p.isDone).toBe(false);
    expect(p.continueCursor).toBe("25");
  });

  it("walks every row exactly once across contiguous pages", () => {
    const all = rows(71);
    const seen: number[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 10; i++) {
      // Annotated because inferring it from a cursor this loop also assigns
      // makes the type circular.
      const p: Page<number> = pageOf(all, { pageSize: 25, cursor });
      seen.push(...p.page);
      if (p.isDone) break;
      cursor = p.continueCursor;
    }
    // The bug this guards: /admin/directory could reach only 60 of 71.
    expect(seen).toEqual(all);
    expect(new Set(seen).size).toBe(71);
  });

  it("marks the last partial page done", () => {
    const p = pageOf(rows(71), { pageSize: 25, cursor: "50" });
    expect(p.page).toHaveLength(21);
    expect(p.isDone).toBe(true);
  });

  it("marks an exactly-full final page done", () => {
    const p = pageOf(rows(50), { pageSize: 25, cursor: "25" });
    expect(p.page).toHaveLength(25);
    // Without this, the Next button stays live and lands on an empty page.
    expect(p.isDone).toBe(true);
  });

  it("does not loop forever when the cursor is past the end", () => {
    const p = pageOf(rows(10), { pageSize: 25, cursor: "999" });
    expect(p.page).toEqual([]);
    expect(p.isDone).toBe(true);
    expect(p.total).toBe(10);
  });

  it("reports an empty result honestly", () => {
    const p = pageOf([], { pageSize: 25 });
    expect(p.total).toBe(0);
    expect(p.isDone).toBe(true);
    expect(p.continueCursor).toBe("0");
  });

  it("reports the filtered total, not the pre-filter one", () => {
    // Callers must filter before slicing; this asserts the contract they rely
    // on, which the audit log previously violated by slicing first.
    const matching = rows(100).filter((n) => n % 10 === 0);
    const p = pageOf(matching, { pageSize: 25 });
    expect(p.total).toBe(10);
    expect(p.page).toHaveLength(10);
    expect(p.isDone).toBe(true);
  });

  it("respects a caller's page-size ceiling", () => {
    const p = pageOf(rows(500), { pageSize: 500 }, 50);
    expect(p.page).toHaveLength(50);
  });
});
