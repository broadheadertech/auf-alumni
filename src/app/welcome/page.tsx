"use client";

/**
 * Post-login dispatcher. Reads the signed-in user's roles and `replace()`s
 * to the right home so each role lands in its own shell:
 *
 *   super-admin / moderator / verifier         → /admin/dashboard
 *   partner-employer-admin / verified-employer → /employer/dashboard
 *   alumnus                                    → /feed
 *   alumnus-pending (no profile yet)           → /verify
 *
 * Falls back to /feed for unknown / missing role.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/convex-api";

type MeSnapshot = { _id: string; roles?: string[] } | null;

function destinationFor(roles: string[] | undefined): string {
  const set = new Set(roles ?? []);
  if (
    set.has("super-admin") ||
    set.has("moderator") ||
    set.has("verifier")
  ) {
    return "/admin/dashboard";
  }
  if (
    set.has("partner-employer-admin") ||
    set.has("verified-employer-admin")
  ) {
    return "/employer/dashboard";
  }
  if (set.has("alumnus-pending")) {
    return "/verify";
  }
  return "/feed";
}

export default function WelcomePage() {
  const router = useRouter();
  const me = useQuery(api.users.getMe) as MeSnapshot | undefined;

  useEffect(() => {
    if (me === undefined) return;
    if (me === null) {
      router.replace("/login");
      return;
    }
    router.replace(destinationFor(me.roles));
  }, [me, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="flex items-center gap-3 text-[14px] ink-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading your workspace…
      </div>
    </div>
  );
}
