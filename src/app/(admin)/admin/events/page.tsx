"use client";

/**
 * Admin events — live list of every published event (Convex).
 *
 * Reads `api.adminData.events`, so reach (verified alumni the batch/program
 * audience matches right now) and RSVP counts come from the same `events`,
 * `rsvps` and `profiles` tables as the dashboard. New events are published via
 * the Convex form at /admin/events/new.
 *
 * Standard FilterPanel (search, status, category, audience type, audience
 * college → program, audience year, format, event date range; URL-backed and
 * persisted).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarPlus,
  ChevronRight,
  Globe,
  GraduationCap,
  Loader2,
  MapPin,
  Plus,
  Users,
  Video,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { useAsOf } from "@/lib/use-as-of";
import type { EventView } from "../../../../../convex/adminData";
import { fmtDateTime } from "@/lib/mock-admin";
import {
  LIVE_EVENT_CATEGORIES,
  audienceBatches,
  audiencePrograms,
  describeAudience,
  eventCategoryLabel,
} from "@/lib/admin-event-format";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatTile } from "@/components/auf/AdminBits";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";
import { useUrlFilters } from "@/lib/use-url-filters";
import { useCollegePrograms } from "@/lib/use-program-options";
import { parseBatchInput } from "@/lib/batch-input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FILTER_KEYS = [
  "q",
  "timing",
  "category",
  "audience",
  "college",
  "program",
  "batch",
  "format",
  "from",
  "to",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export default function AdminEventsPage() {
  const asOf = useAsOf();
  const liveEvents = useQuery(api.adminData.events, { asOf }) as EventView[] | undefined;
  const events = useMemo(() => liveEvents ?? [], [liveEvents]);

  const { values, set, setMany, reset, restored } = useUrlFilters("admin-events", FILTER_KEYS);
  const taxonomy = useCollegePrograms();
  const batch = parseBatchInput(values.batch);

  // Small lists — computed per render (taxonomy helpers are rebuilt each render).
  const q = values.q.trim().toLowerCase();
  const years = batch.years;
  const visible = events
      .filter((e) =>
        !values.timing
          ? true
          : values.timing === "upcoming"
            ? e.upcoming
            : values.timing === "cancelled"
              ? e.cancelled
              : !e.upcoming && !e.cancelled,
      )
      .filter((e) => !values.category || e.category === values.category)
      .filter((e) => !values.audience || e.audience.kind === values.audience)
      .filter(
        (e) =>
          !values.college ||
          audiencePrograms(e.audience).some(
            (p) => taxonomy.collegeOfProgram(p) === values.college,
          ),
      )
      .filter((e) => !values.program || audiencePrograms(e.audience).includes(values.program))
      .filter((e) => !years || audienceBatches(e.audience).some((b) => years.includes(b)))
      .filter((e) =>
        !values.format
          ? true
          : values.format === "online"
            ? !!e.onlineUrl
            : !e.onlineUrl,
      )
      .filter((e) => (values.from ? e.startsAt.slice(0, 10) >= values.from : true))
      .filter((e) => (values.to ? e.startsAt.slice(0, 10) <= values.to : true))
      .filter((e) =>
        q ? (e.title + " " + e.location).toLowerCase().includes(q) : true,
      )
      .sort((a, b) => a.startsAtMs - b.startsAtMs);

  // Audience program: taxonomy programs (under the chosen college), then any
  // program an event targets that the taxonomy doesn't list.
  const knownPrograms = new Set(taxonomy.programs.map((p) => p.name));
  const extraPrograms = values.college
    ? []
    : Array.from(new Set(events.flatMap((e) => audiencePrograms(e.audience))))
        .filter((p) => !knownPrograms.has(p))
        .sort();
  const programOptions = [
    ...taxonomy.programsFor(values.college).map((p) => ({
      value: p.name,
      label: p.name,
      group: values.college ? undefined : p.collegeName,
    })),
    ...extraPrograms.map((p) => ({ value: p, label: p, group: "Other" })),
  ];

  const fields: FilterField[] = [
    { type: "search", key: "q", label: "Search", placeholder: "Title or location…" },
    {
      type: "select",
      key: "timing",
      label: "Status",
      allLabel: "All events",
      options: [
        { value: "upcoming", label: "Upcoming" },
        { value: "past", label: "Past" },
        { value: "cancelled", label: "Cancelled" },
      ],
    },
    {
      type: "select",
      key: "category",
      label: "Category",
      allLabel: "All categories",
      options: LIVE_EVENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
    },
    {
      type: "select",
      key: "audience",
      label: "Audience",
      allLabel: "Any audience",
      options: [
        { value: "everyone", label: "Everyone" },
        { value: "batch", label: "By year" },
        { value: "program", label: "By program" },
        { value: "batch-program", label: "By year + program" },
      ] satisfies { value: EventView["audience"]["kind"]; label: string }[],
    },
    {
      type: "select",
      key: "college",
      label: "Audience college",
      allLabel: "Any college",
      options: taxonomy.colleges.map((c) => ({ value: c.name, label: c.name })),
      hint: values.college ? "Events targeting a program in this college." : undefined,
    },
    {
      type: "select",
      key: "program",
      label: "Audience program",
      allLabel: values.college ? "Any program in this college" : "Any program",
      options: programOptions,
      hint: values.program ? "Events targeted to this program." : undefined,
    },
    {
      type: "text",
      key: "batch",
      label: "Audience year",
      placeholder: "e.g. 2021 or 2018-2022",
      maxLength: 9,
      hint: batch.error ?? (batch.years ? "Events targeted to these graduating years." : undefined),
    },
    {
      type: "select",
      key: "format",
      label: "Format",
      allLabel: "In person and online",
      options: [
        { value: "in-person", label: "In person" },
        { value: "online", label: "Online" },
      ],
    },
    { type: "date", key: "from", label: "Event date from", max: values.to },
    { type: "date", key: "to", label: "Event date to", min: values.from },
  ];

  const onFilterChange = (key: string, value: string) => {
    if (key === "college") {
      const keep =
        values.program && value && taxonomy.collegeOfProgram(values.program) === value;
      setMany({ college: value, program: keep ? values.program : "" });
    } else if (key === "program" && value && !values.college) {
      setMany({ program: value, college: taxonomy.collegeOfProgram(value) ?? "" });
    } else {
      set(key as FilterKey, value);
    }
  };

  const totals = useMemo(
    () => ({
      total: events.length,
      upcoming: events.filter((e) => e.upcoming).length,
      going: events.reduce((s, e) => s + e.rsvpYes, 0),
      upcomingGoing: events.filter((e) => e.upcoming).reduce((s, e) => s + e.rsvpYes, 0),
    }),
    [events],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Alumni events and who they&apos;re sent to — everyone, by year
            graduated, or by program.
          </p>
        </div>
        <Link href="/admin/events/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" />
          Create event
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Total events" value={liveEvents ? totals.total : "—"} />
        <StatTile label="Upcoming" value={liveEvents ? totals.upcoming : "—"} />
        <StatTile
          label="Going RSVPs"
          value={liveEvents ? totals.going.toLocaleString() : "—"}
          hint={liveEvents ? `${totals.upcomingGoing.toLocaleString()} for upcoming events` : undefined}
        />
      </div>

      {/* Filters */}
      <FilterPanel
        layout="bar"
        className="mt-6"
        fields={fields}
        values={values}
        onChange={onFilterChange}
        onReset={reset}
        restored={restored}
      />

      <div className="mt-4 space-y-3">
        {liveEvents === undefined ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              {events.length === 0 ? (
                <>
                  No events yet.{" "}
                  <Link
                    href="/admin/events/new"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Publish the first one
                  </Link>
                </>
              ) : (
                <>
                  No events match these filters.{" "}
                  <button
                    type="button"
                    onClick={reset}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Reset filters
                  </button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          visible.map((e) => <EventRow key={e.id} event={e} />)
        )}
      </div>

      {liveEvents !== undefined && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {visible.length} of {events.length} events. Reach counts
          verified alumni matching each audience today.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- list row ---

function EventRow({ event }: { event: EventView }) {
  const batches = audienceBatches(event.audience);
  const programs = audiencePrograms(event.audience);
  const status = event.cancelled ? "Cancelled" : event.upcoming ? "Upcoming" : "Past";
  const setPublic = useMutation(api.events.setEventPublic);
  const [busy, setBusy] = useState(false);

  // The row is a link to the event, so the toggle has to stop the click from
  // navigating before it can do anything.
  const onToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const next = !event.isPublic;
      await setPublic({ eventId: event.id as never, isPublic: next });
      toast.success(
        next
          ? "Now listed on the public home page"
          : "No longer shown to visitors",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change visibility");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Link href={`/admin/events/${event.id}`} className="group block">
      <Card className="transition-shadow group-hover:ring-foreground/25">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium group-hover:underline">{event.title}</h3>
                <button
                  type="button"
                  onClick={onToggle}
                  disabled={busy}
                  title={
                    event.isPublic
                      ? "Visible to logged-out visitors on the home page"
                      : "Alumni only — not shown to visitors"
                  }
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] transition",
                    event.isPublic
                      ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:bg-muted",
                    busy && "opacity-50",
                  )}
                >
                  {event.isPublic ? "Public" : "Alumni only"}
                </button>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {eventCategoryLabel(event.category)}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px]",
                    event.cancelled
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : event.upcoming
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {status}
                </span>
              </div>
              <p className="mt-1 line-clamp-1 max-w-2xl text-xs text-muted-foreground">
                {event.description}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarPlus className="h-3.5 w-3.5" />
                  {fmtDateTime(event.startsAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  {event.onlineUrl ? (
                    <Video className="h-3.5 w-3.5" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5" />
                  )}
                  {event.location}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">
                  {event.rsvpYes.toLocaleString()}
                  <span className="text-xs font-normal text-muted-foreground"> going</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {event.rsvpMaybe} maybe
                  {event.rsvpWaitlist ? ` · ${event.rsvpWaitlist} waitlist` : ""}
                  {event.capacity ? ` · cap ${event.capacity}` : ""}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </div>

          {/* Audience badge */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-700 dark:text-sky-300">
              {event.audience.kind === "everyone" ? (
                <Globe className="h-3 w-3" />
              ) : event.audience.kind === "batch" ? (
                <GraduationCap className="h-3 w-3" />
              ) : (
                <Users className="h-3 w-3" />
              )}
              {describeAudience(event.audience)}
            </span>
            {programs.length > 1 && (
              <span className="text-muted-foreground">{programs.join(", ")}</span>
            )}
            {batches.length > 1 && (
              <span className="text-muted-foreground tabular-nums">
                {[...batches].sort((a, b) => a - b).join(", ")}
              </span>
            )}
            <span className="ml-auto text-muted-foreground">
              Reach {event.reach.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
