"use client";

/**
 * Admin event detail — live (Convex `api.adminData.event`).
 *
 * Event info, attendance analytics from real RSVPs (going / maybe / waitlist /
 * cancelled / no response against the audience reach), and a real "send
 * invitation" email (Resend) with one-tap RSVP buttons.
 *
 * Reach = verified alumni the event's batch/program audience matches right
 * now. Response rate = everyone who RSVP'd in any state ÷ reach.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Mail,
  MapPin,
  Send,
  Users2,
  Video,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { useAsOf } from "@/lib/use-as-of";
import type { EventView } from "../../../../../../convex/adminData";
import { fmtDate, fmtDateTime } from "@/lib/mock-admin";
import {
  audienceBatches,
  audiencePrograms,
  describeAudience,
  eventCategoryLabel,
} from "@/lib/admin-event-format";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/auf/EmptyState";
import { StatTile } from "@/components/auf/AdminBits";
import { cn } from "@/lib/utils";
import {
  DetailPage,
} from "@/components/auf/admin-ui";

export default function AdminEventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const asOf = useAsOf();
  const event = useQuery(api.adminData.event, { id: params.eventId, asOf }) as
    | EventView
    | null
    | undefined;
  const sendInvite = useAction(api.actions.sendEventInvite.sendEventInvite);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  if (event === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          message="Event not found"
          description="This event doesn't exist or was removed. Open an event from the list."
          cta={{ label: "Back to events", href: "/admin/events" }}
        />
      </div>
    );
  }

  const going = event.rsvpYes;
  const maybe = event.rsvpMaybe;
  const waitlist = event.rsvpWaitlist;
  const cancelled = event.rsvpCancelled;
  const responded = going + maybe + waitlist + cancelled;
  const reach = event.reach;
  const noResponse = Math.max(0, reach - responded);
  const responseRate = reach ? responded / reach : 0;
  const batches = audienceBatches(event.audience);
  const programs = audiencePrograms(event.audience);

  const onSend = async () => {
    if (!email.trim()) {
      toast.error("Recipient email is required");
      return;
    }
    setSending(true);
    try {
      await sendInvite({
        to: email.trim(),
        eventId: event.id,
        eventTitle: event.title,
        eventWhen: fmtDateTime(event.startsAt),
        eventLocation: event.location,
        eventDescription: event.description,
      });
      toast.success(`Invitation sent to ${email.trim()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const segments = [
    { key: "going", label: "Going", value: going, cls: "bg-emerald-500" },
    { key: "maybe", label: "Maybe", value: maybe, cls: "bg-amber-500" },
    { key: "waitlist", label: "Waitlist", value: waitlist, cls: "bg-sky-500" },
    { key: "cancelled", label: "Cancelled", value: cancelled, cls: "bg-rose-500" },
    { key: "noResponse", label: "No response", value: noResponse, cls: "bg-muted-foreground/30" },
  ];
  const totalForBar = Math.max(1, reach, responded);

  return (
    <DetailPage
      backHref="/admin/events"
      backLabel="Events"
      title={event.title}
      badges={
        <>
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
          {event.cancelled ? "Cancelled" : event.upcoming ? "Upcoming" : "Past"}
        </span>
        </>
      }
      subtitle={event.description}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" />
          {fmtDateTime(event.startsAt)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {event.onlineUrl ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
          {event.location}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users2 className="h-4 w-4" />
          {describeAudience(event.audience)} · reach {reach.toLocaleString()}
        </span>
      </div>

      {/* Summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Audience reach"
          value={reach.toLocaleString()}
          hint="Verified alumni matching the audience"
        />
        <StatTile
          label="Responded"
          value={reach ? `${(responseRate * 100).toFixed(0)}%` : "—"}
          hint={`${responded.toLocaleString()} of ${reach.toLocaleString()}`}
        />
        <StatTile
          label="Going"
          value={going.toLocaleString()}
          hint={event.capacity ? `cap ${event.capacity}` : undefined}
        />
        <StatTile
          label="Maybe"
          value={maybe.toLocaleString()}
          hint={waitlist ? `${waitlist} on waitlist` : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Attendance analytics */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium">Attendance</h2>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {segments.map((seg) => (
                <div
                  key={seg.key}
                  className={seg.cls}
                  style={{ width: `${(seg.value / totalForBar) * 100}%` }}
                  title={`${seg.label}: ${seg.value}`}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Legend Icon={CheckCircle2} label="Going" value={going} cls="text-emerald-600 dark:text-emerald-400" />
              <Legend Icon={HelpCircle} label="Maybe" value={maybe} cls="text-amber-600 dark:text-amber-400" />
              <Legend Icon={Clock} label="Waitlist" value={waitlist} cls="text-sky-600 dark:text-sky-400" />
              <Legend Icon={XCircle} label="Cancelled" value={cancelled} cls="text-rose-600 dark:text-rose-400" />
              <Legend Icon={Mail} label="No response" value={noResponse} cls="text-muted-foreground" />
            </div>
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              Response rate{" "}
              <span className="font-medium text-foreground">
                {reach ? `${(responseRate * 100).toFixed(0)}%` : "—"}
              </span>{" "}
              · {responded.toLocaleString()} RSVP{responded === 1 ? "" : "s"} against a
              reach of {reach.toLocaleString()} verified alumni.
            </p>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium">Details</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <Row label="When" value={fmtDateTime(event.startsAt)} />
              <Row label="Where" value={event.location} />
              {event.onlineUrl && <Row label="Online link" value={event.onlineUrl} />}
              <Row label="Audience" value={describeAudience(event.audience)} />
              {batches.length > 0 && (
                <Row label="Batches" value={[...batches].sort((a, b) => a - b).join(", ")} />
              )}
              {programs.length > 0 && <Row label="Programs" value={programs.join(", ")} />}
              <Row label="Capacity" value={event.capacity ? String(event.capacity) : "Unlimited"} />
              <Row label="Published" value={fmtDate(event.createdAt)} />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Send invitations */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Send invitation</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Emails the event details with one-tap <strong>“Yes, I will
            attend”</strong> / Maybe / Can&apos;t-make-it buttons (via Resend).
            In production this goes to the {reach.toLocaleString()} targeted
            alumni; here, send a test to any address.
          </p>
          <div className="mt-2 flex max-w-md gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@email.com"
              className="text-sm"
            />
            <Button onClick={onSend} disabled={sending}>
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : "Send test"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </DetailPage>
  );
}

function Legend({
  Icon,
  label,
  value,
  cls,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className={cn("h-3.5 w-3.5", cls)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
    </div>
  );
}
