"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  CalendarPlus,
  ExternalLink,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { EmptyState } from "@/components/auf/EmptyState";

type EventCategory = "reunion" | "webinar" | "meetup" | "other";

type EventRow = {
  _id: string;
  title: string;
  description: string;
  startsAt: number;
  endsAt?: number;
  category?: EventCategory;
  locationLabel?: string;
  onlineUrl?: string;
  capacity?: number;
  audienceMatch: boolean;
  goingCount: number;
  maybeCount: number;
  waitlistCount: number;
  myRsvpStatus: string | null;
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  reunion: "Reunion",
  webinar: "Webinar",
  meetup: "Meetup",
  other: "Other",
};

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as EventCategory[];

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

export default function EventsPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [category, setCategory] = useState<"all" | EventCategory>("all");
  const [query, setQuery] = useState("");

  const events = useQuery(api.events.listUpcoming, {
    scope: tab === "past" ? "past" : undefined,
    category: category === "all" ? undefined : category,
  });
  const rsvp = useMutation(api.events.rsvp);

  const all = (events ?? []) as EventRow[];
  const list = query.trim()
    ? all.filter((e) =>
        (e.title + " " + e.description + " " + (e.locationLabel ?? ""))
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : all;

  const onRsvp = async (
    eventId: string,
    status: "yes" | "maybe" | "cancelled",
  ) => {
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

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div>
        <h1 className="font-serif text-[28px] font-semibold leading-tight">
          Events
        </h1>
        <p className="text-[13px] ink-3 mt-1">
          Reunions, webinars, and meetups hosted by AUF for alumni.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`auf-chip text-[12px] transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab === t ? "auf-chip-brand" : "opacity-60 hover:opacity-100"
            }`}
          >
            {t === "upcoming" ? "Upcoming" : "Past"}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(["all", ...CATEGORY_OPTIONS] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`auf-chip text-[11.5px] transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              category === c ? "auf-chip-brand" : "opacity-60 hover:opacity-100"
            }`}
          >
            {c === "all" ? "All" : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="relative mt-3 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events…"
          className="auf-input pl-9"
        />
      </div>

      <div className="mt-6 space-y-3">
        {events === undefined ? (
          <div className="auf-card p-6 text-[13px] ink-3">Loading…</div>
        ) : list.length === 0 ? (
          query.trim() ? (
            <EmptyState
              icon={CalendarPlus}
              message="No events match your search"
              description="Try a different keyword or clear the search."
            />
          ) : category !== "all" ? (
            <EmptyState
              icon={CalendarPlus}
              message={
                tab === "past"
                  ? "No past events in this category"
                  : "No upcoming events in this category"
              }
              description="Try another category, or switch back to All to see everything."
            />
          ) : tab === "past" ? (
            <EmptyState
              icon={CalendarPlus}
              message="No past events yet"
              description="Once events wrap up, they'll be archived here."
            />
          ) : (
            <EmptyState
              icon={CalendarPlus}
              message="No upcoming events"
              description="Check back soon — AUF posts reunions, webinars, and meetups here."
            />
          )
        ) : (
          list.map((e) => (
            <EventRowCard
              key={e._id}
              event={e}
              isPast={tab === "past"}
              onRsvp={onRsvp}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EventRowCard({
  event,
  isPast,
  onRsvp,
}: {
  event: EventRow;
  isPast: boolean;
  onRsvp: (id: string, status: "yes" | "maybe" | "cancelled") => void;
}) {
  const d = new Date(event.startsAt);
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const statusLabel =
    event.myRsvpStatus === "yes"
      ? "Going"
      : event.myRsvpStatus === "maybe"
        ? "Maybe"
        : event.myRsvpStatus === "waitlist"
          ? "On waitlist"
          : null;

  return (
    <div className="auf-card p-5 flex gap-4">
      <div className="border auf-hairline rounded-md w-14 h-14 flex flex-col items-center justify-center shrink-0 bg-[var(--surface-2)]">
        <span className="section-eyebrow leading-none">{month}</span>
        <span className="font-serif text-[18px] font-semibold leading-none mt-1">
          {day}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/events/${event._id}`}
            className="font-medium text-[14.5px] hover:underline underline-offset-2"
          >
            {event.title}
          </Link>
          <div className="flex items-center gap-1.5 shrink-0">
            {event.category && (
              <span className="auf-chip text-[10.5px]">
                {CATEGORY_LABELS[event.category]}
              </span>
            )}
            {!event.audienceMatch && (
              <span className="auf-chip text-[10.5px] ink-3">
                Not your audience
              </span>
            )}
          </div>
        </div>
        <p className="text-[13px] ink-2 mt-1 line-clamp-2">
          {event.description}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] ink-3 mt-2">
          <span>{time}</span>
          {event.locationLabel && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {event.locationLabel}
            </span>
          )}
          {event.onlineUrl && (
            <a
              href={event.onlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 ink-2 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Online link
            </a>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {event.goingCount} going
          </span>
        </div>
        {!isPast && event.audienceMatch && (
          <div className="flex flex-wrap gap-2 pt-3">
            {statusLabel ? (
              <>
                <span
                  className={`auf-chip text-[11.5px] ${
                    event.myRsvpStatus === "waitlist"
                      ? "auf-chip-gold"
                      : "auf-chip-brand"
                  }`}
                >
                  {statusLabel}
                </span>
                <button
                  type="button"
                  className="auf-btn auf-btn-outline auf-btn-sm"
                  onClick={() => onRsvp(event._id, "cancelled")}
                >
                  Cancel RSVP
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="auf-btn auf-btn-primary auf-btn-sm"
                  onClick={() => onRsvp(event._id, "yes")}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="auf-btn auf-btn-outline auf-btn-sm"
                  onClick={() => onRsvp(event._id, "maybe")}
                >
                  Maybe
                </button>
                {event.capacity != null &&
                  event.goingCount >= event.capacity && (
                    <button
                      type="button"
                      className="auf-btn auf-btn-outline auf-btn-sm"
                      onClick={() => onRsvp(event._id, "yes")}
                    >
                      Join waitlist
                    </button>
                  )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

