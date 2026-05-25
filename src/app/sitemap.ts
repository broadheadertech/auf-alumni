/**
 * Public sitemap (Epic 15 Story 15.3).
 *
 * Lists static marketing routes + every verified alumna who hasn't opted out
 * of search engine indexing. The Convex query enforces opt-out filtering
 * server-side so a misconfigured client can't expose a hidden profile.
 */

import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/lib/convex-api";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/directory`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/signup`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.4 },
  ];

  let profileRoutes: MetadataRoute.Sitemap = [];
  try {
    const slugs = (await fetchQuery(api.profiles.listIndexableSlugs, {})) as
      | Array<{ slug: string; updatedAt: number }>
      | undefined;
    profileRoutes =
      slugs?.map((s) => ({
        url: `${SITE_URL}/u/${s.slug}`,
        lastModified: new Date(s.updatedAt),
        changeFrequency: "monthly",
        priority: 0.7,
      })) ?? [];
  } catch {
    // Convex unavailable at build time — return static only.
  }

  return [...staticRoutes, ...profileRoutes];
}
