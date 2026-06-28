import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

/**
 * Auth gating. The profile routes remain public during the prototype phase
 * (they read from mock data, not Convex). The alumni directory is admin-only
 * — it lives under /admin/* and is gated below; the alumnus-facing app has no
 * directory (alumni roster is private).
 */
const isProtectedRoute = createRouteMatcher([
  "/connections(.*)",
  "/settings(.*)",
  "/admin(.*)",
  "/employer(.*)",
  "/verify(.*)",
]);

const isAuthRoute = createRouteMatcher(["/login", "/signup"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authenticated = await convexAuth.isAuthenticated();
  if (isProtectedRoute(request) && !authenticated) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  if (isAuthRoute(request) && authenticated) {
    return nextjsMiddlewareRedirect(request, "/feed");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
