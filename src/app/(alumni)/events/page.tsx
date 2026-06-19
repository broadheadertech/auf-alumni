"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  CalendarPlus,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
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

function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  locationLabel: "",
  onlineUrl: "",
  capacity: "",
};

export default function EventsPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [category, setCategory] = useState<"all" | EventCategory>("all");

  const events = useQuery(api.events.listUpcoming, {
    scope: tab === "past" ? "past" : undefined,
    category: category === "all" ? undefined : category,
  });
  const rsvp = useMutation(api.events.rsvp);
  const createEvent = useMutation(api.events.createEvent);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const list = (events ?? []) as EventRow[];

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.startsAt) {
      toast.error("Title, description, and start time are required");
      return;
    }
    const startsAtMs = new Date(form.startsAt).getTime();
    if (Number.isNaN(startsAtMs)) {
      toast.error("Invalid start time");
      return;
    }
    const endsAtMs = form.endsAt ? new Date(form.endsAt).getTime() : undefined;
    if (endsAtMs != null && Number.isNaN(endsAtMs)) {
      toast.error("Invalid end time");
      return;
    }
    setSubmitting(true);
    try {
      await createEvent({
        title: form.title.trim(),
        description: form.description.trim(),
        startsAt: startsAtMs,
        endsAt: endsAtMs,
        locationLabel: form.locationLabel.trim() || undefined,
        onlineUrl: form.onlineUrl.trim() || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      });
      toast.success("Event created");
      setForm(EMPTY_FORM);
      setDialogOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create event",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[28px] font-semibold leading-tight">
            Events
          </h1>
          <p className="text-[13px] ink-3 mt-1">
            Upcoming reunions, webinars, and meetups for AUF alumni.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="auf-btn auf-btn-primary"
        >
          <Plus size={14} /> Create event
        </button>
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

      <div className="mt-6 space-y-3">
        {events === undefined ? (
          <div className="auf-card p-6 text-[13px] ink-3">Loading…</div>
        ) : list.length === 0 ? (
          category !== "all" ? (
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
              description="Be the first to share a reunion, webinar, or meetup with fellow alumni."
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

      {dialogOpen && (
        <CreateEventDialog
          form={form}
          setForm={setForm}
          onSubmit={onSubmit}
          submitting={submitting}
          onClose={() => setDialogOpen(false)}
        />
      )}
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

function CreateEventDialog({
  form,
  setForm,
  onSubmit,
  submitting,
  onClose,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  onClose: () => void;
}) {
  const minStart = toLocalInputValue(Date.now() + 60 * 60 * 1000);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="auf-card w-full max-w-[560px] max-h-[90vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-[20px] font-semibold">
          Create an event
        </h2>
        <p className="text-[13px] ink-3 mt-1">
          Share a reunion, webinar, or meetup with the alumni community.
        </p>
        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <Field label="Title">
            <input
              required
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
              placeholder="Batch 2018 reunion brunch"
              className="auf-input"
            />
          </Field>
          <Field label="Description">
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="What's the event about, who should come, and what to expect."
              className="auf-input resize-none"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Starts at">
              <input
                required
                type="datetime-local"
                min={minStart}
                value={form.startsAt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, startsAt: e.target.value }))
                }
                className="auf-input"
              />
            </Field>
            <Field label="Ends at (optional)">
              <input
                type="datetime-local"
                min={form.startsAt || minStart}
                value={form.endsAt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, endsAt: e.target.value }))
                }
                className="auf-input"
              />
            </Field>
          </div>
          <Field label="Location (optional)">
            <input
              value={form.locationLabel}
              onChange={(e) =>
                setForm((p) => ({ ...p, locationLabel: e.target.value }))
              }
              placeholder="AUF Main Campus · Angeles City"
              className="auf-input"
            />
          </Field>
          <Field label="Online URL (optional)">
            <input
              type="url"
              value={form.onlineUrl}
              onChange={(e) =>
                setForm((p) => ({ ...p, onlineUrl: e.target.value }))
              }
              placeholder="https://meet.google.com/…"
              className="auf-input"
            />
          </Field>
          <Field label="Capacity (optional)">
            <input
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) =>
                setForm((p) => ({ ...p, capacity: e.target.value }))
              }
              placeholder="50"
              className="auf-input"
            />
          </Field>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="auf-btn auf-btn-outline justify-center"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="auf-btn auf-btn-primary justify-center"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Plus size={14} /> Create event
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium ink-2 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
