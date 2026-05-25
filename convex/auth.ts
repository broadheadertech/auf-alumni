import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

/**
 * Convex Auth: email + password (Epic 2 Story 2.1).
 *
 * Adds standard auth tables (`authAccounts`, `authSessions`, `authVerifiers`)
 * managed by @convex-dev/auth and exports the auth handlers consumed by
 * the Next.js API route and React provider.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
