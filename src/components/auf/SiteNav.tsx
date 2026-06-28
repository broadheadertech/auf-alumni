"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GlobalSearch } from "@/components/auf/GlobalSearch";
import { NotificationDropdown } from "@/components/auf/NotificationDropdown";
import { cn } from "@/lib/utils";

export type SiteRole = "marketing" | "alumni" | "employer" | "admin";

type NavItem = { href: string; label: string };

const NAV_BY_ROLE: Record<SiteRole, NavItem[]> = {
  marketing: [
    { href: "/profile/maria-santos", label: "Sample profile" },
  ],
  alumni: [
    { href: "/feed", label: "Feed" },
    { href: "/events", label: "Events" },
    { href: "/jobs", label: "Jobs" },
    { href: "/mentorship", label: "Mentorship" },
    { href: "/connections", label: "Network" },
    { href: "/messages", label: "Messages" },
    { href: "/settings", label: "Settings" },
  ],
  employer: [
    { href: "/employer/dashboard", label: "Dashboard" },
    { href: "/employer/jobs", label: "Job Postings" },
    { href: "/employer/applicants", label: "Applicants" },
    { href: "/employer/analytics", label: "Analytics" },
    { href: "/employer/reports", label: "Reports" },
    { href: "/employer/billing", label: "Billing" },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/queue", label: "Queue" },
    { href: "/admin/moderation/jobs", label: "Jobs" },
    { href: "/admin/employers", label: "Employers" },
    { href: "/admin/alumni", label: "Alumni" },
    { href: "/admin/directory", label: "Directory" },
    { href: "/admin/alumni/approvals", label: "Approvals" },
    { href: "/admin/events", label: "Events" },
    { href: "/admin/analytics", label: "Analytics" },
    { href: "/admin/audit", label: "Audit" },
    { href: "/admin/compliance", label: "Compliance" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/users", label: "Users" },
  ],
};

type SiteNavProps = {
  role: SiteRole;
};

export function SiteNav({ role }: SiteNavProps) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background">
            AUF
          </span>
          <span className="font-semibold tracking-tight">Alumni Network</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          {role === "marketing" && (
            <Link
              href="/signup"
              className={buttonVariants({ size: "sm" })}
            >
              Sign in
            </Link>
          )}
          {role !== "marketing" && <GlobalSearch variant="icon" />}
          {role !== "marketing" && <NotificationDropdown />}
          {role !== "marketing" && <NavSignOut />}
        </nav>

        {/* Compact right-side cluster + hamburger for mobile */}
        <div className="flex items-center gap-2 md:hidden">
          {role === "marketing" && (
            <Link
              href="/signup"
              className={buttonVariants({ size: "sm" })}
            >
              Sign in
            </Link>
          )}
          {role !== "marketing" && <GlobalSearch variant="icon" />}
          {role !== "marketing" && <NotificationDropdown />}
          {role !== "marketing" && <NavSignOut compact />}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="p-2 -mr-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          className="md:hidden border-t border-border bg-background"
          role="navigation"
          aria-label="Mobile"
        >
          <div className="mx-auto max-w-6xl px-4 py-2 flex flex-col">
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "py-3 px-2 text-sm rounded-md transition-colors",
                    active
                      ? "font-medium text-foreground bg-muted"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter({ role: _role }: { role?: SiteRole }) {
  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="font-semibold text-foreground">AUF Alumni Network</span>{" "}
          · Prototype · Mock data for stakeholder review
        </div>
        <div>Not yet affiliated with Angeles University Foundation</div>
      </div>
    </footer>
  );
}

function NavSignOut({ compact }: { compact?: boolean }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/");
      }}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground p-2"
      title="Sign out"
      aria-label="Sign out"
    >
      <LogOut size={14} />
      <span className={compact ? "hidden sm:inline" : ""}>Sign out</span>
    </button>
  );
}
