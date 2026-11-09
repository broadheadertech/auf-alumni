/**
 * Password reset.
 *
 * `requestPasswordReset` generates a recovery token, stores it on
 * `passwordResetTokens` with a 30-minute expiry, and EMAILS the link.
 * `resetPassword({ token, newPassword })` validates the token, rehashes the
 * password with Scrypt and updates the `authAccounts` row.
 *
 * SECURITY — the token must never cross the API boundary. An earlier version
 * returned `{ ok, resetUrl }` to the caller and logged the URL, which meant
 * anyone able to call this public action could take over any account,
 * including super-admins, without access to the mailbox. The response is now
 * always a bare `{ ok: true }`, identical whether or not the account exists,
 * so it also stops disclosing which addresses are registered.
 *
 * The only way to see the link without a mailbox is to set
 * `PASSWORD_RESET_DEBUG=true` in the Convex environment. Never set that
 * anywhere reachable from the internet.
 */

"use node";

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { Scrypt } from "lucia";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const TOKEN_TTL_MS = 30 * 60 * 1000;
/** Per-address throttle, so this can't be used to bomb a mailbox. */
const MAX_REQUESTS_PER_HOUR = 3;
const MIN_PASSWORD_LENGTH = 12;

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const requestPasswordReset = internalAction({
  args: { email: v.string() },
  handler: async (
    ctx,
    { email },
  ): Promise<{ ok: true; resetUrl?: string }> => {
    const normalized = email.trim().toLowerCase();
    const account = await ctx.runQuery(
      internal.authResetHelpers.findPasswordAccount,
      { email: normalized },
    );
    // Identical response whether or not the account exists — see the security
    // note above. Returning early here leaks nothing because the shape never
    // varies.
    if (!account) return { ok: true };

    // Throttle before issuing anything, so a flood costs the attacker a
    // request and the victim nothing.
    const recent = await ctx.runQuery(
      internal.authResetHelpers.countRecentResets,
      { userId: account.userId, since: Date.now() - 60 * 60 * 1000 },
    );
    if (recent >= MAX_REQUESTS_PER_HOUR) return { ok: true };

    const token = randomToken();
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    await ctx.runMutation(internal.authResetHelpers.storeResetToken, {
      userId: account.userId,
      token,
      expiresAt,
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await ctx.runAction(internal.actions.email.send, {
      to: normalized,
      subject: "Reset your AUF Alumni Network password",
      html: `<p>Someone asked to reset the password for this account.</p>
        <p><a href="${resetUrl}">Choose a new password</a></p>
        <p>The link works once and expires in 30 minutes. If this wasn't you,
        you can ignore this email — nothing has changed.</p>`,
    });

    // Local development without a mail provider. Off unless explicitly set,
    // and never to be set on an internet-reachable deployment.
    if (process.env.PASSWORD_RESET_DEBUG === "true") {
      return { ok: true, resetUrl };
    }
    return { ok: true };
  },
});

export const resetPassword = internalAction({
  args: { token: v.string(), newPassword: v.string() },
  handler: async (ctx, { token, newPassword }): Promise<{ ok: true }> => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ConvexError({
        code: "weak-password",
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }
    const row = await ctx.runMutation(
      internal.authResetHelpers.consumeResetToken,
      { token },
    );
    if (!row) {
      throw new ConvexError({
        code: "invalid-token",
        message:
          "Reset link is invalid or expired. Request a new one from /forgot-password.",
      });
    }
    const hash = await new Scrypt().hash(newPassword);
    await ctx.runMutation(internal.authResetHelpers.updatePasswordHash, {
      userId: row.userId,
      passwordHash: hash,
    });
    return { ok: true };
  },
});
