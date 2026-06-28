import { redirect } from "next/navigation";

/**
 * Job analytics merged into the single Analytics page. This stub redirects any
 * lingering links/bookmarks to /admin/analytics.
 */
export default function JobAnalyticsRedirect() {
  redirect("/admin/analytics");
}
