/**
 * AUF Alumni Registry hook interface (Story 1.8).
 *
 * In v1, only the stub implementation exists; every verification submission
 * falls to the manual ID-upload path. When the AUF partnership formalizes, a
 * live adapter is added and the switch is configuration-only (REGISTRY_MODE=live).
 *
 * See docs/runbooks/registry-integration.md for the live-integration plan.
 */

import { stubRegistry } from "./registryStub";

export type RegistryQuery = {
  studentNumber?: string;
  name: string;
  batch: number;
  program: string;
};

export type RegistryRecord = {
  studentNumber: string;
  registryName: string;
  batch: number;
  program: string;
  graduatedAt?: number;
};

export type RegistryMatch = {
  matched: boolean;
  record?: RegistryRecord;
  confidence?: number; // 0..1
};

export interface RegistryAdapter {
  lookupAlumnus(query: RegistryQuery): Promise<RegistryMatch>;
}

function getAdapter(): RegistryAdapter {
  const mode = process.env.REGISTRY_MODE || "stub";
  if (mode === "stub") return stubRegistry;
  if (mode === "live") {
    throw new Error(
      "REGISTRY_MODE=live but no live adapter implemented. " +
        "See docs/runbooks/registry-integration.md.",
    );
  }
  throw new Error(`Unknown REGISTRY_MODE: ${mode}`);
}

export async function lookupAlumnus(query: RegistryQuery): Promise<RegistryMatch> {
  return getAdapter().lookupAlumnus(query);
}
