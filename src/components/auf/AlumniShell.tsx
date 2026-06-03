"use client";

/**
 * Alumni shell — sidebar + topbar (ported from Claude Design prototype).
 *
 * Renders the AUFWordmark on a navy band, the role-aware nav, a network
 * mini-stats block, and the user-profile footer card. The topbar handles
 * page title, search, notifications, and the "Post a job" CTA.
 *
 * Below `lg` the sidebar slides off-canvas and is toggled by a hamburger
 * in the topbar.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  BookOpen,
  Briefcase,
  Calendar,
  GraduationCap,
  Home,
  IdCard,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Settings,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { AUFWordmark } from "./AUFMark";
import { AUFAvatar } from "./AUFAvatar";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationDropdown } from "./NotificationDropdown";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  badge?: number;
};

const NAV: NavItem[] = [
  { href: "/feed", label: "Home", Icon: Home },
  { href: "/jobs", label: "Jobs", Icon: Briefcase, badge: 4 },
  { href: "/directory", label: "Directory", Icon: Users },
  { href: "/mentorship", label: "Mentorship", Icon: GraduationCap },
  { href: "/academy", label: "Academy", Icon: BookOpen },
  { href: "/events", label: "Events", Icon: Calendar },
  { href: "/messages", label: "Messages", Icon: MessageCircle, badge: 2 },
  { href: "/id", label: "Alumni ID", Icon: IdCard },
];

const PAGE_TITLES: Record<string, string> = {
  "/feed": "Home",
  "/jobs": "Jobs",
  "/directory": "Alumni Directory",
  "/mentorship": "Mentorship",
  "/events": "Events",
  "/messages": "Messages",
  "/connections": "Network",
  "/academy": "AUF Academy",
  "/id": "Alumni ID",
  "/profile/edit": "My Profile",
  "/settings": "Settings",
  "/settings/notifications": "Notifications",
};

function titleFor(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Match prefixes
  const prefix = Object.keys(PAGE_TITLES).find((p) => pathname.startsWith(p));
  return prefix ? PAGE_TITLES[prefix] : "AUF Alumni";
}

export function AlumniShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Reset drawer on navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen flex" data-density="cozy">
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-hidden
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <Sidebar
        pathname={pathname}
        drawerOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <main className="flex-1 min-w-0">
        <TopBar pathname={pathname} onOpenDrawer={() => setDrawerOpen(true)} />
        {children}
      </main>
    </div>
  );
}

function Sidebar({
  pathname,
  drawerOpen,
  onClose,
}: {
  pathname: string;
  drawerOpen: boolean;
  onClose: () => void;
}) {
  const me = useQuery(api.users.getMe);
  const myProfile = useQuery(api.profiles.getMyProfile);

  type ProfileSnapshot = {
    displayName?: string;
    program?: string;
    batch?: number;
  };
  const profile = (myProfile ?? null) as ProfileSnapshot | null;
  type UserSnapshot = { name?: string; email?: string } | null;
  const userInfo = (me ?? null) as UserSnapshot;

  const displayName =
    profile?.displayName ?? userInfo?.name ?? userInfo?.email ?? "Alumna";
  const programLine =
    profile?.program && profile?.batch
      ? `${profile.program}, AUF '${String(profile.batch).slice(-2)}`
      : "Verified alumna";

  return (
    <aside
      className={cn(
        "w-[248px] shrink-0 border-r auf-hairline flex flex-col bg-[var(--surface)]",
        // Off-canvas drawer below lg, static sidebar at lg+.
        "fixed inset-y-0 left-0 z-50 h-screen transition-transform lg:sticky lg:top-0 lg:translate-x-0 lg:z-auto",
        drawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
      role="navigation"
      aria-label="Primary"
    >
      <div className="px-3 pt-3 pb-3 flex items-center justify-between">
        <AUFWordmark />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="lg:hidden p-2 -mr-1 rounded-md ink-3 hover:ink hover:bg-[var(--surface-2)]"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="px-3 flex flex-col gap-0.5 mt-1">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn("auf-nav-item", active && "active")}
            >
              <n.Icon size={18} />
              <span className="flex-1">{n.label}</span>
              {n.badge ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full brand-bg text-white">
                  {n.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mx-5 my-4 border-t auf-hairline"></div>

      <div className="px-5">
        <div className="section-eyebrow mb-3">Your network</div>
        <NetworkStats />
      </div>

      <div className="mt-auto p-3 border-t auf-hairline">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-2)]">
          <Link
            href="/profile/edit"
            className="flex flex-1 items-center gap-3 min-w-0"
          >
            <AUFAvatar name={displayName} grad={1} ring badge size={36} />
            <span className="flex-1 min-w-0 leading-tight">
              <span className="block text-sm font-medium truncate">
                {displayName}
              </span>
              <span className="block text-[11px] ink-3 truncate">
                {programLine}
              </span>
            </span>
          </Link>
          <Link
            href="/settings"
            className="p-2 rounded ink-3 hover:ink"
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={16} />
          </Link>
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}

function NetworkStats() {
  type Counts = { connected: number; pendingIncoming: number } | null;
  const counts = useQuery(api.connections.myCounts) as Counts | undefined;
  const mentors = useQuery(api.connections.mentorsAvailableCount) as
    | number
    | undefined;
  const fmt = (n: number | null | undefined) =>
    n == null ? "—" : n.toLocaleString();
  return (
    <div className="space-y-2.5">
      <Row label="Connections" value={fmt(counts?.connected)} />
      <Row
        label="Pending requests"
        value={fmt(counts?.pendingIncoming)}
      />
      <Row
        label={
          <span className="inline-flex items-center gap-1.5">
            <span className="live-dot" />
            Mentors available
          </span>
        }
        value={fmt(mentors)}
      />
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="ink-2">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function TopBar({
  pathname,
  onOpenDrawer,
}: {
  pathname: string;
  onOpenDrawer: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 bg-[var(--bg)]/85 backdrop-blur border-b auf-hairline">
      <div className="flex items-center gap-2 sm:gap-4 px-4 sm:px-7 h-[64px]">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Open menu"
          aria-expanded={false}
          className="lg:hidden p-2 -ml-1 rounded-md ink-2 hover:ink hover:bg-[var(--surface-2)]"
        >
          <Menu size={20} />
        </button>
        <div className="font-serif text-[16px] sm:text-[20px] tracking-tight font-semibold min-w-0 truncate sm:min-w-[120px]">
          {titleFor(pathname)}
        </div>

        <GlobalSearch />

        <div className="flex-1 md:hidden" />

        <NotificationDropdown />
        <Link
          href="/messages"
          className="auf-btn auf-btn-ghost"
          title="Messages"
          aria-label="Messages"
        >
          <MessageCircle size={18} />
        </Link>
        <div className="w-px h-6 bg-[var(--border-soft)] hidden sm:block" />
        <Link
          href="/employer/jobs"
          className="auf-btn auf-btn-primary auf-btn-sm"
          aria-label="Post a job"
        >
          <Plus size={14} />
          <span className="hidden md:inline">Post a job</span>
        </Link>
      </div>
    </header>
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
      className="p-2 rounded ink-3 hover:ink"
      title="Sign out"
      aria-label="Sign out"
    >
      <LogOut size={16} />
    </button>
  );
}
