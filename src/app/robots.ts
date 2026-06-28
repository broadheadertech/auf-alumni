/**
 * robots.txt (Epic 15 Story 15.3).
 *
 * Allow indexing of the marketing surface + public profiles. Block auth
 * surfaces and every authenticated route group at the path level so an
 * accidental SSR leak still won't be crawled.
 */

import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/u/"],
        disallow: [
          "/directory",
          "/feed",
          "/connections",
          "/messages",
          "/settings",
          "/profile/edit",
          "/employer/",
          "/admin/",
          "/login",
          "/signup",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
