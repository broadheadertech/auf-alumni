/**
 * Labels + audience descriptions for the live admin event views
 * (`api.adminData.events` / `api.adminData.event`). No data — presentation only.
 * Category values mirror `categoryValidator` in convex/events.ts.
 */

import type { EventAudienceView } from "../../convex/adminData";

export const LIVE_EVENT_CATEGORIES = [
  { value: "reunion", label: "Reunion" },
  { value: "webinar", label: "Webinar" },
  { value: "meetup", label: "Meetup" },
  { value: "by-program", label: "By program" },
  { value: "online-meeting", label: "Online meeting" },
  { value: "other", label: "Other" },
] as const;

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  LIVE_EVENT_CATEGORIES.map((c) => [c.value, c.label]),
);

export function eventCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

function describeBatches(batches: number[]): string {
  const sorted = [...batches].sort((a, b) => a - b);
  if (sorted.length === 0) return "No year selected";
  if (sorted.length === 1) return `Class of ${sorted[0]}`;
  const contiguous = sorted.every((y, i) => i === 0 || y === sorted[i - 1] + 1);
  if (contiguous) return `Batches ${sorted[0]}–${sorted[sorted.length - 1]}`;
  return `${sorted.length} graduating years`;
}

function describePrograms(programs: string[]): string {
  if (programs.length === 0) return "No program selected";
  if (programs.length === 1) return programs[0];
  return `${programs.length} programs`;
}

/** Human description of a live event audience. */
export function describeAudience(a: EventAudienceView): string {
  switch (a.kind) {
    case "everyone":
      return "All verified alumni";
    case "batch":
      return describeBatches(a.batches);
    case "program":
      return describePrograms(a.programs);
    case "batch-program":
      return `${describeBatches(a.batches)} · ${describePrograms(a.programs)}`;
  }
}

export function audienceBatches(a: EventAudienceView): number[] {
  return a.kind === "batch" || a.kind === "batch-program" ? a.batches : [];
}

export function audiencePrograms(a: EventAudienceView): string[] {
  return a.kind === "program" || a.kind === "batch-program" ? a.programs : [];
}
