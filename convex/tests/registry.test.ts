/**
 * Registry-hook tests (Story 1.8).
 *
 * Stub mode (v1 default) must return no-match for any query.
 * Live mode is not yet implemented and must throw the documented error.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { lookupAlumnus } from "../helpers/registry";
import { stubRegistry } from "../helpers/registryStub";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("stubRegistry", () => {
  test("returns no-match for any query", async () => {
    const queries = [
      { name: "Maria Santos", batch: 2018, program: "BS Information Technology" },
      { studentNumber: "20021234", name: "Ricardo Mendoza-Cruz", batch: 2002, program: "BS Accountancy" },
      { name: "", batch: 0, program: "" },
    ];
    for (const q of queries) {
      const result = await stubRegistry.lookupAlumnus(q);
      expect(result.matched).toBe(false);
      expect(result.record).toBeUndefined();
      expect(result.confidence).toBeUndefined();
    }
  });
});

describe("lookupAlumnus (adapter switch)", () => {
  test("defaults to stub when REGISTRY_MODE is unset", async () => {
    vi.stubEnv("REGISTRY_MODE", "");
    const result = await lookupAlumnus({
      name: "Maria Santos",
      batch: 2018,
      program: "BS IT",
    });
    expect(result.matched).toBe(false);
  });

  test("uses stub when REGISTRY_MODE=stub", async () => {
    vi.stubEnv("REGISTRY_MODE", "stub");
    const result = await lookupAlumnus({
      name: "Maria Santos",
      batch: 2018,
      program: "BS IT",
    });
    expect(result.matched).toBe(false);
  });

  test("throws when REGISTRY_MODE=live (not yet implemented)", async () => {
    vi.stubEnv("REGISTRY_MODE", "live");
    await expect(
      lookupAlumnus({ name: "Maria", batch: 2018, program: "BS IT" }),
    ).rejects.toThrow(/no live adapter implemented/);
  });

  test("throws on unknown REGISTRY_MODE", async () => {
    vi.stubEnv("REGISTRY_MODE", "fictional-mode");
    await expect(
      lookupAlumnus({ name: "Maria", batch: 2018, program: "BS IT" }),
    ).rejects.toThrow(/Unknown REGISTRY_MODE/);
  });
});
