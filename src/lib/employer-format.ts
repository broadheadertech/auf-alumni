/**
 * Formatting + label constants for the (real, Convex-backed) employer console.
 * No mock data — mirrors the value sets used by convex/jobs.ts.
 */

export const STAGE_ORDER = [
  "new",
  "screening",
  "interview",
  "offered",
  "hired",
  "not-selected",
] as const;

export type Stage = (typeof STAGE_ORDER)[number];

export const STAGE_LABEL: Record<string, string> = {
  new: "New",
  screening: "Screening",
  interview: "Interview",
  offered: "Offered",
  hired: "Hired",
  "not-selected": "Not selected",
};

export const JOB_STATUS_LABEL: Record<string, string> = {
  published: "Published",
  "pending-moderation": "Pending review",
  suspended: "Suspended",
  closed: "Closed",
  draft: "Draft",
};

export function fmtDate(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function salaryLabel(
  min?: number,
  max?: number,
  currency = "PHP",
): string {
  const sym = currency === "PHP" ? "₱" : `${currency} `;
  const k = (n: number) =>
    n >= 1000 && n % 1000 === 0 ? `${n / 1000}k` : n.toLocaleString();
  if (min && max) return `${sym}${k(min)}–${sym}${k(max)} / mo`;
  if (min) return `From ${sym}${k(min)} / mo`;
  if (max) return `Up to ${sym}${k(max)} / mo`;
  return "Negotiable";
}
