"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NotificationDropdown } from "@/components/auf/NotificationDropdown";
import { cn } from "@/lib/utils";

export type SiteRole = "marketing" | "alumni" | "employer" | "admin";

type NavItem = { href: string; label: string };

const NAV_BY_ROLE: Record<SiteRole, NavItem[]> = {
  marketing: [
    { href: "/directory", label: "Directory" },
    { href: "/profile/maria-santos", label: "Sample profile" },
  ],
  alumni: [
    { href: "/directory", label: "Directory" },
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
    { href: "/employer/jobs", label: "Jobs" },
    { href: "/employer/applicants", label: "Applicants" },
    { href: "/employer/billing", label: "Billing" },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/queue", label: "Queue" },
    { href: "/admin/moderation/jobs", label: "Jobs" },
    { href: "/admin/employers", label: "Employers" },
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

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background">
            AUF
          </span>
          <span className="font-semibold tracking-tight">Alumni Network</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
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
          {role !== "marketing" && <NotificationDropdown />}
          {role !== "marketing" && <NavSignOut />}
        </nav>
      </div>
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

function NavSignOut() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/");
      }}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      title="Sign out"
    >
      <LogOut size={14} />
      Sign out
    </button>
  );
}
