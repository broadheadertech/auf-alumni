// STUB IMPLEMENTATION — Story 1.8.
// The live AUF Registry adapter will be wired in once the partnership formalizes
// (see docs/runbooks/registry-integration.md, to be authored at that time).
// Until then: every verification submission falls to the manual ID-upload path.

import type { RegistryAdapter, RegistryMatch, RegistryQuery } from "./registry";

export const stubRegistry: RegistryAdapter = {
  async lookupAlumnus(_query: RegistryQuery): Promise<RegistryMatch> {
    return { matched: false };
  },
};
