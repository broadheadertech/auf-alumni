"use client";

/**
 * Admin shell — left sidebar + slim topbar.
 *
 * The admin surface has ~14 destinations, which overflowed the horizontal
 * SiteNav. A grouped vertical sidebar holds them comfortably; the topbar keeps
 * page title, search, notifications, and sign-out. Below `lg` the sidebar
 * slides off-canvas behind a hamburger (same pattern as AlumniShell).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Contact,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Scale,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationDropdown } from "./NotificationDropdown";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

type NavGroup = { label: string | null; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/alumni", label: "Alumni", Icon: Users },
      { href: "/admin/alumni/approvals", label: "Approvals", Icon: ShieldCheck },
      { href: "/admin/directory", label: "Directory", Icon: Contact },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/admin/employers", label: "Employers", Icon: Building2 },
      { href: "/admin/moderation/jobs", label: "Job moderation", Icon: ClipboardCheck },
      { href: "/admin/analytics", label: "Analytics", Icon: BarChart3 },
    ],
  },
  {
    label: "Engagement",
    items: [{ href: "/admin/events", label: "Events", Icon: CalendarDays }],
  },
  {
    label: "Trust & operations",
    items: [
      { href: "/admin/audit", label: "Audit log", Icon: ScrollText },
      { href: "/admin/compliance", label: "Compliance", Icon: Scale },
      { href: "/admin/reports", label: "Reports", Icon: FileText },
      { href: "/admin/users", label: "Users", Icon: UserCog },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

/** Longest-prefix match so nested routes light up exactly one nav item. */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of ALL_ITEMS) {
    if (
      (pathname === item.href || pathname.startsWith(item.href + "/")) &&
      (best === null || item.href.length > best.length)
    ) {
      best = item.href;
    }
  }
  return best;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const active = useMemo(() => activeHref(pathname), [pathname]);
  const title =
    ALL_ITEMS.find((i) => i.href === active)?.label ?? "Admin";

  return (
    <div data-density="dense" className="flex min-h-screen">
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-hidden
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <Sidebar
        active={active}
        drawerOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden -ml-1 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Menu size={20} />
            </button>
            <h1 className="min-w-0 truncate text-base font-semibold tracking-tight">
              {title}
            </h1>
            <div className="ml-auto flex items-center gap-1.5">
              <GlobalSearch variant="icon" />
              <NotificationDropdown />
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({
  active,
  drawerOpen,
  onClose,
}: {
  active: string | null;
  drawerOpen: boolean;
  onClose: () => void;
}) {
  return (
    <aside
      className={cn(
        "flex w-60 shrink-0 flex-col border-r border-border bg-card",
        "fixed inset-y-0 left-0 z-50 h-screen transition-transform",
        "lg:sticky lg:top-0 lg:z-auto lg:translate-x-0",
        drawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
      role="navigation"
      aria-label="Admin"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background">
            AUF
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Admin Console
          </span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="lg:hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {GROUPS.map((group, gi) => (
          <div key={group.label ?? `g${gi}`}>
            {group.label && (
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = active === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-foreground font-medium text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.Icon size={16} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <SignOutButton />
      </div>
    </aside>
  );
}

function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/");
      }}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <LogOut size={16} />
      Sign out
    </button>
  );
}
