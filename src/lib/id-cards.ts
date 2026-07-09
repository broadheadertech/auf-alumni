/**
 * Alumni RFID ID cards (prototype).
 *
 * The physical card is non-programmable — it only emits a fixed factory UID.
 * So the card is a pointer: we store UID → alumna here, plus a PIN as a second
 * factor (the QR/alumniId is the third, verifiable, factor). Lifecycle:
 *   unassigned → issued (admin binds UID) → active → lost → reissue.
 *
 * Persisted to localStorage; swap for a Convex `cards` table when wired.
 */

import { useSyncExternalStore } from "react";

export type CardStatus = "issued" | "active" | "lost";

export type IdCard = {
  /**
   * A SALTED hash of the fixed card UID — never the raw number. The UID is a
   * confidential, cloneable secret, so it's write-only: bound from the reader,
   * salted + hashed, and only ever compared (never displayed or retrievable).
   */
  uidHash: string;
  /** Per-record random salt, so identical UIDs hash differently. */
  salt: string;
  status: CardStatus;
  pin?: string; // second factor
  boundAt: string; // ISO date
};

/** Lightweight salted djb2 hash (prototype). Production: bcrypt/argon2 + pepper. */
function hashUid(uid: string, salt: string): string {
  const s = salt + "|" + uid.trim().toUpperCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

function randomSalt(): string {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const arr = new Uint8Array(8);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2, 18);
}

type CardMap = Record<string, IdCard>;

const STORAGE_KEY = "auf-id-cards-v1";
const STAMP = "2026-07-10";
const EMPTY: CardMap = {};

function read(): CardMap {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CardMap) : {};
  } catch {
    return {};
  }
}

let cache: CardMap = read();
const listeners = new Set<() => void>();

function commit(next: CardMap) {
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

/** Bind (or rebind) a card UID. The raw UID is salted + hashed, never stored. */
export function bindCard(alumnaId: string, uid: string) {
  if (!uid.trim()) return;
  const prev = cache[alumnaId];
  const salt = randomSalt();
  commit({
    ...cache,
    [alumnaId]: {
      uidHash: hashUid(uid, salt),
      salt,
      status: "issued",
      pin: prev?.pin,
      boundAt: STAMP,
    },
  });
}

/** Two-factor check: salted-hashed UID from the reader + the alumna's PIN. */
export function verifyCard(alumnaId: string, uid: string, pin: string): boolean {
  const card = cache[alumnaId];
  if (!card || !card.uidHash) return false;
  const uidOk = hashUid(uid, card.salt) === card.uidHash;
  const pinOk = !!card.pin && pin.replace(/\D/g, "") === card.pin;
  return uidOk && pinOk;
}

export function setCardStatus(alumnaId: string, status: CardStatus) {
  const card = cache[alumnaId];
  if (!card) return;
  commit({ ...cache, [alumnaId]: { ...card, status } });
}

export function setCardPin(alumnaId: string, pin: string) {
  const card = cache[alumnaId];
  const clean = pin.replace(/\D/g, "").slice(0, 6);
  if (!card) {
    // allow setting a PIN before a card exists (pre-activation)
    commit({
      ...cache,
      [alumnaId]: { uidHash: "", salt: "", status: "issued", pin: clean, boundAt: STAMP },
    });
    return;
  }
  commit({ ...cache, [alumnaId]: { ...card, pin: clean } });
}

/** Reissue — clear the card entirely so a new UID can be bound. */
export function reissueCard(alumnaId: string) {
  if (!cache[alumnaId]) return;
  const next = { ...cache };
  delete next[alumnaId];
  commit(next);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useCardMap(): CardMap {
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => EMPTY,
  );
}

export function useIdCard(alumnaId: string): IdCard | null {
  return useCardMap()[alumnaId] ?? null;
}

/** Deterministic virtual Alumni ID for the mock roster. */
export function alumniIdOf(id: string, batch: number): string {
  const seq = id.replace(/\D/g, "").padStart(6, "0");
  return `AUF-${batch}-${seq}`;
}

export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  issued: "Issued",
  active: "Active",
  lost: "Lost",
};

// ------------------------------------------------- PIN activation tokens ---
// Single-use tokens for the emailed "set your PIN" flow. Prototype: localStorage
// (same-browser). Production: a Convex table so the emailed link works
// cross-device, with a real TTL.

type ActivationToken = { alumnaId: string; usedAt?: string };
const TOKEN_KEY = "auf-id-activation-v1";

function readTokens(): Record<string, ActivationToken> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ActivationToken>) : {};
  } catch {
    return {};
  }
}
function writeTokens(t: Record<string, ActivationToken>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}
function randomToken(): string {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/** Issue a single-use PIN-setup token (marks the card "issued"). */
export function issueActivation(alumnaId: string): string {
  if (!cache[alumnaId]) {
    commit({
      ...cache,
      [alumnaId]: { uidHash: "", salt: "", status: "issued", boundAt: STAMP },
    });
  }
  const token = randomToken();
  const tokens = readTokens();
  tokens[token] = { alumnaId };
  writeTokens(tokens);
  return token;
}

export function getActivation(
  token: string,
): { ok: boolean; alumnaId?: string; reason?: "invalid" | "used" } {
  const t = readTokens()[token];
  if (!t) return { ok: false, reason: "invalid" };
  if (t.usedAt) return { ok: false, reason: "used" };
  return { ok: true, alumnaId: t.alumnaId };
}

/** Consume a token and set the alumna's PIN (activates the card). */
export function activateWithToken(
  token: string,
  pin: string,
): { ok: boolean; reason?: "invalid" | "used" | "pin" } {
  const tokens = readTokens();
  const t = tokens[token];
  if (!t) return { ok: false, reason: "invalid" };
  if (t.usedAt) return { ok: false, reason: "used" };
  const clean = pin.replace(/\D/g, "");
  if (clean.length < 4) return { ok: false, reason: "pin" };
  setCardPin(t.alumnaId, clean);
  setCardStatus(t.alumnaId, "active");
  tokens[token] = { ...t, usedAt: STAMP };
  writeTokens(tokens);
  return { ok: true };
}
