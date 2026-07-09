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

/** Salted djb2 hash (prototype). Production: bcrypt/argon2 + server pepper. */
function saltedHash(value: string, salt: string): string {
  const s = salt + "|" + value;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

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

export const verify = query({
  args: { alumnaId: v.string(), uid: v.string(), pin: v.string() },
  handler: async (ctx, { alumnaId, uid, pin }) => {
    const card = await ctx.db
      .query("idCards")
      .withIndex("by_alumna", (q) => q.eq("alumnaId", alumnaId))
      .unique();
    if (!card || !card.uidHash || !card.uidSalt || !card.pinHash || !card.pinSalt)
      return false;
    const uidOk =
      saltedHash(uid.trim().toUpperCase(), card.uidSalt) === card.uidHash;
    const pinOk = saltedHash(pin.replace(/\D/g, ""), card.pinSalt) === card.pinHash;
    return uidOk && pinOk;
  },
});

// ------------------------------------------------------------- writes ---

export const bindUid = mutation({
  args: { alumnaId: v.string(), uid: v.string() },
  handler: async (ctx, { alumnaId, uid }) => {
    await requireRole(ctx, STAFF);
    if (!uid.trim()) throw new Error("UID required");
    const salt = randomHex(8);
    const uidHash = saltedHash(uid.trim().toUpperCase(), salt);
    const now = Date.now();
    const existing = await ctx.db
      .query("idCards")
      .withIndex("by_alumna", (q) => q.eq("alumnaId", alumnaId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        uidHash,
        uidSalt: salt,
        status: existing.pinHash ? "active" : "issued",
        boundAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("idCards", {
        alumnaId,
        uidHash,
        uidSalt: salt,
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
    const pinHash = saltedHash(clean, salt);
    const now = Date.now();

    const card = await ctx.db
      .query("idCards")
      .withIndex("by_alumna", (q) => q.eq("alumnaId", row.alumnaId))
      .unique();
    if (card) {
      await ctx.db.patch(card._id, {
        pinHash,
        pinSalt: salt,
        status: "active",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("idCards", {
        alumnaId: row.alumnaId,
        pinHash,
        pinSalt: salt,
        status: "active",
        updatedAt: now,
      });
    }
    await ctx.db.patch(row._id, { usedAt: now });
    return { ok: true as const };
  },
});
