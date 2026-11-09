/**
 * Client-side mirror of the period formatting in
 * convex/helpers/experience.ts, for live preview while someone edits their
 * employment history.
 *
 * The two files are deliberately separate: convex/ and src/ are bundled by
 * different toolchains with different tsconfigs, so there is no shared import
 * path. The server recomputes `years` on every write, so if these ever drift
 * the stored value is the server's - this copy only affects what the editor
 * shows you before you save. Keep `formatPeriod` identical in both.
 */

export const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DASH = "\u2013";

export type ExperienceDraft = {
  role: string;
  company: string;
  years: string;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  current?: boolean;
};

function monthLabel(year: number, month?: number): string {
  if (month == null || month < 1 || month > 12) return String(year);
  return MONTHS_SHORT[month - 1] + " " + year;
}

export function formatPeriod(entry: {
  years?: string;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  current?: boolean;
}): string {
  if (entry.startYear == null) return (entry.years ?? "").trim();
  const start = monthLabel(entry.startYear, entry.startMonth);
  if (entry.current) return start + " " + DASH + " Present";
  if (entry.endYear == null) return start;
  return start + " " + DASH + " " + monthLabel(entry.endYear, entry.endMonth);
}

/** Year choices for the pickers: this year forward is not useful for a start. */
export function yearOptions(back = 60): number[] {
  const now = new Date().getFullYear();
  return Array.from({ length: back + 1 }, (_, i) => now - i);
}

/**
 * Validation for one row, surfaced inline in the editor.
 * Returns null when the row is fine.
 */
export function periodError(entry: ExperienceDraft): string | null {
  if (entry.startYear == null) {
    // A row with neither a start nor legacy text is incomplete.
    return entry.years.trim() ? null : "Add the year you started";
  }
  if (entry.current) return null;
  if (entry.endYear == null) return null;
  const start = entry.startYear * 12 + ((entry.startMonth ?? 1) - 1);
  const end = entry.endYear * 12 + ((entry.endMonth ?? 12) - 1);
  if (end < start) return "The end date is before the start date";
  return null;
}
