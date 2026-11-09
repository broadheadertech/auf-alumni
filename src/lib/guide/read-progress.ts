"use client";

/**
 * Which guide topics this browser has ticked off.
 *
 * A tiny external store rather than component state, so the reader can
 * subscribe with useSyncExternalStore: no mount effect writing state back, and
 * every mounted copy of the guide stays in step.
 *
 * Per-browser convenience only. It never reaches the server, and every access
 * is guarded — in a private window or with site data blocked, the guide simply
 * shows nothing ticked instead of failing.
 */

const KEY = "auf.guide.read";
const EMPTY = "[]";

const listeners = new Set<() => void>();
/** Cached so getSnapshot returns a stable value between writes. */
let snapshot: string | null = null;

function load(): string {
  if (snapshot !== null) return snapshot;
  try {
    snapshot = window.localStorage.getItem(KEY) ?? EMPTY;
  } catch {
    snapshot = EMPTY;
  }
  return snapshot;
}

export function subscribeReadProgress(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = e.newValue ?? EMPTY;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function getReadSnapshot(): string {
  return load();
}

/** The server has no browser storage, so nothing is read there. */
export function getReadServerSnapshot(): string {
  return EMPTY;
}

export function parseRead(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function toggleRead(slug: string): void {
  const current = parseRead(load());
  const next = current.includes(slug)
    ? current.filter((s) => s !== slug)
    : [...current, slug];
  snapshot = JSON.stringify(next);
  try {
    window.localStorage.setItem(KEY, snapshot);
  } catch {
    // Storage unavailable — the tick still shows for this session.
  }
  listeners.forEach((l) => l());
}
