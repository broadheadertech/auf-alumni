/**
 * Employer ⇄ applicant messaging (prototype).
 *
 * The employer can message an alumna once she has applied to one of its
 * postings, so threads are keyed by applicant id (EmployerApplicant.id). Held
 * in localStorage with an external-store subscription so the messages page and
 * the applicants page stay in sync. Swap for Convex `messages` when wired.
 */

import { useSyncExternalStore } from "react";

export type ChatMessage = {
  id: string;
  from: "employer" | "applicant";
  text: string;
  at: string; // ISO datetime
};

type Threads = Record<string, ChatMessage[]>;

const STORAGE_KEY = "auf-employer-messages-v1";
const EMPTY: Threads = {};

function read(): Threads {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Threads) : {};
  } catch {
    return {};
  }
}

let cache: Threads = read();
const listeners = new Set<() => void>();

function commit(next: Threads) {
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

export function sendEmployerMessage(applicantId: string, text: string) {
  const body = text.trim();
  if (!body) return;
  const thread = cache[applicantId] ?? [];
  const msg: ChatMessage = {
    id: `${applicantId}-${thread.length}`,
    from: "employer",
    text: body,
    at: new Date().toISOString(),
  };
  commit({ ...cache, [applicantId]: [...thread, msg] });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useEmployerThreads(): Threads {
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => EMPTY,
  );
}
