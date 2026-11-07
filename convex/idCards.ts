/**
 * RFID alumni ID cards — server-side (Story: physical ID).
 *
 * Security model:
 *   - The fixed card UID is never stored raw — only a salted hash. It's a
 *     confidential, cloneable secret (write-only, admin-read via reader).
 *   - The alumna sets her own PIN via an emailed single-use link; only a salted
 *     PIN hash is stored. Staff never see it.
 *   - Admin mutations require staff role; activation is token-gated (no login).
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { requireRole, type Role } from "./helpers/rbac";

const STAFF: Role[] = ["verifier", "moderator", "super-admin"];
const ACTIVATION_TTL_MS = 30 * 60 * 1000;

/**
 * PIN and UID hashing.
 *
 * This was djb2 — a 32-bit non-cryptographic hash meant for hash tables. Three
 * problems followed: a 2^32 output space makes collisions expected, so wrong
 * PINs could verify; it is trivially reversible offline if the table leaks;
 * and it is fast, which is the opposite of what a secret this small needs.
 *
 * PBKDF2-SHA256 with 210,000 iterations (the OWASP 2023 figure for this
 * primitive) plus a per-record salt and a deployment-wide pepper. The pepper
 * lives in the environment, not the database, so a database copy alone is not
 * enough to mount an offline attack.
 *
 * Records written by the old scheme carry no `hashAlg` and are rejected by
 * `verify` — those PINs should be treated as compromised and re-issued.
 */
const HASH_ALG = "pbkdf2-sha256-v1";
const PBKDF2_ITERATIONS = 210_000;

async function saltedHash(value: string, salt: string): Promise<string> {
  const pepper = process.env.ID_CARD_PEPPER ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value + "|" + pepper),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time compare, so a near-miss doesn't leak through timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Lockout policy for verify(). */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- reads ---

export const getCard = query({
  args: { alumnaId: v.string() },
  handler: async (ctx, { alumnaId }) => {
    const card = await ctx.db
      .query("idCards")
      .withIndex("by_alumna", (q) => q.eq("alumnaId", alumnaId))
      .unique();
    if (!card) return null;
    return {
      status: card.status,
      hasUid: !!card.uidHash,
      hasPin: !!card.pinHash,
      boundAt: card.boundAt ?? null,
    };
  },
});

export const getActivation = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("cardActivations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!row) return { found: false, used: false };
    return {
      found: true,
      used: row.usedAt != null,
      alumnaName: row.alumnaName,
      alumnaId: row.alumnaId,
    };
  },
});

/**
 * Card verification, for a reader terminal.
 *
 * A mutation rather than a query because it has to count failures: a 4-digit
 * PIN is 10,000 guesses, and `alumnaId` is printed on the card's own QR code,
 * so without a lockout this was an open door. Five wrong attempts locks the
 * card for fifteen minutes; a success clears the counter.
 */
// @no-audit-required: card-reader check, not an administrative action; the
// lockout counter on the card row is the record.
export const verify = mutation({
  args: { alumnaId: v.string(), uid: v.string(), pin: v.string() },
  handler: async (ctx, { alumnaId, uid, pin }) => {
    const card = await ctx.db
      .query("idCards")
      .withIndex("by_alumna", (q) => q.eq("alumnaId", alumnaId))
      .unique();
    if (!card || !card.uidHash || !card.uidSalt || !card.pinHash || !card.pinSalt) {
      return { ok: false as const, reason: "unknown-card" as const };
    }
    if (card.lockedUntil && Date.now() < card.lockedUntil) {
      return { ok: false as const, reason: "locked" as const };
    }
    // Cards hashed by the old prototype scheme can't be trusted — re-activate.
    if (card.hashAlg !== HASH_ALG) {
      return { ok: false as const, reason: "needs-reactivation" as const };
    }

    const uidOk = safeEqual(
      await saltedHash(uid.trim().toUpperCase(), card.uidSalt),
      card.uidHash,
    );
    const pinOk = safeEqual(
      await saltedHash(pin.replace(/\D/g, ""), card.pinSalt),
      card.pinHash,
    );

    if (!uidOk || !pinOk) {
      const failed = (card.failedAttempts ?? 0) + 1;
      await ctx.db.patch(card._id, {
        failedAttempts: failed,
        lockedUntil:
          failed >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : undefined,
      });
      return {
        ok: false as const,
        reason: failed >= MAX_FAILED_ATTEMPTS ? ("locked" as const) : ("mismatch" as const),
      };
    }

    if (card.failedAttempts) {
      await ctx.db.patch(card._id, { failedAttempts: 0, lockedUntil: undefined });
    }
    return { ok: true as const };
  },
});

// ------------------------------------------------------------- writes ---

export const bindUid = mutation({
  args: { alumnaId: v.string(), uid: v.string() },
  handler: async (ctx, { alumnaId, uid }) => {
    await requireRole(ctx, STAFF);
    if (!uid.trim()) throw new Error("UID required");
    const salt = randomHex(8);
    const uidHash = await saltedHash(uid.trim().toUpperCase(), salt);
    const now = Date.now();
    const existing = await ctx.db
      .query("idCards")
      .withIndex("by_alumna", (q) => q.eq("alumnaId", alumnaId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        uidHash,
        uidSalt: salt,
        hashAlg: HASH_ALG,
        status: existing.pinHash ? "active" : "issued",
        boundAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("idCards", {
        alumnaId,
        uidHash,
        uidSalt: salt,
        hashAlg: HASH_ALG,
        status: "issued",
        boundAt: now,
        updatedAt: now,
      });
    }
  },
});

export const setStatus = mutation({
  args: { alumnaId: v.string(), status: v.string() },
  handler: async (ctx, { alumnaId, status }) => {
    await requireRole(ctx, STAFF);
    const card = await ctx.db
      .query("idCards")
      .withIndex("by_alumna", (q) => q.eq("alumnaId", alumnaId))
      .unique();
    if (card) await ctx.db.patch(card._id, { status, updatedAt: Date.now() });
  },
});

export const reissue = mutation({
  args: { alumnaId: v.string() },
  handler: async (ctx, { alumnaId }) => {
    await requireRole(ctx, STAFF);
    const card = await ctx.db
      .query("idCards")
      .withIndex("by_alumna", (q) => q.eq("alumnaId", alumnaId))
      .unique();
    if (card) await ctx.db.delete(card._id);
  },
});

export const issueActivation = mutation({
  args: {
    alumnaId: v.string(),
    alumnaName: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { alumnaId, alumnaName, email }) => {
    await requireRole(ctx, STAFF);
    const now = Date.now();

    // Ensure a card row exists (issued).
    const existing = await ctx.db
      .query("idCards")
      .withIndex("by_alumna", (q) => q.eq("alumnaId", alumnaId))
      .unique();
    if (!existing) {
      await ctx.db.insert("idCards", {
        alumnaId,
        status: "issued",
        updatedAt: now,
      });
    }

    const token = randomHex(24);
    await ctx.db.insert("cardActivations", {
      token,
      alumnaId,
      alumnaName,
      email,
      createdAt: now,
      expiresAt: now + ACTIVATION_TTL_MS,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const url = `${appUrl}/activate-id?token=${token}`;

    await ctx.scheduler.runAfter(0, api.actions.sendCardIssued.sendCardIssued, {
      to: email,
      recipientName: alumnaName,
      activationUrl: url,
    });

    return { token, url };
  },
});

export const activate = mutation({
  args: { token: v.string(), pin: v.string() },
  handler: async (ctx, { token, pin }) => {
    const row = await ctx.db
      .query("cardActivations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!row) return { ok: false, reason: "invalid" as const };
    if (row.usedAt != null) return { ok: false, reason: "used" as const };
    if (Date.now() > row.expiresAt) return { ok: false, reason: "expired" as const };

    const clean = pin.replace(/\D/g, "");
    if (clean.length < 4) return { ok: false, reason: "pin" as const };

    const salt = randomHex(8);
    const pinHash = await saltedHash(clean, salt);
    const now = Date.now();

    const card = await ctx.db
      .query("idCards")
      .withIndex("by_alumna", (q) => q.eq("alumnaId", row.alumnaId))
      .unique();
    if (card) {
      await ctx.db.patch(card._id, {
        pinHash,
        pinSalt: salt,
        hashAlg: HASH_ALG,
        status: "active",
        failedAttempts: 0,
        lockedUntil: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("idCards", {
        alumnaId: row.alumnaId,
        pinHash,
        pinSalt: salt,
        hashAlg: HASH_ALG,
        status: "active",
        updatedAt: now,
      });
    }
    await ctx.db.patch(row._id, { usedAt: now });
    return { ok: true as const };
  },
});
