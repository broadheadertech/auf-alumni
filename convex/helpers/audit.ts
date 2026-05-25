/**
 * Audit-log wrapper (Story 1.4) — invariant for NFR11.
 *
 * Every admin / moderation mutation MUST be wrapped with `withAuditLog`.
 * The wrapper takes a handler that returns `{ action, target, reason?, metadata?, result? }`
 * and inserts an `auditEntries` row in the same transaction, then returns
 * `result` so callers see a transparent return value.
 *
 * The lint script at web/scripts/lint-admin-mutations.mjs enforces usage.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "../_generated/server";

export type AuditableResult<R = unknown> = {
  action: string;
  target: { type: string; id: string };
  reason?: string;
  metadata?: unknown;
  result?: R;
};

// `Args` defaults to `any` because Convex's mutation({ handler }) builds the
// argument shape from its own validator object — TypeScript can't infer it
// from the destructured lambda parameter alone, and forcing the call-site
// to repeat the type would be noise. Runtime validation still happens in
// Convex's argument validator; this just keeps the wrapper transparent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAuditLog<Args = any, R = unknown>(
  handler: (ctx: MutationCtx, args: Args) => Promise<AuditableResult<R>>,
) {
  return async (ctx: MutationCtx, args: Args): Promise<R | undefined> => {
    const outcome = await handler(ctx, args);

    const resolved = await getAuthUserId(ctx);
    const actorId: import("../_generated/dataModel").Id<"users"> | undefined =
      resolved ?? undefined;

    await ctx.db.insert("auditEntries", {
      actorId,
      actorType: actorId ? "user" : "system",
      actionType: outcome.action,
      targetType: outcome.target.type,
      targetId: outcome.target.id,
      reason: outcome.reason,
      metadata: outcome.metadata,
      timestamp: Date.now(),
    });
    return outcome.result;
  };
}
