/**
 * Builds the denormalised search haystack stored on `profiles.searchText`.
 *
 * The directory treats display name, role, company, bio and skills as one
 * blob, so a single search index over a joined field reproduces exactly what
 * the old in-memory scan matched — including skills, which is an array and
 * therefore cannot be a Convex `searchField` on its own.
 *
 * Keep this in step with the search branch of `profileMatches` in
 * convex/directory.ts: if one learns a new field, so must the other, or the
 * indexed path and the scan path will disagree.
 */
import type { Doc } from "../_generated/dataModel";

type SearchableProfile = Pick<
  Doc<"profiles">,
  "displayName" | "currentRole" | "company" | "bio" | "skills"
>;

export function buildSearchText(p: SearchableProfile): string {
  return [
    p.displayName,
    p.currentRole,
    p.company,
    p.bio,
    ...(p.skills ?? []),
  ]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join(" ")
    .slice(0, 2000);
}
