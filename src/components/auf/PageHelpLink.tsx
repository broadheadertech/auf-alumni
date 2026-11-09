"use client";

/**
 * "How this page works" — the entry point to both halves of the help.
 *
 * Clicking it runs the page's spotlight tour when one exists, because being
 * walked through the actual screen beats reading about it. Pages without a
 * tour fall through to the written guide, and the last step of every tour
 * links there anyway for anyone who wants the detail.
 *
 * A guide nobody can find is a guide nobody reads, so this sits in the topbar
 * of every screen rather than relying on people remembering the Guide tab.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, PlayCircle } from "lucide-react";
import { topicForPath, type Surface } from "@/lib/guide/content";
import { tourForPath } from "@/lib/guide/tours";
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
  const tour = tourForPath(pathname);

  // Nothing to offer at all.
  if (!topic && !tour) return null;
  // Don't offer "how this page works" while reading the guide itself.
  if (pathname.startsWith(GUIDE_ROOT[surface])) return null;

  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-md p-2 text-sm ink-2 transition-colors hover:bg-[var(--surface-2)] hover:ink",
    className,
  );

  if (tour) {
    // Named for what it does, not for what it is about. "How this page works"
    // reads like a link to documentation, which is what it used to be — and
    // left people unsure they could run the walkthrough a second time.
    return (
      <button
        type="button"
        data-tour="page-help"
        title={`Show me: ${tour.label} (${tour.steps.length} steps)`}
        onClick={() => window.dispatchEvent(new Event("auf:start-tour"))}
        className={classes}
      >
        <PlayCircle size={18} />
        <span className="hidden lg:inline text-[13px]">Show me this page</span>
      </button>
    );
  }

  return (
    <Link
      href={`${GUIDE_ROOT[surface]}?topic=${topic!.slug}`}
      data-tour="page-help"
      title={`How ${topic!.tab} works`}
      className={classes}
    >
      <CircleHelp size={18} />
      <span className="hidden lg:inline text-[13px]">How this page works</span>
    </Link>
  );
}
