/**
 * Employment-history periods.
 *
 * `experience[]` used to carry a single free-text `years` string ("2020 - 2023").
 * That was unparseable, so nothing could compute time-to-employment, tenure or
 * a reliable work anniversary - the anniversary cron had to regex a year out of
 * the front of the string and guess the month from the profile's createdAt.
 *
 * Entries now carry structured start/end fields. `years` survives as the
 * DERIVED display label, recomputed server-side on every write, so the dozens
 * of places that render `e.years` keep working untouched and stay consistent.
 *
 * The UI mirrors `formatPeriod` in src/lib/experience.ts for live preview while
 * someone is typing; this module is the authority on what gets stored.
 */

export type ExperienceEntry = {
  role: string;
  company: string;
  /** Derived display label. Never hand-written on new writes. */
  years: string;
  startYear?: number;
  /** 1-12. Optional: year-only entries are normal and fine. */
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  /** Still in this role. Mutually exclusive with endYear. */
  current?: boolean;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** En-dash, used consistently for ranges across the app. */
const DASH = "\u2013";

function monthLabel(year: number, month?: number): string {
  if (month == null || month < 1 || month > 12) return String(year);
  return MONTHS[month - 1] + " " + year;
}

/**
 * The display label for an entry. Falls back to whatever free text the entry
 * already carried when it has no structured start, so a row we could not parse
 * during the backfill still shows the alumnus what they originally typed.
 */
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

/** Months since epoch-ish - a comparable scalar for ordering and tenure maths. */
export function monthIndex(year: number, month?: number): number {
  return year * 12 + ((month ?? 1) - 1);
}

/**
 * Tenure in whole months, or null when the entry has no usable start.
 * An open-ended ("current") entry is measured to `asOf`.
 */
export function tenureMonths(
  entry: ExperienceEntry,
  asOf: number = Date.now(),
): number | null {
  if (entry.startYear == null) return null;
  const start = monthIndex(entry.startYear, entry.startMonth);
  let end: number;
  if (entry.current || entry.endYear == null) {
    const d = new Date(asOf);
    end = monthIndex(d.getUTCFullYear(), d.getUTCMonth() + 1);
  } else {
    end = monthIndex(entry.endYear, entry.endMonth);
  }
  return Math.max(0, end - start);
}

/** The earliest structured start across a history, or null. */
export function earliestStart(
  entries: ExperienceEntry[],
): { year: number; month?: number } | null {
  let best: { year: number; month?: number } | null = null;
  for (const e of entries) {
    if (e.startYear == null) continue;
    if (best == null || monthIndex(e.startYear, e.startMonth) < monthIndex(best.year, best.month)) {
      best = { year: e.startYear, month: e.startMonth };
    }
  }
  return best;
}

const MONTH_WORDS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

/** "Mar 2020" / "March 2020" / "2020" -> { year, month? }; null if no year. */
function parseEndpoint(raw: string): { year: number; month?: number } | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  const yearMatch = /(\d{4})/.exec(text);
  if (!yearMatch) return null;
  const year = Number(yearMatch[1]);
  if (year < 1900 || year > 2200) return null;
  const wordMatch = /([a-z]+)/.exec(text);
  const month = wordMatch ? MONTH_WORDS[wordMatch[1]] : undefined;
  return month ? { year, month } : { year };
}

const PRESENT = /^(present|current|now|ongoing|to date|date)$/;

/**
 * Best-effort parse of a legacy free-text period into structured fields.
 * Returns null when there is no year to anchor on, in which case the caller
 * should leave the entry alone rather than invent data.
 *
 * Handles the seeded "2020 - 2023" / "2017 - Present" shapes plus hyphen,
 * em-dash and the word "to" as separators, with or without month names.
 */
export function parseLegacyPeriod(raw: string | undefined): {
  startYear: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  current?: boolean;
} | null {
  if (!raw) return null;
  const text = raw.replace(/\u2014|\u2013/g, "-").trim();
  if (!text) return null;

  const parts = text.split(/\s*(?:-|\bto\b)\s*/i).filter((s) => s.length > 0);
  const start = parseEndpoint(parts[0] ?? "");
  if (!start) return null;

  const tail = (parts[1] ?? "").trim().toLowerCase();
  if (!tail) return { startYear: start.year, startMonth: start.month };
  if (PRESENT.test(tail)) {
    return { startYear: start.year, startMonth: start.month, current: true };
  }
  const end = parseEndpoint(tail);
  if (!end) return { startYear: start.year, startMonth: start.month };
  return {
    startYear: start.year,
    startMonth: start.month,
    endYear: end.year,
    endMonth: end.month,
  };
}

/**
 * Normalise one entry for storage: clamp the month range, drop an end date
 * when the entry is marked current, and recompute the display label.
 */
export function normalizeEntry(entry: ExperienceEntry): ExperienceEntry {
  const clampMonth = (m?: number) =>
    m == null || m < 1 || m > 12 ? undefined : Math.floor(m);

  const startYear = entry.startYear;
  const startMonth = clampMonth(entry.startMonth);
  const current = entry.current === true;
  const endYear = current ? undefined : entry.endYear;
  const endMonth = current ? undefined : clampMonth(entry.endMonth);

  const next: ExperienceEntry = {
    role: entry.role,
    company: entry.company,
    years: "",
    ...(startYear != null ? { startYear } : {}),
    ...(startMonth != null ? { startMonth } : {}),
    ...(endYear != null ? { endYear } : {}),
    ...(endMonth != null ? { endMonth } : {}),
    ...(current ? { current: true } : {}),
  };
  next.years = formatPeriod({ ...next, years: entry.years });
  return next;
}
