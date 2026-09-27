"use client";

/**
 * Makes a nav link that points at the page you're already on actually do
 * something.
 *
 * Next's <Link> is a no-op when the target matches the current route, so
 * clicking the AUF wordmark on /feed — the usual "take me home / refresh this"
 * gesture — appeared dead. This re-fetches the server components and scrolls
 * back to the top, which is what people expect from clicking a site logo.
 */

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

export function useSameRouteRefresh(href: string) {
  const pathname = usePathname();
  const router = useRouter();

  return useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (pathname !== href) return; // let Link navigate normally
      // Don't hijack open-in-new-tab / middle-click.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }
      e.preventDefault();
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [pathname, href, router],
  );
}
