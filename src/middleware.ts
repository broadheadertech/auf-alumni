import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

/**
 * Auth gating — deny by default.
 *
 * This used to list the protected routes, which meant every new signed-in
 * screen was public until someone remembered to add it. By the time of the
 * November audit the list had fallen well behind: /feed, /jobs, /messages,
 * /mentorship, /academy, /events, /id, /profile/edit, /resume/preview and
 * /guide all rendered their full shell to a stranger. Nothing leaked, because
 * the Convex queries behind them return nothing without a session — but that
 * made every query the only thing standing between a visitor and the data, and
 * one that forgot to check would have been a live breach.
 *
 * So the rule is inverted: anything not named below needs a session. Adding a
 * page now makes it private by default, and making something public is a
 * deliberate edit to this file.
 */
const isPublicRoute = createRouteMatcher([
  // Marketing site
  "/",
  "/about",
  "/admissions",
  "/careers",
  "/colleges",
  "/companies(.*)",
  "/contact",
  "/for-alumni",
  "/for-employers",
  "/guidelines",
  "/help",
  "/how-to-set-up-alumni-id",
  "/legal(.*)",
  "/news(.*)",
  "/report",
  "/trust",
  "/verification",
  // Public profile and the QR-scan landing for an Alumni ID
  "/u/(.*)",
  "/i/(.*)",
  // Auth screens
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  // Reached from one-tap email links, by design: both carry their own
  // single-use token and must work without a session.
  "/rsvp",
  "/activate-id",
  // Convex Auth's own endpoints — blocking these would break signing in.
  "/api(.*)",
]);

const isAuthRoute = createRouteMatcher(["/login", "/signup"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authenticated = await convexAuth.isAuthenticated();
  if (!isPublicRoute(request) && !authenticated) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  if (isAuthRoute(request) && authenticated) {
    return nextjsMiddlewareRedirect(request, "/feed");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
