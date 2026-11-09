"use client";

/**
 * Employer-side screening appointment: schedule, reschedule, cancel.
 *
 * The pipeline already had an "interview" stage but nothing behind it — no
 * date, no place, nothing the applicant could see or reply to. This is the
 * missing half.
 *
 * Scheduling moves the application to the interview stage server-side, so the
 * employer does not have to remember to do both.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { CalendarClock, Loader2, X } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DURATION_OPTIONS,
  INTERVIEW_MODES,
  INTERVIEW_STATE_LABEL,
  LOCATION_PROMPT,
  defaultInterviewSlot,
  describeInterview,
  fromLocalInputValue,
  interviewState,
  toLocalInputValue,
  type Interview,
} from "@/lib/interview";
import { cn } from "@/lib/utils";

export function InterviewScheduler({
  applicationId,
  applicantName,
  interview,
}: {
  applicationId: string;
  applicantName: string;
  interview: Interview | null;
}) {
  const schedule = useMutation(api.jobs.scheduleInterview);
  const cancel = useMutation(api.jobs.cancelInterview);

  const state = interviewState(interview);
  const live = interview && !interview.cancelledAt;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState(() =>
    toLocalInputValue(interview?.startsAt ?? defaultInterviewSlot()),
  );
  const [mode, setMode] = useState(interview?.mode ?? "onsite");
  const [duration, setDuration] = useState(
    String(interview?.durationMinutes ?? 45),
  );
  const [location, setLocation] = useState(interview?.location ?? "");
  const [note, setNote] = useState(interview?.note ?? "");

  const onSubmit = async () => {
    const startsAt = fromLocalInputValue(when);
    if (startsAt == null) {
      toast.error("Pick a date and time");
      return;
    }
    if (startsAt <= Date.now()) {
      toast.error("Pick a date and time in the future");
      return;
    }
    setBusy(true);
    try {
      await schedule({
        applicationId: applicationId as never,
        startsAt,
        durationMinutes: Number(duration),
        mode,
        location: location.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success(`Interview sent to ${applicantName}`);
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not schedule the interview",
      );
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    setBusy(true);
    try {
      await cancel({ applicationId: applicationId as never });
      toast.success("Interview cancelled");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not cancel the interview",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="h-4 w-4" />
            Screening appointment
          </div>
          {live ? (
            <>
              <div className="mt-1 text-sm">{describeInterview(interview)}</div>
              {interview.location && (
                <div className="mt-0.5 text-xs text-muted-foreground break-all">
                  {LOCATION_PROMPT[interview.mode] ?? "Where"}:{" "}
                  {interview.location}
                </div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
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
                {interview.responseNote && (
                  <span className="text-xs text-muted-foreground">
                    &ldquo;{interview.responseNote}&rdquo;
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {state === "cancelled"
                ? "The last appointment was cancelled."
                : "No appointment yet."}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={live ? "outline" : "default"}
            onClick={() => setOpen((v) => !v)}
            disabled={busy}
          >
            {open ? "Close" : live ? "Reschedule" : "Schedule"}
          </Button>
          {live && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={busy}
              className="text-muted-foreground"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor={`iv-when-${applicationId}`} className="text-xs">
                Date and time
              </Label>
              <Input
                id={`iv-when-${applicationId}`}
                type="datetime-local"
                className="mt-1"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`iv-dur-${applicationId}`} className="text-xs">
                Length
              </Label>
              <Select value={duration} onValueChange={(v) => setDuration(v ?? "45")}>
                <SelectTrigger id={`iv-dur-${applicationId}`} className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor={`iv-mode-${applicationId}`} className="text-xs">
                Format
              </Label>
              <Select value={mode} onValueChange={(v) => setMode(v ?? "onsite")}>
                <SelectTrigger id={`iv-mode-${applicationId}`} className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`iv-loc-${applicationId}`} className="text-xs">
                {LOCATION_PROMPT[mode] ?? "Where"}
              </Label>
              <Input
                id={`iv-loc-${applicationId}`}
                className="mt-1"
                placeholder={
                  mode === "online"
                    ? "https://meet.example.com/..."
                    : mode === "phone"
                      ? "+63 ..."
                      : "Office address"
                }
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor={`iv-note-${applicationId}`} className="text-xs">
              Note for the candidate (optional)
            </Label>
            <Input
              id={`iv-note-${applicationId}`}
              className="mt-1"
              placeholder="Bring a printed CV; ask for the HR desk on arrival"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <Button type="button" size="sm" onClick={onSubmit} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Sending…
              </>
            ) : live ? (
              "Send new time"
            ) : (
              "Send invitation"
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            {applicantName} is notified and asked to confirm. Rescheduling
            clears any previous confirmation.
          </p>
        </div>
      )}
    </div>
  );
}
