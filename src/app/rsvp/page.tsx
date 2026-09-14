"use client";

/**
 * Public RSVP confirmation — reached from the event invitation email's
 * one-tap buttons (?e=<eventId>&r=yes|maybe|no). No login required.
 *
 * Prototype: shows a confirmation (and the event when known). Production would
 * record the RSVP against the alumna via a signed token in the link.
 */

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { CalendarCheck, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { api } from "@/lib/convex-api";

function fmtEventTime(ms: number): string {
  return new Date(ms).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

const RESPONSES = {
  yes: { label: "Going", Icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400", verb: "You're marked as attending" },
  maybe: { label: "Maybe", Icon: HelpCircle, tone: "text-amber-600 dark:text-amber-400", verb: "You're marked as a maybe" },
  no: { label: "Not attending", Icon: XCircle, tone: "text-muted-foreground", verb: "Thanks for letting us know" },
} as const;

export default function RsvpPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const eventId = sp.get("e") ?? "";
  const rParam = sp.get("r") ?? "";
  const r = (["yes", "maybe", "no"].includes(rParam) ? rParam : "yes") as
    | "yes"
    | "maybe"
    | "no";
  const event = useQuery(api.events.getEventPublic, eventId ? { id: eventId } : "skip");
  const resp = RESPONSES[r];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f3ee] px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">
            AUF
          </span>
          <span className="text-sm font-semibold">Alumni events</span>
        </div>

        <resp.Icon className={`mx-auto h-11 w-11 ${resp.tone}`} />
        <h1 className="mt-3 text-lg font-semibold">RSVP recorded — {resp.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{resp.verb}.</p>

        {event && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-left">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              {event.title}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {fmtEventTime(event.startsAt)}
              {event.location ? ` · ${event.location}` : ""}
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          You can change your response anytime from the AUF Alumni app.
        </p>
        <Link
          href="/events"
          className="mt-3 inline-block text-sm text-primary hover:underline"
        >
          View all events →
        </Link>
      </div>
    </div>
  );
}
