"use client";

/**
 * Picker options for the admin-managed reference lists (convex/lookups.ts):
 * areas (locations), employment statuses, and skill sets.
 *
 * Returns an empty list while loading or before an admin has seeded the list —
 * callers use these as suggestions, so free-text entry keeps working either way.
 */

import { useQuery } from "convex/react";
import { api } from "@/lib/convex-api";

export type LookupKind = "area" | "status" | "skill";

export type LookupOption = {
  _id: string;
  name: string;
  group?: string;
  description?: string;
};

export function useLookupOptions(kind: LookupKind): {
  options: LookupOption[];
  names: string[];
  ready: boolean;
} {
  const list = useQuery(api.lookups.listActive, { kind }) as
    | LookupOption[]
    | undefined;
  const options = list ?? [];
  return { options, names: options.map((o) => o.name), ready: list !== undefined };
}
