"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Bell,
  Briefcase,
  Calendar,
  Check,
  GraduationCap,
  Loader2,
  MessageCircle,
  Users,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type Notification = {
  _id: Id<"notifications">;
  kind: string;
  title: string;
  body: string;
  href?: string;
  readAt?: number;
  createdAt: number;
};

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  "connection-request": Users,
  "connection-accepted": Check,
  dm: MessageCircle,
  "event-reminder": Calendar,
  "rsvp-reminder": Calendar,
  "job-match": Briefcase,
  mentorship: GraduationCap,
};

function iconFor(kind: string) {
  return ICONS[kind] ?? Bell;
}

function relTime(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.max(1, Math.floor(diff / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const notifications = useQuery(api.notifications.listMine, { limit: 10 }) as
    | Notification[]
    | undefined;
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const onRowClick = async (n: Notification) => {
    if (!n.readAt) {
      try {
        await markRead({ notificationId: n._id });
      } catch {
        // best-effort
      }
    }
    setOpen(false);
    if (n.href) router.push(n.href);
  };

  const onMarkAll = async () => {
    try {
      await markAllRead({});
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Couldn't mark all as read");
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="auf-btn auf-btn-ghost relative"
        title="Notifications"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--gold)]" />
        )}
      </button>

      {open && (
        <div className="auf-card absolute right-0 top-full mt-2 w-[360px] shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b auf-hairline">
            <h3 className="font-serif text-[16px] font-semibold">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAll}
                className="text-[12px] brand-fg hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications === undefined ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 size={16} className="animate-spin ink-3" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-[13px] ink-3 p-6 text-center">
                Nothing here yet.
              </p>
            ) : (
              <ul>
                {notifications.map((n) => {
                  const Icon = iconFor(n.kind);
                  const unread = !n.readAt;
                  return (
                    <li key={n._id}>
                      <button
                        type="button"
                        onClick={() => onRowClick(n)}
                        className={cn(
                          "w-full text-left flex gap-3 px-4 py-3 border-b auf-hairline last:border-b-0 hover:bg-[var(--surface-2)] transition-colors",
                          unread && "bg-[var(--brand-50)]",
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0 mt-0.5 ink-3",
                            unread && "brand-fg",
                          )}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span
                            className={cn(
                              "block text-[13px] truncate",
                              unread ? "font-semibold ink" : "ink-2",
                            )}
                          >
                            {n.title}
                          </span>
                          {n.body && (
                            <span className="block text-[12px] ink-3 truncate">
                              {n.body}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-[11px] ink-3 mt-0.5">
                          {relTime(n.createdAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
