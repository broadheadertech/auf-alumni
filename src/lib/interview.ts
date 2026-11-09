/**
 * Screening-appointment formatting, shared by the employer's applicant list
 * and the alumnus's application tracker so the two can never describe the
 * same appointment differently.
 */

export type InterviewMode = "onsite" | "online" | "phone";

export type Interview = {
  startsAt: number;
  durationMinutes?: number;
  mode: string;
  location?: string;
  note?: string;
  scheduledAt: number;
  cancelledAt?: number;
  response?: string;
  responseNote?: string;
  respondedAt?: number;
};

export const INTERVIEW_MODES: { value: InterviewMode; label: string }[] = [
  { value: "onsite", label: "In person" },
  { value: "online", label: "Online" },
  { value: "phone", label: "Phone" },
];

export const INTERVIEW_MODE_LABEL: Record<string, string> = {
  onsite: "In person",
  online: "Online",
  phone: "Phone",
};

/** What the location field means depends on the mode, so the prompt does too. */
export const LOCATION_PROMPT: Record<string, string> = {
  onsite: "Address",
  online: "Meeting link",
  phone: "Number to call",
};

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

const DATE_TIME = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatInterviewWhen(startsAt: number): string {
  return DATE_TIME.format(new Date(startsAt));
}

export type InterviewState =
  | "none"
  | "cancelled"
  | "awaiting"
  | "accepted"
  | "declined"
  | "past";

/**
 * One word for where an appointment stands. "awaiting" and "past" are
 * deliberately distinct from "accepted": an employer needs to tell a
 * confirmed booking from one the candidate has not opened yet, and a time
 * that has simply gone by from one that was agreed.
 */
export function interviewState(
  interview: Interview | null | undefined,
  now: number = Date.now(),
): InterviewState {
  if (!interview) return "none";
  if (interview.cancelledAt) return "cancelled";
  if (interview.response === "declined") return "declined";
  if (interview.startsAt < now) return "past";
  if (interview.response === "accepted") return "accepted";
  return "awaiting";
}

export const INTERVIEW_STATE_LABEL: Record<InterviewState, string> = {
  none: "Not scheduled",
  cancelled: "Cancelled",
  awaiting: "Awaiting confirmation",
  accepted: "Confirmed",
  declined: "Declined",
  past: "Interview passed",
};

/** A one-line summary, e.g. "Online · Thu, 20 Nov 2026, 2:00 pm · 45 min". */
export function describeInterview(interview: Interview): string {
  const parts = [
    INTERVIEW_MODE_LABEL[interview.mode] ?? interview.mode,
    formatInterviewWhen(interview.startsAt),
  ];
  if (interview.durationMinutes) parts.push(`${interview.durationMinutes} min`);
  return parts.join(" · ");
}

/**
 * `datetime-local` wants "YYYY-MM-DDTHH:mm" in LOCAL time. Using toISOString
 * here would silently shift the value by the UTC offset, so the employer
 * would see a different hour than the one they picked.
 */
export function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Inverse of the above: a local "YYYY-MM-DDTHH:mm" back to epoch ms. */
export function fromLocalInputValue(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** A sensible first suggestion: 10am three days out. */
export function defaultInterviewSlot(now: number = Date.now()): number {
  const d = new Date(now + 3 * 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  return d.getTime();
}
