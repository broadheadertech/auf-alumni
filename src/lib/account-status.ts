/**
 * Account lifecycle store (admin-initiated) — deactivation, rejection, and
 * reactivation for employer + alumnus accounts.
 *
 * "Cancellation" here = deactivate (reversible, hidden, never purged). Reject
 * records a denied account. Reactivate clears either state → active.
 *
 * Prototype persistence: localStorage + an external-store subscription so the
 * admin rosters and detail pages stay in sync without a backend. Swap for
 * Convex mutations on the users / employerOrgs tables when wired.
 */

import { useSyncExternalStore } from "react";

export type AccountStatusKind = "deactivated" | "rejected";

export type AccountStatusEntry = {
  kind: AccountStatusKind;
  at: string; // ISO date
  reason: string;
};

type StatusMap = Record<string, AccountStatusEntry>;

const STORAGE_KEY = "auf-account-status-v1";
const STAMP = "2026-06-28"; // dataset "today" — deterministic, no Date in render
const EMPTY: StatusMap = {};

function read(): StatusMap {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StatusMap) : {};
  } catch {
    return {};
  }
}

let cache: StatusMap = read();
const listeners = new Set<() => void>();

function commit(next: StatusMap) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }
  listeners.forEach((l) => l());
}

export function setAccountStatus(
  id: string,
  kind: AccountStatusKind,
  reason: string,
) {
  commit({ ...cache, [id]: { kind, at: STAMP, reason } });
}

/** Reactivate — clear any deactivated/rejected state. */
export function clearAccountStatus(id: string) {
  if (!cache[id]) return;
  const next = { ...cache };
  delete next[id];
  commit(next);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useAccountStatusMap(): StatusMap {
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => EMPTY,
  );
}

export function useAccountStatus(id: string): AccountStatusEntry | null {
  return useAccountStatusMap()[id] ?? null;
}

export const ACCOUNT_STATUS_LABEL: Record<AccountStatusKind, string> = {
  deactivated: "Deactivated",
  rejected: "Rejected",
};
