"use client";

/**
 * Mentorship (Epic 14).
 *
 * Two tabs:
 *   Find a mentor — verified alumni open to mentorship (privacy-filtered,
 *     filterable by College → Program, batch and city), with a request dialog.
 *   My requests   — requests I've received as a mentor and ones I've sent.
 *
 * Mentors opt in from their profile ("Open to" → Mentorship).
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, Loader2, MessageCircle, Search, Sparkles, X } from "lucide-react";
import { api } from "@/lib/convex-api";
import { useCollegePrograms } from "@/lib/use-program-options";
import { useLookupOptions } from "@/lib/use-lookup-options";
import { useUrlFilters } from "@/lib/use-url-filters";
import { parseBatchInput } from "@/lib/batch-input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/auf/EmptyState";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";
import { AUFAvatar } from "@/components/auf/AUFAvatar";
import { cn } from "@/lib/utils";

type MentorshipRequest = {
  _id: string;
  requesterId: string;
  mentorId: string;
  topic: string;
  proposedTimes: string[];
  status: string;
  scheduledFor?: number;
  createdAt: number;
};

type MentorCard = {
  userId: string;
  slug: string;
  displayName: string;
  initials: string;
  program: string | null;
  college: string;
  batch: number | null;
  currentRole: string | null;
  company: string | null;
  city: string | null;
  bio: string | null;
  skills: string[];
  openTo: string[];
  photoUrl: string | null;
  myRequestStatus: string | null;
};

const FILTER_KEYS = ["q", "college", "program", "batch", "city"] as const;
type Tab = "find" | "requests";

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  declined: "Declined",
  completed: "Completed",
  countered: "Time proposed",
};

export default function MentorshipPage() {
  const [tab, setTab] = useState<Tab>("find");
  const data = useQuery(api.mentorship.myMentorshipQueue);

  const incoming = (data?.incoming ?? []) as MentorshipRequest[];
  const outgoing = (data?.outgoing ?? []) as MentorshipRequest[];
  const pendingIncoming = incoming.filter((r) => r.status === "requested").length;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Mentorship</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Brief, structured 30-minute sessions with alumni who volunteered to
        mentor. Propose a few times; they pick one or decline.
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Mentorship">
        {([
          { id: "find", label: "Find a mentor" },
          { id: "requests", label: `My requests${pendingIncoming ? ` (${pendingIncoming})` : ""}` },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              tab === t.id
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "find" ? (
        <FindMentors />
      ) : (
        <MyRequests data={data} incoming={incoming} outgoing={outgoing} onFind={() => setTab("find")} />
      )}
    </div>
  );
}

// ------------------------------------------------------------ find a mentor ---

function FindMentors() {
  const { values, set, setMany, reset, restored } = useUrlFilters("mentors", FILTER_KEYS);
  const taxonomy = useCollegePrograms();
  const areas = useLookupOptions("area");
  const batch = parseBatchInput(values.batch);
  const collegePrograms = values.college ? taxonomy.programsFor(values.college) : [];

  const programFilter = values.program
    ? [values.program]
    : values.college
      ? collegePrograms.length
        ? collegePrograms.map((p) => p.name)
        : ["(no programs in this college)"]
      : undefined;

  const mentors = useQuery(api.mentorship.availableMentors, {
    search: values.q || undefined,
    programs: programFilter,
    batches: batch.years ?? undefined,
    cities: values.city ? [values.city] : undefined,
  }) as MentorCard[] | undefined;

  const [requesting, setRequesting] = useState<MentorCard | null>(null);

  const fields: FilterField[] = [
    { type: "search", key: "q", label: "Search", placeholder: "Name, role, company, skill…" },
    {
      type: "select",
      key: "college",
      label: "College",
      allLabel: "All colleges",
      options: taxonomy.colleges.map((c) => ({ value: c.name, label: c.name })),
    },
    {
      type: "select",
      key: "program",
      label: "Program / degree",
      allLabel: values.college ? "All programs in this college" : "All programs",
      options: (values.college ? collegePrograms : taxonomy.programs).map((p) => ({
        value: p.name,
        label: p.name,
        group: values.college ? undefined : p.collegeName,
      })),
    },
    {
      type: "text",
      key: "batch",
      label: "Batch (year)",
      placeholder: "e.g. 2018 or 2012-2018",
      maxLength: 9,
      hint: batch.error ?? undefined,
    },
    {
      type: "select",
      key: "city",
      label: "City",
      allLabel: "All cities",
      options: areas.options.map((a) => ({ value: a.name, label: a.name, group: a.group })),
    },
  ];

  const onFilterChange = (key: string, value: string) => {
    if (key === "college") {
      const keep =
        values.program && value && taxonomy.collegeOfProgram(values.program) === value;
      setMany({ college: value, program: keep ? values.program : "" });
    } else if (key === "program" && value && !values.college) {
      setMany({ program: value, college: taxonomy.collegeOfProgram(value) ?? "" });
    } else {
      set(key as (typeof FILTER_KEYS)[number], value);
    }
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <FilterPanel
          fields={fields}
          values={values}
          onChange={onFilterChange}
          onReset={reset}
          restored={restored}
        />
      </aside>

      <section>
        {mentors === undefined ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Finding mentors…
          </div>
        ) : mentors.length === 0 ? (
          <EmptyState
            icon={Search}
            message="No mentors match these filters"
            description="Try a wider batch range or clear the filters. Mentors opt in from their profile under “Open to”."
            cta={{ label: "Clear filters", onClick: reset }}
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {mentors.length} alumn{mentors.length === 1 ? "us" : "i"} open to mentorship
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {mentors.map((m, i) => (
                <Card key={m.userId}>
                  <CardContent className="flex h-full flex-col p-4">
                    <div className="flex items-start gap-3">
                      <AUFAvatar
                        name={m.displayName}
                        src={m.photoUrl}
                        grad={((i % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6}
                        size={40}
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/profile/${m.slug}`}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {m.displayName}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.currentRole ?? "—"}
                          {m.company ? ` · ${m.company}` : ""}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {[m.program, m.batch ? `'${String(m.batch).slice(-2)}` : null, m.city]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                    {m.bio && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{m.bio}</p>
                    )}
                    {m.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.skills.slice(0, 4).map((s) => (
                          <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                            {s}
                          </span>
                        ))}
                        {m.skills.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{m.skills.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2 pt-1">
                      {m.myRequestStatus && m.myRequestStatus !== "declined" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                          <Check className="h-3 w-3" />
                          {STATUS_LABEL[m.myRequestStatus] ?? m.myRequestStatus}
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => setRequesting(m)}>
                          <Sparkles className="h-3.5 w-3.5" /> Request mentorship
                        </Button>
                      )}
                      <Link
                        href={`/profile/${m.slug}`}
                        className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                      >
                        View profile
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      <RequestDialog mentor={requesting} onClose={() => setRequesting(null)} />
    </div>
  );
}

function RequestDialog({ mentor, onClose }: { mentor: MentorCard | null; onClose: () => void }) {
  const requestMentorship = useMutation(api.mentorship.requestMentorship);
  const [topic, setTopic] = useState("");
  const [times, setTimes] = useState<string[]>(["", "", ""]);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setTopic("");
    setTimes(["", "", ""]);
    onClose();
  };

  const submit = async () => {
    const proposed = times.filter(Boolean);
    if (!topic.trim()) {
      toast.error("What would you like help with?");
      return;
    }
    if (proposed.length === 0) {
      toast.error("Propose at least one time");
      return;
    }
    setBusy(true);
    try {
      await requestMentorship({
        mentorId: mentor!.userId as never,
        topic: topic.trim(),
        proposedTimes: proposed,
      });
      toast.success(`Request sent to ${mentor!.displayName}`);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={mentor !== null} onOpenChange={(o) => !o && !busy && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request mentorship from {mentor?.displayName}</DialogTitle>
          <DialogDescription>
            A 30-minute session. Say what you need and propose up to three
            times — they pick one or decline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="mentor-topic">What would you like help with?</Label>
            <Textarea
              id="mentor-topic"
              rows={3}
              value={topic}
              maxLength={500}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Moving from support into a QA role — what to learn first."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Proposed times</Label>
            <div className="mt-1.5 space-y-2">
              {times.map((t, i) => (
                <Input
                  key={i}
                  type="datetime-local"
                  value={t}
                  aria-label={`Proposed time ${i + 1}`}
                  onChange={(e) =>
                    setTimes((cur) => cur.map((v, idx) => (idx === i ? e.target.value : v)))
                  }
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------- my requests ---

function MyRequests({
  data,
  incoming,
  outgoing,
  onFind,
}: {
  data: unknown;
  incoming: MentorshipRequest[];
  outgoing: MentorshipRequest[];
  onFind: () => void;
}) {
  const respond = useMutation(api.mentorship.respondToRequest);
  const markCompleted = useMutation(api.mentorship.markCompleted);
  const [busy, setBusy] = useState<string | null>(null);

  if (data === undefined) {
    return (
      <div className="py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="py-10">
        <EmptyState message="Sign in to view mentorship" cta={{ label: "Sign in", href: "/login" }} />
      </div>
    );
  }

  const onAccept = async (req: MentorshipRequest) => {
    const choice = window.prompt(
      `Pick a time to accept:\n${req.proposedTimes.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nType the number:`,
    );
    const idx = Number(choice) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= req.proposedTimes.length) return;
    setBusy(req._id);
    try {
      const parsed = Date.parse(req.proposedTimes[idx]);
      await respond({
        requestId: req._id as unknown as never,
        action: "accept",
        scheduledFor: Number.isNaN(parsed) ? req.createdAt : parsed,
      });
      toast.success("Mentorship accepted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const onDecline = async (req: MentorshipRequest) => {
    setBusy(req._id);
    try {
      await respond({ requestId: req._id as unknown as never, action: "decline" });
      toast.success("Declined");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const onComplete = async (req: MentorshipRequest) => {
    setBusy(req._id);
    try {
      await markCompleted({ requestId: req._id as unknown as never });
      toast.success("Marked complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <section className="mt-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Requests to you
        </h2>
        <div className="mt-3 space-y-3">
          {incoming.length === 0 ? (
            <EmptyState
              message="No incoming requests"
              description="When alumni request mentorship from you, requests appear here. Add “Mentorship” under Open to on your profile so alumni can find you."
              cta={{ label: "Edit your profile", href: "/profile/edit" }}
            />
          ) : (
            incoming.map((req) => (
              <Card key={req._id}>
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{req.topic}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Status: {STATUS_LABEL[req.status] ?? req.status}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {req.proposedTimes.length > 0 && (
                    <ul className="list-inside list-disc text-xs text-muted-foreground">
                      {req.proposedTimes.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {req.status === "requested" && (
                      <>
                        <Button size="sm" disabled={busy === req._id} onClick={() => onAccept(req)}>
                          <Check className="mr-1 h-3.5 w-3.5" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === req._id}
                          onClick={() => onDecline(req)}
                        >
                          <X className="mr-1 h-3.5 w-3.5" /> Decline
                        </Button>
                      </>
                    )}
                    {req.status === "scheduled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === req._id}
                        onClick={() => onComplete(req)}
                      >
                        Mark complete
                      </Button>
                    )}
                    <Link
                      href="/messages"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Messages
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Requests you sent
        </h2>
        <div className="mt-3 space-y-3">
          {outgoing.length === 0 ? (
            <EmptyState
              message="No outgoing requests"
              description="Browse alumni who are open to mentorship and send your first request."
              cta={{ label: "Find a mentor", onClick: onFind }}
            />
          ) : (
            outgoing.map((req) => (
              <Card key={req._id}>
                <CardContent className="space-y-1 p-5">
                  <p className="font-medium">{req.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    Status: {STATUS_LABEL[req.status] ?? req.status}
                    {req.scheduledFor && ` · ${new Date(req.scheduledFor).toLocaleString()}`}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </>
  );
}
