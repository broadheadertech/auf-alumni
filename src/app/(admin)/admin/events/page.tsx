"use client";

/**
 * Admin events — create an event and target who it's sent to.
 *
 * Audience targeting: Everyone (overall), By college, or By year graduated.
 * A live reach estimate updates as the audience is composed. Created events
 * are added to the local list (prototype — not persisted); the list is
 * filterable by status, audience type, and search.
 *
 * Mock-data prototype for stakeholder review. A Convex-backed publish form
 * (batch/program targeting) also lives at /admin/events/new.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarPlus,
  Globe,
  GraduationCap,
  MapPin,
  Search,
  Users,
  Video,
} from "lucide-react";
import {
  COLLEGES,
  EVENTS,
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABEL,
  GRAD_YEARS,
  audienceReach,
  describeAudience,
  fmtDateTime,
  isUpcoming,
  type AdminEvent,
  type AudienceKind,
  type College,
  type EventAudience,
  type EventCategory,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatTile } from "@/components/auf/AdminBits";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "upcoming" | "past";

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>(EVENTS);

  // list controls
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming");
  const [audienceFilter, setAudienceFilter] = useState<AudienceKind | "all">("all");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...events]
      .filter((e) =>
        statusFilter === "all"
          ? true
          : statusFilter === "upcoming"
            ? isUpcoming(e)
            : !isUpcoming(e),
      )
      .filter((e) =>
        audienceFilter === "all" ? true : e.audience.kind === audienceFilter,
      )
      .filter((e) =>
        q ? (e.title + " " + e.location).toLowerCase().includes(q) : true,
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [events, statusFilter, audienceFilter, search]);

  const totals = useMemo(
    () => ({
      total: events.length,
      upcoming: events.filter(isUpcoming).length,
      rsvps: events.reduce((s, e) => s + e.rsvpYes, 0),
    }),
    [events],
  );

  const handleCreate = (ev: AdminEvent) => {
    setEvents((cur) => [ev, ...cur]);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarPlus className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Create alumni events and target who they&apos;re sent to — everyone, by
        college, or by year graduated.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Total events" value={totals.total} />
        <StatTile label="Upcoming" value={totals.upcoming} />
        <StatTile label="Total RSVPs" value={totals.rsvps.toLocaleString()} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <CreateEventForm onCreate={handleCreate} />

        {/* List */}
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["upcoming", "past", "all"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
                    statusFilter === s
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
              <select
                value={audienceFilter}
                onChange={(e) =>
                  setAudienceFilter(e.target.value as AudienceKind | "all")
                }
                className="ml-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="all">Any audience</option>
                <option value="everyone">Everyone</option>
                <option value="college">By college</option>
                <option value="batch">By year</option>
              </select>
            </div>
            <div className="relative sm:w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search events…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {visible.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  No events match these filters.
                </CardContent>
              </Card>
            ) : (
              visible.map((e) => <EventRow key={e.id} event={e} />)
            )}
          </div>

          <p className="mt-3 text-xs italic text-muted-foreground">
            Showing {visible.length} of {events.length} events · demo data.
            Looking for the Convex publish form?{" "}
            <Link href="/admin/events/new" className="underline">
              Advanced form
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- create ---

function CreateEventForm({ onCreate }: { onCreate: (e: AdminEvent) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<EventCategory>("reunion");
  const [capacity, setCapacity] = useState("");

  const [audienceKind, setAudienceKind] = useState<AudienceKind>("everyone");
  const [colleges, setColleges] = useState<College[]>([]);
  const [batches, setBatches] = useState<number[]>([]);
  const createdSeq = useRef(0);

  const audience: EventAudience =
    audienceKind === "everyone"
      ? { kind: "everyone" }
      : audienceKind === "college"
        ? { kind: "college", colleges }
        : { kind: "batch", batches };

  const reach = audienceReach(audience);
  const audienceIncomplete =
    (audienceKind === "college" && colleges.length === 0) ||
    (audienceKind === "batch" && batches.length === 0);

  const toggle = <T,>(arr: T[], v: T, set: (a: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setStartsAt("");
    setLocation("");
    setCategory("reunion");
    setCapacity("");
    setAudienceKind("everyone");
    setColleges([]);
    setBatches([]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !startsAt) {
      toast.error("Title, description, and start time are required");
      return;
    }
    if (audienceIncomplete) {
      toast.error("Pick at least one college or year, or choose Everyone");
      return;
    }
    const event: AdminEvent = {
      id: `evt-new-${createdSeq.current++}`,
      title: title.trim(),
      description: description.trim(),
      category,
      startsAt,
      location: location.trim() || "TBA",
      onlineUrl: null,
      capacity: capacity ? Number(capacity) : null,
      audience,
      rsvpYes: 0,
      rsvpMaybe: 0,
      createdAt: "2026-06-28",
    };
    onCreate(event);
    toast.success(
      `Event created — sending to ~${reach.toLocaleString()} alumni (${describeAudience(audience)})`,
    );
    reset();
  };

  const AUDIENCE_OPTIONS: { kind: AudienceKind; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { kind: "everyone", label: "Everyone", Icon: Globe },
    { kind: "college", label: "By college", Icon: Users },
    { kind: "batch", label: "By year", Icon: GraduationCap },
  ];

  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <CardContent className="p-5">
        <h2 className="text-sm font-medium">Create event</h2>
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div>
            <Label htmlFor="ev-title" className="text-xs">Title</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="AUF Grand Homecoming 2026"
            />
          </div>
          <div>
            <Label htmlFor="ev-desc" className="text-xs">Description</Label>
            <Textarea
              id="ev-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ev-start" className="text-xs">Starts at</Label>
              <Input
                id="ev-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ev-cap" className="text-xs">Capacity</Label>
              <Input
                id="ev-cap"
                type="number"
                min={1}
                value={capacity}
                placeholder="optional"
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ev-loc" className="text-xs">Location</Label>
            <Input
              id="ev-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="AUF Gymnasium / Online"
            />
          </div>
          <div>
            <Label htmlFor="ev-cat" className="text-xs">Category</Label>
            <select
              id="ev-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as EventCategory)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              {EVENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Audience targeting */}
          <fieldset className="rounded-md border border-border p-3">
            <legend className="px-1 text-xs uppercase tracking-wide text-muted-foreground">
              Send to
            </legend>
            <div className="grid grid-cols-3 gap-1.5">
              {AUDIENCE_OPTIONS.map(({ kind, label, Icon }) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setAudienceKind(kind)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs transition-colors",
                    audienceKind === kind
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {audienceKind === "college" && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {COLLEGES.map((c) => {
                  const on = colleges.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggle(colleges, c, setColleges as (a: College[]) => void)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c.replace("College of ", "")}
                    </button>
                  );
                })}
              </div>
            )}

            {audienceKind === "batch" && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {GRAD_YEARS.map((y) => {
                  const on = batches.includes(y);
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => toggle(batches, y, setBatches as (a: number[]) => void)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs tabular-nums transition-colors",
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Reach preview */}
            <div className="mt-3 flex items-center justify-between rounded-md bg-muted/60 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {describeAudience(audience)}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {audienceIncomplete ? "—" : `~${reach.toLocaleString()}`}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  alumni
                </span>
              </span>
            </div>
          </fieldset>

          <Button type="submit" className="w-full">
            Create &amp; send
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- list row ---

function EventRow({ event }: { event: AdminEvent }) {
  const upcoming = isUpcoming(event);
  const reach = audienceReach(event.audience);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{event.title}</h3>
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {EVENT_CATEGORY_LABEL[event.category]}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px]",
                  upcoming
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {upcoming ? "Upcoming" : "Past"}
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
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">
              {event.rsvpYes.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground"> going</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {event.rsvpMaybe} maybe
              {event.capacity ? ` · cap ${event.capacity}` : ""}
            </div>
          </div>
        </div>

        {/* Audience badge */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-700 dark:text-sky-300">
            {event.audience.kind === "everyone" ? (
              <Globe className="h-3 w-3" />
            ) : event.audience.kind === "college" ? (
              <Users className="h-3 w-3" />
            ) : (
              <GraduationCap className="h-3 w-3" />
            )}
            {describeAudience(event.audience)}
          </span>
          {event.audience.kind === "college" && (
            <span className="text-muted-foreground">
              {event.audience.colleges
                .map((c) => c.replace("College of ", ""))
                .join(", ")}
            </span>
          )}
          {event.audience.kind === "batch" && (
            <span className="text-muted-foreground tabular-nums">
              {event.audience.batches.join(", ")}
            </span>
          )}
          <span className="ml-auto text-muted-foreground">
            Reach ~{reach.toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
