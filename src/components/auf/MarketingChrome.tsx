"use client";

/**
 * Marketing top-nav + footer (ported from Claude Design prototype).
 * Used by the public surface; auth and alumni surfaces have their own chrome.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { AUFInlineLockup, AUFLockup } from "./AUFMark";
import { cn } from "@/lib/utils";

const LINKS: Array<[string, string]> = [
  ["/", "Home"],
  ["/jobs", "Jobs"],
  ["/directory", "Alumni"],
  ["/for-employers", "For employers"],
  ["/about", "About"],
];

export function MarketingNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur"
      style={{
        background: "rgba(250,250,248,0.85)",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 sm:px-7 h-[64px] md:h-[68px] flex items-center gap-3 md:gap-8">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <AUFInlineLockup />
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-3">
          {LINKS.map(([href, label]) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[13.5px] font-medium transition",
                  active ? "brand-fg" : "ink-2 hover:ink",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="auf-btn auf-btn-ghost auf-btn-sm hidden sm:inline-flex"
          >
            Sign in
          </Link>
          <Link href="/signup" className="auf-btn auf-btn-primary auf-btn-sm">
            Get started <ArrowRight size={13} />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="md:hidden p-2 -mr-1 rounded-md ink-2 hover:ink hover:bg-[var(--surface-2)]"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          className="md:hidden border-t auf-hairline bg-[var(--bg)]"
          role="navigation"
          aria-label="Mobile"
        >
          <div className="max-w-[1240px] mx-auto px-4 py-2 flex flex-col">
            {LINKS.map(([href, label]) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "py-3 px-2 rounded-md text-[14px] font-medium transition",
                    active
                      ? "brand-fg bg-[var(--brand-50)]"
                      : "ink-2 hover:ink hover:bg-[var(--surface-2)]",
                  )}
                >
                  {label}
                </Link>
              );
            })}
            <Link
              href="/login"
              className="sm:hidden py-3 px-2 rounded-md text-[14px] font-medium ink-2 hover:ink hover:bg-[var(--surface-2)]"
            >
              Sign in
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer
      className="mt-20 pt-14 pb-10"
      style={{ background: "var(--brand-deep)", color: "rgba(255,255,255,0.78)" }}
    >
      <div className="max-w-[1240px] mx-auto px-4 sm:px-7 grid grid-cols-12 gap-6 sm:gap-8">
        <div className="col-span-12 md:col-span-4">
          <AUFLockup height={40} />
          <p
            className="text-[13px] leading-relaxed mt-4 max-w-[36ch]"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            The official network &amp; careers platform of Angeles University Foundation
            alumni. Est. 1971.
          </p>
          <div className="text-[11px] mt-4" style={{ color: "rgba(255,255,255,0.5)" }}>
            McArthur Highway, Angeles City 2009, Pampanga, PH
          </div>
        </div>
        <FooterCol
          title="Platform"
          items={[
            { label: "For alumni", href: "/for-alumni" },
            { label: "For employers", href: "/for-employers" },
            { label: "Jobs board", href: "/jobs" },
            { label: "Mentorship", href: "/mentorship" },
            { label: "Events", href: "/events" },
          ]}
        />
        <FooterCol
          title="University"
          items={[
            { label: "About AUF", href: "/about" },
            { label: "Colleges", href: "/colleges" },
            { label: "Admissions", href: "/admissions" },
            { label: "News", href: "/news" },
            { label: "Contact", href: "/contact" },
          ]}
        />
        <FooterCol
          title="Support"
          items={[
            { label: "Help center", href: "/help" },
            { label: "Verification", href: "/verification" },
            { label: "Trust & safety", href: "/trust" },
            { label: "Guidelines", href: "/guidelines" },
            { label: "Report", href: "/report" },
          ]}
        />
        <FooterCol
          title="Legal"
          items={[
            { label: "Privacy policy", href: "/legal/privacy" },
            { label: "Terms of service", href: "/legal/terms" },
            { label: "Cookie policy", href: "/legal/cookies" },
            { label: "Accessibility", href: "/legal/accessibility" },
            { label: "Data requests", href: "/legal/data-requests" },
          ]}
        />
      </div>
      <div
        className="max-w-[1240px] mx-auto px-4 sm:px-7 mt-12 pt-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-[11.5px]"
        style={{ borderTop: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
      >
        <div>© 2026 Angeles University Foundation. All rights reserved.</div>
        <div className="flex items-center gap-4">
          <span>EN</span>
          <span>·</span>
          <span>Filipino</span>
          <span>·</span>
          <span>
            Status · all systems operational{" "}
            <span
              className="inline-block w-1.5 h-1.5 rounded-full align-middle ml-1"
              style={{ background: "var(--gold)" }}
            />
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; href: string }>;
}) {
  return (
    <div className="col-span-6 md:col-span-2">
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-3"
        style={{ color: "var(--gold)" }}
      >
        {title}
      </div>
      <ul className="space-y-2 text-[13px]">
        {items.map(({ label, href }) => (
          <li key={href}>
            <Link href={href} className="hover:text-white transition">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
