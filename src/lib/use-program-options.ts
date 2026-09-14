"use client";

/**
 * Program picker options, sourced from the admin-managed taxonomy
 * (convex/taxonomy.listPrograms) and grouped by college for the dropdowns in
 * profile edit + verification.
 *
 * Falls back to the built-in PROGRAMS constant while the query is loading or if
 * an admin hasn't seeded the taxonomy yet, so the forms are never empty.
 */

import { useQuery } from "convex/react";
import { api } from "@/lib/convex-api";
import { PROGRAMS as FALLBACK_PROGRAMS } from "@/lib/schemas/shared";

export type ProgramGroup = { college: string; programs: string[] };

const FALLBACK: ProgramGroup[] = [
  { college: "Programs", programs: [...FALLBACK_PROGRAMS] },
];

export type CollegeOption = { name: string; shortName?: string };
export type ProgramOption = { name: string; collegeName: string; degree?: string };

/**
 * Colleges + programs for dependent College → Program dropdowns (filters).
 * Straight from the taxonomy tables, no fallback: filters must only offer
 * values that exist in the database.
 */
export function useCollegePrograms(): {
  colleges: CollegeOption[];
  programs: ProgramOption[];
  /** Programs under a college name; all programs when collegeName is empty. */
  programsFor: (collegeName: string) => ProgramOption[];
  collegeOfProgram: (programName: string) => string | null;
  ready: boolean;
} {
  const colleges = useQuery(api.taxonomy.listColleges) as
    | Array<{ name: string; shortName?: string }>
    | undefined;
  const programs = useQuery(api.taxonomy.listPrograms) as
    | Array<{ name: string; collegeName: string; degree?: string }>
    | undefined;
  const c = colleges ?? [];
  const p = programs ?? [];
  return {
    colleges: c.map((x) => ({ name: x.name, shortName: x.shortName })),
    programs: p.map((x) => ({ name: x.name, collegeName: x.collegeName, degree: x.degree })),
    programsFor: (collegeName) =>
      collegeName ? p.filter((x) => x.collegeName === collegeName) : p,
    collegeOfProgram: (programName) =>
      p.find((x) => x.name === programName)?.collegeName ?? null,
    ready: colleges !== undefined && programs !== undefined,
  };
}

export function useProgramOptions(): {
  groups: ProgramGroup[];
  all: string[];
  ready: boolean;
} {
  const list = useQuery(api.taxonomy.listPrograms);

  if (list === undefined) {
    return { groups: FALLBACK, all: [...FALLBACK_PROGRAMS], ready: false };
  }
  if (list.length === 0) {
    return { groups: FALLBACK, all: [...FALLBACK_PROGRAMS], ready: true };
  }

  const byCollege = new Map<string, string[]>();
  for (const p of list) {
    const bucket = byCollege.get(p.collegeName);
    if (bucket) bucket.push(p.name);
    else byCollege.set(p.collegeName, [p.name]);
  }
  const groups = [...byCollege.entries()].map(([college, programs]) => ({
    college,
    programs,
  }));
  return { groups, all: list.map((p) => p.name), ready: true };
}
