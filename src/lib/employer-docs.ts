/**
 * Employer document uploads (MOA / NDA) — admin-side overrides on top of the
 * static EMPLOYERS seed data.
 *
 * Uploading records a filename + size (no real binary in the prototype) and
 * marks the doc present; the employer detail + roster read the override first,
 * falling back to the seed value. Persisted to localStorage so it survives
 * navigation. Swap for Convex storage + employerOrgs fields when wired.
 */

import { useSyncExternalStore } from "react";

export type EmployerDocKind = "moa" | "nda";

export type LocalDoc = {
  filename: string;
  sizeKb: number;
  uploadedAt: string; // ISO date
};

type DocsMap = Record<string, Partial<Record<EmployerDocKind, LocalDoc>>>;

const STORAGE_KEY = "auf-employer-docs-v1";
export const DOC_STAMP = "2026-06-28";
const EMPTY: DocsMap = {};

function read(): DocsMap {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DocsMap) : {};
  } catch {
    return {};
  }
}

let cache: DocsMap = read();
const listeners = new Set<() => void>();

function commit(next: DocsMap) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export function setEmployerDoc(
  employerId: string,
  kind: EmployerDocKind,
  doc: LocalDoc,
) {
  commit({ ...cache, [employerId]: { ...(cache[employerId] ?? {}), [kind]: doc } });
}

export function removeEmployerDoc(employerId: string, kind: EmployerDocKind) {
  const entry = { ...(cache[employerId] ?? {}) };
  delete entry[kind];
  commit({ ...cache, [employerId]: entry });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useEmployerDocsMap(): DocsMap {
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => EMPTY,
  );
}

export function useEmployerDocs(
  employerId: string,
): Partial<Record<EmployerDocKind, LocalDoc>> {
  return useEmployerDocsMap()[employerId] ?? EMPTY;
}
