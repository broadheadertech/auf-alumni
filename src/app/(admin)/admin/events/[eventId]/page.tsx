"use client";

/**
 * Admin event detail — event info, attendance analytics (going / maybe /
 * declined / no-response), invitation analytics (emails sent vs responded),
 * and a real "send invitation" email (Resend) with one-tap RSVP buttons.
 */

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAction } from "convex/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  HelpCircle,
  Mail,
  MapPin,
  Send,
  Users2,
  Video,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import {
  EVENT_CATEGORY_LABEL,
  describeAudience,
  eventStats,
  fmtDate,
  fmtDateTime,
  getEventById,
  isUpcoming,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/auf/EmptyState";
import { StatTile } from "@/components/auf/AdminBits";
import { cn } from "@/lib/utils";

export default function AdminEventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const event = getEventById(params.eventId);
  const sendInvite = useAction(api.actions.sendEventInvite.sendEventInvite);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          message="Event not found"
          description="Newly-created demo events aren't saved. Open a seeded event from the list."
          cta={{ label: "Back to events", href: "/admin/events" }}
        />
      </div>
    );
  }

  const s = eventStats(event);
  const upcoming = isUpcoming(event);

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
    { key: "going", label: "Going", value: s.going, cls: "bg-emerald-500" },
    { key: "maybe", label: "Maybe", value: s.maybe, cls: "bg-amber-500" },
    { key: "declined", label: "Declined", value: s.declined, cls: "bg-rose-500" },
    { key: "noResponse", label: "No response", value: s.noResponse, cls: "bg-muted-foreground/30" },
  ];
  const totalForBar = Math.max(1, s.emailsSent);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Events
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
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
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {event.description}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
          {describeAudience(event.audience)} · reach ~{s.reach.toLocaleString()}
        </span>
      </div>

      {/* Summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Invites sent" value={s.emailsSent.toLocaleString()} />
        <StatTile
          label="Responded"
          value={`${(s.responseRate * 100).toFixed(0)}%`}
          hint={`${s.responded.toLocaleString()} of ${s.emailsSent.toLocaleString()}`}
        />
        <StatTile label="Going" value={s.going.toLocaleString()} />
        <StatTile
          label="Maybe"
          value={s.maybe.toLocaleString()}
          hint={event.capacity ? `cap ${event.capacity}` : undefined}
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
              <Legend Icon={CheckCircle2} label="Going" value={s.going} cls="text-emerald-600 dark:text-emerald-400" />
              <Legend Icon={HelpCircle} label="Maybe" value={s.maybe} cls="text-amber-600 dark:text-amber-400" />
              <Legend Icon={XCircle} label="Declined" value={s.declined} cls="text-rose-600 dark:text-rose-400" />
              <Legend Icon={Mail} label="No response" value={s.noResponse} cls="text-muted-foreground" />
            </div>
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              Response rate{" "}
              <span className="font-medium text-foreground">
                {(s.responseRate * 100).toFixed(0)}%
              </span>{" "}
              · {s.responded.toLocaleString()} of {s.emailsSent.toLocaleString()}{" "}
              invited alumni replied.
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
              <Row label="Audience" value={describeAudience(event.audience)} />
              <Row label="Capacity" value={event.capacity ? String(event.capacity) : "Unlimited"} />
              <Row label="Created" value={fmtDate(event.createdAt)} />
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
            In production this goes to all ~{s.reach.toLocaleString()} targeted
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
    </div>
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
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
