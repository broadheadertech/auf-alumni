/**
 * 404. Previously Next's bare default, which says "This page could not be
 * found" on a white page and offers nowhere to go.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[520px] flex-col items-center justify-center px-6 text-center">
      <div className="section-eyebrow brand-fg">404</div>
      <h1 className="mt-2 font-serif text-[26px] font-semibold">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-2 text-[14.5px] ink-2">
        The link may be out of date, or the page may have moved. If you followed
        it from an email, the content behind it might have been removed.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className="auf-btn auf-btn-primary">
          Go to the home page
        </Link>
        <Link href="/careers" className="auf-btn auf-btn-outline">
          Browse open roles
        </Link>
        <Link href="/help" className="auf-btn auf-btn-ghost">
          Help centre
        </Link>
      </div>
    </div>
  );
}
