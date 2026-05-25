/**
 * Privacy-leak CI test (Story 1.3).
 *
 * Exhaustively enumerates (viewer kind × field × privacy tier) combinations
 * and asserts that `applyPrivacy` returns exactly the entitled subset.
 *
 * Failure of this test = NFR10 regression. Merge blocked.
 */

import { describe, expect, test } from "vitest";
import { applyPrivacy, type ViewerContext, type PrivacyTier } from "../helpers/privacy";
import type { Doc, Id } from "../_generated/dataModel";

const userIdA = "fake_id_user_a" as Id<"users">;
const userIdB = "fake_id_user_b" as Id<"users">;

function buildProfile(tiers: Record<string, PrivacyTier>): Doc<"profiles"> {
  return {
    _id: "fake_id_profile_a" as Id<"profiles">,
    _creationTime: 1700000000000,
    userId: userIdA,
    slug: "maria-santos",
    displayName: "Maria Santos",
    registryName: undefined,
    initials: "MS",
    batch: 2018,
    program: "BS Information Technology",
    degree: "Undergraduate",
    currentRole: "Senior Engineer",
    company: "Globe Telecom",
    city: "Manila",
    country: "Philippines",
    bio: "BS IT '18 working in product engineering.",
    skills: ["TypeScript", "React"],
    openTo: ["mentorship"],
    experience: [],
    education: [],
    photoStorageId: undefined,
    privacyTiers: tiers,
    verifiedAt: 1700000000000,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    excludeFromSearchEngines: false,
  } as Doc<"profiles">;
}

const VIEWERS: { name: string; viewer: ViewerContext; rank: number }[] = [
  { name: "stranger", viewer: { kind: "stranger" }, rank: 0 },
  { name: "alumnus", viewer: { kind: "alumnus", userId: userIdB }, rank: 1 },
  { name: "connection", viewer: { kind: "connection", userId: userIdB }, rank: 2 },
  { name: "self", viewer: { kind: "self", userId: userIdA }, rank: 3 },
];

const TIER_RANK: Record<PrivacyTier, number> = {
  public: 0,
  alumni: 1,
  connections: 2,
  private: 3,
};

const TIEABLE_FIELDS = [
  "currentRole",
  "company",
  "city",
  "country",
  "bio",
  "skills",
  "openTo",
  "experience",
  "education",
  "batch",
  "program",
] as const;

describe("applyPrivacy", () => {
  describe("always-include fields", () => {
    test("structural fields are visible to every viewer", () => {
      const profile = buildProfile({});
      for (const { viewer } of VIEWERS) {
        const result = applyPrivacy(profile, viewer);
        expect(result.slug).toBe("maria-santos");
        expect(result.displayName).toBe("Maria Santos");
        expect(result.verifiedAt).toBeDefined();
        expect(result._id).toBeDefined();
      }
    });
  });

  describe("privacyTiers metadata", () => {
    test("privacyTiers is visible only to self", () => {
      const profile = buildProfile({ bio: "alumni" });
      for (const { name, viewer } of VIEWERS) {
        const result = applyPrivacy(profile, viewer);
        if (name === "self") {
          expect(result.privacyTiers).toBeDefined();
        } else {
          expect(result.privacyTiers).toBeUndefined();
        }
      }
    });
  });

  describe("field × tier × viewer entitlement matrix", () => {
    for (const field of TIEABLE_FIELDS) {
      for (const tier of Object.keys(TIER_RANK) as PrivacyTier[]) {
        test(`field=${field}, tier=${tier}: included iff viewerRank >= tierRank`, () => {
          const profile = buildProfile({ [field]: tier });
          for (const { name, viewer, rank } of VIEWERS) {
            const result = applyPrivacy(profile, viewer);
            const expected = rank >= TIER_RANK[tier];
            const fieldPresent = (result as Record<string, unknown>)[field] !== undefined;
            expect(fieldPresent).toBe(expected);
            if (!expected) {
              // Field must be absent (not just nulled)
              expect(Object.prototype.hasOwnProperty.call(result, field)).toBe(false);
            }
          }
        });
      }
    }
  });

  describe("default tier", () => {
    test("fields not in privacyTiers default to 'alumni' tier", () => {
      const profile = buildProfile({});
      const strangerResult = applyPrivacy(profile, { kind: "stranger" });
      const alumnusResult = applyPrivacy(profile, {
        kind: "alumnus",
        userId: userIdB,
      });
      expect((strangerResult as Record<string, unknown>).bio).toBeUndefined();
      expect((alumnusResult as Record<string, unknown>).bio).toBe(
        "BS IT '18 working in product engineering.",
      );
    });
  });

  describe("regression trap", () => {
    test("a private field never reaches an alumnus", () => {
      const profile = buildProfile({ company: "private" });
      const result = applyPrivacy(profile, { kind: "alumnus", userId: userIdB });
      expect((result as Record<string, unknown>).company).toBeUndefined();
    });

    test("a public field reaches a stranger", () => {
      const profile = buildProfile({ company: "public" });
      const result = applyPrivacy(profile, { kind: "stranger" });
      expect((result as Record<string, unknown>).company).toBe("Globe Telecom");
    });
  });
});
