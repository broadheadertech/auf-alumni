"use client";

/**
 * "How this page works" — the contextual entry into the guide.
 *
 * A guide nobody can find is a guide nobody reads, so rather than relying on
 * people remembering there is a Guide tab, every screen offers its own
 * walkthrough from the topbar. It resolves the current route to a topic and
 * deep-links to it; on a page with no walkthrough of its own it renders
 * nothing rather than sending the reader somewhere unhelpful.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { topicForPath, type Surface } from "@/lib/guide/content";
import { cn } from "@/lib/utils";

const GUIDE_ROOT: Record<Surface, string> = {
  alumni: "/guide",
  employer: "/employer/guide",
  admin: "/admin/guide",
};

export function PageHelpLink({
  surface,
  className,
}: {
  surface: Surface;
  className?: string;
}) {
  const pathname = usePathname();
  const topic = topicForPath(pathname, surface);
  if (!topic) return null;
  // Don't offer "how this page works" while reading the guide itself.
  if (pathname.startsWith(GUIDE_ROOT[surface])) return null;

  return (
    <Link
      href={`${GUIDE_ROOT[surface]}?topic=${topic.slug}`}
      title={`How ${topic.tab} works`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md p-2 text-sm ink-2 transition-colors hover:bg-[var(--surface-2)] hover:ink",
        className,
      )}
    >
      <CircleHelp size={18} />
      <span className="hidden lg:inline text-[13px]">How this page works</span>
    </Link>
  );
}
