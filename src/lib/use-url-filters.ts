"use client";

/**
 * Standard list filters: URL-backed and persisted per page for the session.
 *
 *  - The URL is the source of truth, so filtered views are shareable and quick
 *    links from dashboards can open a pre-filtered list.
 *  - The last filter set for each page is kept in sessionStorage. Coming back
 *    to a list with no filters in the URL (sidebar click, Back from a record)
 *    restores it; `restored` lets the panel say so next to "Reset".
 *  - `reset()` clears every filter key and forgets the saved set.
 *
 * Values are strings; multi-select values are comma-joined (see `splitList`).
 * Updates use `history.replaceState` — Next syncs useSearchParams with it and
 * no server round trip or history entry is made per keystroke.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STORAGE_PREFIX = "auf:filters:";
const QUICK_PARAM = "src";
const QUICK_VALUE = "quick";

/**
 * Build a link that opens a list with exactly these filters (empty values are
 * omitted), bypassing the saved set — for dashboard/analytics quick links.
 */
export function quickLink(path: string, filters: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
  q.set(QUICK_PARAM, QUICK_VALUE);
  return `${path}?${q.toString()}`;
}

export function splitList(value: string): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export function joinList(values: string[]): string {
  return values.filter(Boolean).join(",");
}

function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_PREFIX + key, value);
    else window.sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // Storage unavailable (private mode etc.) — filters still work via URL.
  }
}

export function useUrlFilters<K extends string>(pageKey: string, keys: readonly K[]) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [restored, setRestored] = useState(false);
  const mounted = useRef(false);

  const keySig = keys.join("|");
  const values = useMemo(() => {
    const out = {} as Record<K, string>;
    for (const k of keys) out[k] = sp.get(k) ?? "";
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, keySig]);

  // Only filter keys, in stable order — what we persist.
  const filterQuery = useMemo(() => {
    const q = new URLSearchParams();
    for (const k of keys) if (values[k]) q.set(k, values[k]);
    return q.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, keySig]);

  const replaceQuery = useCallback(
    (mutate: (q: URLSearchParams) => void) => {
      const q = new URLSearchParams(window.location.search);
      mutate(q);
      const qs = q.toString();
      // Pass `null` state: Next only syncs useSearchParams for history updates
      // that don't carry its own internal state marker.
      window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
    },
    [pathname],
  );

  // Restore once on mount when the URL carries no filters of its own. A quick
  // link marks its URL as authoritative with `src=quick` (see `quickLink`) so
  // "View list" opens exactly the slice it names; the marker is then dropped.
  useEffect(() => {
    if (sp.get(QUICK_PARAM) === QUICK_VALUE) {
      replaceQuery((q) => q.delete(QUICK_PARAM));
      return;
    }
    if (keys.some((k) => sp.get(k))) return;
    const saved = readStorage(pageKey);
    if (!saved) return;
    const savedQ = new URLSearchParams(saved);
    if (!keys.some((k) => savedQ.get(k))) return;
    replaceQuery((q) => {
      for (const k of keys) {
        const v = savedQ.get(k);
        if (v) q.set(k, v);
      }
    });
    // sessionStorage is only readable after mount (SSR), so this one-shot
    // flag can't be computed during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change (skip the first render so an empty initial URL can't
  // overwrite the saved set before the restore above lands).
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    writeStorage(pageKey, filterQuery || null);
  }, [pageKey, filterQuery]);

  const setMany = useCallback(
    (patch: Partial<Record<K, string>>) => {
      replaceQuery((q) => {
        for (const [k, v] of Object.entries(patch) as [K, string | undefined][]) {
          if (v) q.set(k, v);
          else q.delete(k);
        }
      });
    },
    [replaceQuery],
  );

  const set = useCallback((key: K, value: string) => setMany({ [key]: value } as Partial<Record<K, string>>), [setMany]);

  const reset = useCallback(() => {
    replaceQuery((q) => {
      for (const k of keys) q.delete(k);
    });
    writeStorage(pageKey, null);
    setRestored(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replaceQuery, pageKey, keySig]);

  const activeCount = keys.filter((k) => values[k]).length;

  return { values, set, setMany, reset, activeCount, restored };
}
