/**
 * Convex Auth configuration (Epic 2).
 *
 * Convex Auth uses the `@convex-dev/auth` library. The provider list is
 * declared in `convex/auth.ts`; this file is the Convex-runtime side of the
 * configuration (currently only required as a placeholder so Convex picks up
 * the auth wiring).
 */
export default {
  providers: [
    {
      // Convex Auth's built-in auth domain. The actual provider configuration
      // lives in convex/auth.ts where signIn/signOut handlers are exported.
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
