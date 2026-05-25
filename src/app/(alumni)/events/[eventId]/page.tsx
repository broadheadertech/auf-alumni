"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CalendarX,
  ExternalLink,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { AUFAvatar } from "@/components/auf/AUFAvatar";
import { EmptyState } from "@/components/auf/EmptyState";

type Attendee = {
  displayName: string;
  slug: string;
  program?: string;
  batch?: number;
};

type EventDetail = {
  _id: string;
  title: string;
  description: string;
  startsAt: number;
  endsAt?: number;
  locationLabel?: string;
  onlineUrl?: string;
  capacity?: number;
  cancelledAt?: number;
  myRsvpStatus: string | null;
  goingCount: number;
  maybeCount: number;
  waitlistCount: number;
  attendees: Attendee[];
};

function formatDateLine(startsAt: number, endsAt?: number): string {
  const d = new Date(startsAt);
  const date = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (endsAt) {
    const e = new Date(endsAt);
    const sameDay = e.toDateString() === d.toDateString();
    const endTime = e.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return sameDay
      ? `${date} · ${time} – ${endTime}`
      : `${date} ${time} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${endTime}`;
  }
  return `${date} · ${time}`;
}

function batchSuffix(batch?: number): string {
  if (batch == null) return "";
  const s = String(batch);
  return `'${s.slice(-2)}`;
}

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const event = useQuery(api.events.getEvent, {
    eventId: eventId as unknown as never,
  });
  const rsvp = useMutation(api.events.rsvp);

  if (event === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Loader2 className="mx-auto h-6 w-6 animate-spin ink-3" />
      </div>
    );
  }
  if (event === null) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <EmptyState
          icon={CalendarX}
          message="Event not found"
          description="The event may have been removed or the link is incorrect."
          cta={{ label: "Back to events", href: "/events" }}
        />
      </div>
    );
  }

  const e = event as unknown as EventDetail;

  const onRsvp = async (status: "yes" | "maybe" | "cancelled") => {
    try {
      const result = await rsvp({
        eventId: eventId as unknown as never,
        status,
      });
      if ((result as { status: string }).status === "waitlist") {
        toast.success("Event full — you're on the waitlist");
      } else if (status === "cancelled") {
        toast.success("RSVP cancelled");
      } else {
        toast.success("RSVP'd");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "RSVP failed");
    }
  };

  const isCancelled = e.cancelledAt != null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-[13px] ink-3 hover:ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to events
      </Link>

      <div className="mt-4">
        <span className="section-eyebrow inline-flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          {formatDateLine(e.startsAt, e.endsAt)}
        </span>
        <h1 className="font-serif text-[32px] font-semibold leading-tight mt-2">
          {e.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] ink-3 mt-3">
          {e.locationLabel && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {e.locationLabel}
            </span>
          )}
          {e.onlineUrl && (
            <a
              href={e.onlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 ink-2 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Online link
            </a>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {e.goingCount} going
          </span>
          {isCancelled && (
            <span className="auf-chip text-[10.5px] text-destructive">
              Cancelled
            </span>
          )}
        </div>
      </div>

      {!isCancelled && (
        <div className="mt-6 flex flex-wrap gap-2">
          {e.myRsvpStatus === "yes" || e.myRsvpStatus === "waitlist" ? (
            <>
              <span
                className={`auf-chip text-[11.5px] ${
                  e.myRsvpStatus === "waitlist"
                    ? "auf-chip-gold"
                    : "auf-chip-brand"
                }`}
              >
                {e.myRsvpStatus === "waitlist" ? "On waitlist" : "Going"}
              </span>
              <button
                type="button"
                className="auf-btn auf-btn-outline auf-btn-sm"
                onClick={() => onRsvp("cancelled")}
              >
                Cancel RSVP
              </button>
            </>
          ) : e.myRsvpStatus === "maybe" ? (
            <>
              <span className="auf-chip auf-chip-brand text-[11.5px]">
                Maybe
              </span>
              <button
                type="button"
                className="auf-btn auf-btn-primary auf-btn-sm"
                onClick={() => onRsvp("yes")}
              >
                Switch to Yes
              </button>
              <button
                type="button"
                className="auf-btn auf-btn-outline auf-btn-sm"
                onClick={() => onRsvp("cancelled")}
              >
                Cancel RSVP
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="auf-btn auf-btn-primary auf-btn-sm"
                onClick={() => onRsvp("yes")}
              >
                Yes
              </button>
              <button
                type="button"
                className="auf-btn auf-btn-outline auf-btn-sm"
                onClick={() => onRsvp("maybe")}
              >
                Maybe
              </button>
              {e.capacity != null && e.goingCount >= e.capacity && (
                <button
                  type="button"
                  className="auf-btn auf-btn-outline auf-btn-sm"
                  onClick={() => onRsvp("yes")}
                >
                  Join waitlist
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-6 auf-card p-6">
        <p className="text-[14.5px] ink whitespace-pre-line leading-relaxed">
          {e.description}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatCard label="Going" value={e.goingCount} />
        <StatCard label="Maybe" value={e.maybeCount} />
        <StatCard label="Waitlist" value={e.waitlistCount} />
      </div>

      <section className="mt-8">
        <h2 className="section-eyebrow">Attendees</h2>
        {e.attendees.length === 0 ? (
          <p className="text-[13px] ink-3 mt-3">
            No one has RSVP'd yet. Be the first.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {e.attendees.map((a, i) => (
              <li key={a.slug || i} className="auf-card p-3 flex items-center gap-3">
                <AUFAvatar
                  name={a.displayName}
                  size={36}
                  grad={(((i % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6)}
                />
                <div className="min-w-0 flex-1">
                  {a.slug ? (
                    <Link
                      href={`/profile/${a.slug}`}
                      className="font-medium text-[14px] hover:underline underline-offset-2 truncate block"
                    >
                      {a.displayName}
                    </Link>
                  ) : (
                    <span className="font-medium text-[14px] truncate block">
                      {a.displayName}
                    </span>
                  )}
                  {(a.program || a.batch != null) && (
                    <span className="text-[12px] ink-3 truncate block">
                      {a.program ?? ""}
                      {a.program && a.batch != null ? " · " : ""}
                      {batchSuffix(a.batch)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="auf-card p-4 text-center">
      <div className="font-serif text-[24px] font-semibold leading-none">
        {value}
      </div>
      <div className="section-eyebrow mt-2">{label}</div>
    </div>
  );
}
