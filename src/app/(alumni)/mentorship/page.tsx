"use client";

/**
 * Mentorship queue (Epic 14).
 *
 * Two stacks: requests I've received (as a mentor) and requests I've sent.
 * Plan accepts a quiet UI in v1 — accept/decline/counter happens here,
 * scheduling-by-link is a Phase-3.5 follow-up.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/auf/EmptyState";

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

export default function MentorshipPage() {
  const data = useQuery(api.mentorship.myMentorshipQueue);
  const respond = useMutation(api.mentorship.respondToRequest);
  const markCompleted = useMutation(api.mentorship.markCompleted);
  const [busy, setBusy] = useState<string | null>(null);

  if (data === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <EmptyState
          message="Sign in to view mentorship"
          cta={{ label: "Sign in", href: "/login" }}
        />
      </div>
    );
  }

  const incoming = data.incoming as MentorshipRequest[];
  const outgoing = data.outgoing as MentorshipRequest[];

  const onAccept = async (req: MentorshipRequest) => {
    const choice = window.prompt(
      `Pick a time to accept:\n${req.proposedTimes
        .map((t, i) => `${i + 1}. ${t}`)
        .join("\n")}\n\nType the number:`,
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
      await respond({
        requestId: req._id as unknown as never,
        action: "decline",
      });
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
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Mentorship</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Brief, structured 30-minute sessions. Pick from proposed windows;
        decline at any time without explanation.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Requests to you
        </h2>
        <div className="mt-3 space-y-3">
          {incoming.length === 0 ? (
            <EmptyState
              message="No incoming requests"
              description="When alumni request mentorship from you, requests appear here."
            />
          ) : (
            incoming.map((req) => (
              <Card key={req._id}>
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{req.topic}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Status: {req.status}
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
                  {req.status === "requested" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={busy === req._id}
                        onClick={() => onAccept(req)}
                      >
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
                    </div>
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
              description="Request mentorship from someone tagged 'open to mentorship' in the directory."
            />
          ) : (
            outgoing.map((req) => (
              <Card key={req._id}>
                <CardContent className="space-y-1 p-5">
                  <p className="font-medium">{req.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    Status: {req.status}
                    {req.scheduledFor &&
                      ` · ${new Date(req.scheduledFor).toLocaleString()}`}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
