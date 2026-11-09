import { describe, it, expect } from "vitest";
import { verifiedProfiles, hiddenUserIds } from "../helpers/indexedReads";

/**
 * These helpers exist for one reason: to stop reading rows the caller is
 * going to throw away. A test that only checked the returned rows would pass
 * just as happily against `collect().filter(...)`, so the fake database below
 * records which index each query used and refuses an unindexed `.collect()`
 * outright — the regression we actually care about is someone "simplifying"
 * a withIndex back into a full scan.
 */

type Row = Record<string, unknown> & { _id: string };

/** Records every query and enforces that each one narrows through an index. */
function fakeCtx(tables: Record<string, Row[]>) {
  const reads: Array<{ table: string; index: string | null; rowsRead: number }> = [];

  const query = (table: string) => {
    const rows = tables[table] ?? [];
    return {
      withIndex(index: string, build: (q: unknown) => unknown) {
        // Capture the bound the handler asks for, then apply it ourselves so
        // the fake honours the same semantics Convex does: `undefined` sorts
        // below every number, so `.gt(field, 0)` must not return unset rows.
        let field = "";
        let floor = Number.NEGATIVE_INFINITY;
        let ceil = Number.POSITIVE_INFINITY;
        const eqs: Array<[string, unknown]> = [];
        const builder: Record<string, unknown> = {
          eq(f: string, v: unknown) {
            eqs.push([f, v]);
            return builder;
          },
          gt(f: string, v: number) {
            field = f;
            floor = v;
            return builder;
          },
          gte(f: string, v: number) {
            field = f;
            floor = v - Number.EPSILON;
            return builder;
          },
          lt(f: string, v: number) {
            ceil = v;
            return builder;
          },
        };
        build(builder);
        const matched = rows.filter((r) => {
          for (const [f, v] of eqs) if (r[f] !== v) return false;
          if (!field) return true;
          const value = r[field];
          // The whole point: an absent field is outside every numeric range.
          if (typeof value !== "number") return false;
          return value > floor && value < ceil;
        });
        reads.push({ table, index, rowsRead: matched.length });
        return { collect: async () => matched };
      },
      collect: async () => {
        throw new Error(
          `unindexed collect() on "${table}" — this helper must read through an index`,
        );
      },
    };
  };

  return { ctx: { db: { query } } as never, reads };
}

describe("verifiedProfiles", () => {
  const profiles: Row[] = [
    { _id: "p1", verifiedAt: 1_700_000_000_000 },
    { _id: "p2" }, // never verified — field absent
    { _id: "p3", verifiedAt: undefined }, // explicitly undefined
    { _id: "p4", verifiedAt: 1_700_000_000_001 },
  ];

  it("returns only the verified rows", async () => {
    const { ctx } = fakeCtx({ profiles });
    const rows = await verifiedProfiles(ctx);
    expect(rows.map((r) => r._id)).toEqual(["p1", "p4"]);
  });

  it("reads through by_verified rather than scanning", async () => {
    const { ctx, reads } = fakeCtx({ profiles });
    await verifiedProfiles(ctx);
    expect(reads).toEqual([{ table: "profiles", index: "by_verified", rowsRead: 2 }]);
  });

  it("does not read the unverified rows at all", async () => {
    const { ctx, reads } = fakeCtx({ profiles });
    await verifiedProfiles(ctx);
    // 2 of 4 rows touched. The old `collect().filter()` touched all 4, which
    // is the cost this helper exists to avoid.
    expect(reads[0].rowsRead).toBeLessThan(profiles.length);
  });

  it("matches the predicate it replaced", async () => {
    const { ctx } = fakeCtx({ profiles });
    const rows = await verifiedProfiles(ctx);
    const legacy = profiles.filter((p) => p.verifiedAt != null);
    expect(rows.map((r) => r._id)).toEqual(legacy.map((p) => p._id));
  });
});

describe("hiddenUserIds", () => {
  const users: Row[] = [
    { _id: "u1", suspendedAt: 1_700_000_000_000 },
    { _id: "u2", deletedAt: 1_700_000_000_000 },
    { _id: "u3", suspendedAt: 1_700_000_000_000, deletedAt: 1_700_000_000_000 },
    { _id: "u4" }, // healthy
  ];

  it("unions the suspended and deleted sets without duplicating the overlap", async () => {
    const { ctx } = fakeCtx({ users });
    const hidden = await hiddenUserIds(ctx);
    expect([...hidden].sort()).toEqual(["u1", "u2", "u3"]);
    expect(hidden.size).toBe(3);
  });

  it("leaves healthy accounts visible", async () => {
    const { ctx } = fakeCtx({ users });
    const hidden = await hiddenUserIds(ctx);
    expect(hidden.has("u4")).toBe(false);
  });

  it("reads both switched-off indexes and never the whole table", async () => {
    const { ctx, reads } = fakeCtx({ users });
    await hiddenUserIds(ctx);
    expect(reads.map((r) => r.index).sort()).toEqual(["by_deleted", "by_suspended"]);
    expect(reads.every((r) => r.rowsRead < users.length)).toBe(true);
  });

  it("matches the predicate it replaced", async () => {
    const { ctx } = fakeCtx({ users });
    const hidden = await hiddenUserIds(ctx);
    const legacy = new Set(
      users.filter((u) => u.suspendedAt || u.deletedAt).map((u) => u._id),
    );
    expect([...hidden].sort()).toEqual([...legacy].sort());
  });

  it("returns an empty set when nothing is switched off", async () => {
    const { ctx } = fakeCtx({ users: [{ _id: "a" }, { _id: "b" }] });
    expect((await hiddenUserIds(ctx)).size).toBe(0);
  });
});
