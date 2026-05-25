import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

/**
 * Auth gating. The directory and profile routes remain public during the
 * prototype phase (they read from mock data, not Convex). Gating them moves
 * to a later epic when the directory wires to real Convex queries.
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
    return nextjsMiddlewareRedirect(request, "/directory");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
