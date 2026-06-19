/**
 * Pure calendar-link helpers (no Convex/React imports).
 *
 * - `buildEventIcs` produces an RFC 5545 iCalendar string (CRLF line endings,
 *   escaped text, UTC basic-format timestamps) for a Blob download.
 * - `googleCalendarUrl` produces a prefilled Google Calendar template link.
 */

export type CalendarEventInput = {
  /** Stable event identifier (the Convex event id) — drives the ICS UID. */
  id: string;
  title: string;
  description?: string;
  /** Epoch ms. */
  startsAt: number;
  /** Epoch ms; defaults to startsAt + 1 hour when omitted. */
  endsAt?: number;
  location?: string;
  /** Canonical URL of the event page. */
  url?: string;
};

const HOUR_MS = 60 * 60 * 1000;

/**
 * RFC 5545 §3.3.11 TEXT escaping: backslash first, then semicolon and comma;
 * any newline becomes a literal `\n` sequence.
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Epoch ms → UTC basic format `YYYYMMDDTHHMMSSZ`. */
function formatUtc(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function eventTimes(input: CalendarEventInput): { start: number; end: number } {
  return {
    start: input.startsAt,
    // Only honor endsAt when it is strictly after startsAt; otherwise fall
    // back to a 1-hour duration (guards against bad/equal end timestamps).
    end:
      input.endsAt != null && input.endsAt > input.startsAt
        ? input.endsAt
        : input.startsAt + HOUR_MS,
  };
}

/**
 * RFC 5545 §3.1 line folding: content lines longer than 75 octets are split
 * into chunks joined by CRLF + a single space. Chunks are capped at 73 chars
 * so every physical line (including the leading fold space) stays ≤ 75.
 * A chunk never ends on a UTF-16 high surrogate — the pair moves intact to
 * the next chunk.
 */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    let end = Math.min(i + 73, line.length);
    const lastCode = line.charCodeAt(end - 1);
    // High surrogate at the boundary: defer it to the next chunk so the
    // surrogate pair is never split across a fold.
    if (end < line.length && lastCode >= 0xd800 && lastCode <= 0xdbff) {
      end -= 1;
    }
    chunks.push(line.slice(i, end));
    i = end;
  }
  return chunks.join("\r\n ");
}

/**
 * Build a single-VEVENT iCalendar document. The UID is derived from the
 * event id (stable across downloads) so re-imports update rather than
 * duplicate the event.
 */
export function buildEventIcs(input: CalendarEventInput): string {
  const { start, end } = eventTimes(input);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AUF Alumni Network//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(input.id)}@auf-alumni`,
    `DTSTAMP:${formatUtc(Date.now())}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
  ];
  if (input.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  }
  if (input.location) {
    lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  }
  if (input.url) {
    // URL is a URI value type (RFC 5545 §3.3.13), not TEXT — no escaping.
    lines.push(`URL:${input.url}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Prefilled Google Calendar "create event" link. */
export function googleCalendarUrl(input: CalendarEventInput): string {
  const { start, end } = eventTimes(input);
  const params: string[] = [
    "action=TEMPLATE",
    `text=${encodeURIComponent(input.title)}`,
    `dates=${formatUtc(start)}/${formatUtc(end)}`,
  ];
  const details = [input.description, input.url].filter(Boolean).join("\n\n");
  if (details) params.push(`details=${encodeURIComponent(details)}`);
  if (input.location) {
    params.push(`location=${encodeURIComponent(input.location)}`);
  }
  return `https://calendar.google.com/calendar/render?${params.join("&")}`;
}
