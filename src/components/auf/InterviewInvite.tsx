"use client";

/**
 * The applicant's side of a screening appointment: see the proposed time and
 * say whether they can make it.
 *
 * Declining does not withdraw the application and does not move the stage
 * backwards — not being free on a Tuesday is not the same as dropping out,
 * and the note field is there so the candidate can say when they would be.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  INTERVIEW_MODE_LABEL,
  INTERVIEW_STATE_LABEL,
  LOCATION_PROMPT,
  formatInterviewWhen,
  interviewState,
  type Interview,
} from "@/lib/interview";
import { cn } from "@/lib/utils";

export function InterviewInvite({
  applicationId,
  employerName,
  interview,
}: {
  applicationId: string;
  employerName: string;
  interview: Interview;
}) {
  const respond = useMutation(api.jobs.respondToInterview);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");

  const state = interviewState(interview);
  const canRespond = state === "awaiting" || state === "accepted" || state === "declined";

  const send = async (response: "accepted" | "declined") => {
    setBusy(true);
    try {
      await respond({
        applicationId: applicationId as never,
        response,
        note: note.trim() || undefined,
      });
      toast.success(
        response === "accepted"
          ? "Confirmed — see you there"
          : "Let them know. They can propose another time.",
      );
      setDeclining(false);
      setNote("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send your reply",
      );
    } finally {
      setBusy(false);
    }
  };

  const isOnlineLink =
    interview.mode === "online" && /^https?:\/\//i.test(interview.location ?? "");

  return (
    <div
      data-tour="interview-invite"
      className={cn(
        "mt-3 rounded-md border p-3",
        state === "cancelled"
          ? "border-border bg-muted/30"
          : "border-foreground/20 bg-muted/40",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarClock className="h-4 w-4" />
        {state === "cancelled"
          ? "Interview cancelled"
          : `Interview with ${employerName}`}
      </div>

      {state !== "cancelled" && (
        <>
          <div className="mt-1 text-sm">
            {formatInterviewWhen(interview.startsAt)}
            {interview.durationMinutes ? ` · ${interview.durationMinutes} min` : ""}
            {" · "}
            {INTERVIEW_MODE_LABEL[interview.mode] ?? interview.mode}
          </div>

          {interview.location && (
            <div className="mt-0.5 text-xs text-muted-foreground break-all">
              {LOCATION_PROMPT[interview.mode] ?? "Where"}:{" "}
              {isOnlineLink ? (
                <a
                  href={interview.location}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {interview.location}
                </a>
              ) : (
                interview.location
              )}
            </div>
          )}

          {interview.note && (
            <p className="mt-1 text-xs text-muted-foreground">{interview.note}</p>
          )}

          <div className="mt-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px]",
                state === "accepted" &&
                  "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
                state === "declined" &&
                  "border-destructive/40 bg-destructive/10 text-destructive",
                (state === "awaiting" || state === "past") &&
                  "border-border text-muted-foreground",
              )}
            >
              {INTERVIEW_STATE_LABEL[state]}
            </span>
          </div>

          {state !== "past" && canRespond && (
            <div className="mt-3 space-y-2">
              {declining && (
                <Input
                  placeholder="Optional — when would suit you instead?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
              <div className="flex flex-wrap gap-2">
                {state !== "accepted" && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => send("accepted")}
                  >
                    {busy ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-3.5 w-3.5" />
                    )}
                    I can make it
                  </Button>
                )}
                {state !== "declined" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      declining ? send("declined") : setDeclining(true)
                    }
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    {declining ? "Send" : "I can't make it"}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Declining doesn&apos;t withdraw your application.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
