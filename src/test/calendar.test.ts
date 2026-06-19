import { describe, expect, it } from "vitest";
import { buildEventIcs, googleCalendarUrl } from "@/lib/calendar";

const START = Date.UTC(2026, 5, 12, 18, 30, 0); // 2026-06-12T18:30:00Z
const END = Date.UTC(2026, 5, 12, 21, 0, 0); // 2026-06-12T21:00:00Z

const baseInput = {
  id: "evt_abc123",
  title: "Grand Reunion",
  description: "Dinner and awards night",
  startsAt: START,
  endsAt: END,
  location: "Marquee Mall Atrium, Pampanga",
  url: "https://aufalumni.example/events/evt_abc123",
};

/** RFC 5545 §3.1 unfolding: remove CRLF followed by a single space/tab. */
function unfoldIcs(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "");
}

function icsLine(ics: string, prop: string): string {
  const line = unfoldIcs(ics)
    .split("\r\n")
    .find((l) => l.startsWith(`${prop}:`));
  expect(line, `expected ${prop} line in ICS`).toBeDefined();
  return line!;
}

describe("buildEventIcs", () => {
  it("wraps a VEVENT in a VCALENDAR with PRODID and DTSTAMP", () => {
    const ics = buildEventIcs(baseInput);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(icsLine(ics, "PRODID")).toContain("AUF Alumni");
    expect(icsLine(ics, "DTSTAMP")).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
  });

  it("uses CRLF line endings exclusively", () => {
    const ics = buildEventIcs(baseInput);
    // Every \n must be preceded by \r — no bare LF anywhere.
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).not.toMatch(/^\n/);
    expect(ics).toContain("\r\n");
  });

  it("formats DTSTART/DTEND as UTC basic format for a known timestamp", () => {
    const ics = buildEventIcs(baseInput);
    expect(icsLine(ics, "DTSTART")).toBe("DTSTART:20260612T183000Z");
    expect(icsLine(ics, "DTEND")).toBe("DTEND:20260612T210000Z");
  });

  it("falls back to start + 1 hour when endsAt is omitted", () => {
    const ics = buildEventIcs({ ...baseInput, endsAt: undefined });
    expect(icsLine(ics, "DTSTART")).toBe("DTSTART:20260612T183000Z");
    expect(icsLine(ics, "DTEND")).toBe("DTEND:20260612T193000Z");
  });

  it("falls back to start + 1 hour when endsAt is not after startsAt", () => {
    for (const endsAt of [START, START - 60 * 60 * 1000]) {
      const ics = buildEventIcs({ ...baseInput, endsAt });
      expect(icsLine(ics, "DTSTART")).toBe("DTSTART:20260612T183000Z");
      expect(icsLine(ics, "DTEND")).toBe("DTEND:20260612T193000Z");
    }
  });

  it("folds content lines longer than 75 chars with CRLF + space", () => {
    const longTitle = `${"A".repeat(100)}, ${"B".repeat(60)}`;
    const longDescription = "x".repeat(200);
    const ics = buildEventIcs({
      ...baseInput,
      title: longTitle,
      description: longDescription,
    });
    expect(ics).toContain("\r\n ");
    // Every physical line must be ≤ 75 chars before its CRLF.
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    // Unfolding (removing CRLF + space) reconstructs the original content.
    expect(icsLine(ics, "SUMMARY")).toBe(
      `SUMMARY:${"A".repeat(100)}\\, ${"B".repeat(60)}`,
    );
    expect(icsLine(ics, "DESCRIPTION")).toBe(
      `DESCRIPTION:${longDescription}`,
    );
  });

  it("never splits a UTF-16 surrogate pair at a fold boundary", () => {
    const title = "🎉".repeat(60); // 120 UTF-16 code units → must fold
    const ics = buildEventIcs({ ...baseInput, title });
    const physical = ics.split("\r\n");
    for (const line of physical) {
      expect(line.length).toBeLessThanOrEqual(75);
      if (line.length === 0) continue;
      const lastCode = line.charCodeAt(line.length - 1);
      const isHighSurrogate = lastCode >= 0xd800 && lastCode <= 0xdbff;
      expect(isHighSurrogate, "line must not end on a high surrogate").toBe(
        false,
      );
    }
    expect(icsLine(ics, "SUMMARY")).toBe(`SUMMARY:${title}`);
  });

  it("escapes commas, semicolons, backslashes, and newlines per RFC5545", () => {
    const ics = buildEventIcs({
      ...baseInput,
      title: "Dinner, drinks; and more \\ fun",
      description: "Line one\nLine two\r\nLine three",
      location: "Atrium, Level 2; Pampanga",
    });
    expect(icsLine(ics, "SUMMARY")).toBe(
      "SUMMARY:Dinner\\, drinks\\; and more \\\\ fun",
    );
    expect(icsLine(ics, "DESCRIPTION")).toBe(
      "DESCRIPTION:Line one\\nLine two\\nLine three",
    );
    expect(icsLine(ics, "LOCATION")).toBe(
      "LOCATION:Atrium\\, Level 2\\; Pampanga",
    );
  });

  it("derives a stable UID from the event id", () => {
    const a = icsLine(buildEventIcs(baseInput), "UID");
    const b = icsLine(buildEventIcs(baseInput), "UID");
    expect(a).toBe(b);
    expect(a).toContain("evt_abc123");
    const other = icsLine(
      buildEventIcs({ ...baseInput, id: "evt_other" }),
      "UID",
    );
    expect(other).not.toBe(a);
  });

  it("emits URL as a raw URI value without TEXT escaping", () => {
    const url = "https://aufalumni.example/e?ids=1,2;mode=a,b";
    const ics = buildEventIcs({ ...baseInput, url });
    const line = icsLine(ics, "URL");
    expect(line).toBe(`URL:${url}`);
    expect(line).not.toContain("\\,");
    expect(line).not.toContain("\\;");
  });

  it("omits DESCRIPTION/LOCATION/URL lines when those fields are absent", () => {
    const ics = buildEventIcs({
      id: "evt_min",
      title: "Bare event",
      startsAt: START,
    });
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("URL:");
  });
});

describe("googleCalendarUrl", () => {
  it("builds a render?action=TEMPLATE URL with encoded params", () => {
    const url = googleCalendarUrl({
      ...baseInput,
      title: "Dinner & drinks, 2026",
      description: undefined,
      url: undefined,
      location: "Atrium, Level 2",
    });
    expect(
      url.startsWith("https://calendar.google.com/calendar/render?"),
    ).toBe(true);
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain(`text=${encodeURIComponent("Dinner & drinks, 2026")}`);
    expect(url).toContain("dates=20260612T183000Z/20260612T210000Z");
    expect(url).toContain(`location=${encodeURIComponent("Atrium, Level 2")}`);
    // Raw unencoded specials must not leak into the query string.
    expect(url).not.toContain("&drinks");
    expect(url).not.toContain(" ");
  });

  it("uses the +1h fallback end in the dates param", () => {
    const url = googleCalendarUrl({
      id: "evt_abc123",
      title: "Solo",
      startsAt: START,
    });
    expect(url).toContain("dates=20260612T183000Z/20260612T193000Z");
  });

  it("includes description and event URL in details", () => {
    const url = googleCalendarUrl(baseInput);
    expect(url).toContain(
      `details=${encodeURIComponent(
        `${baseInput.description}\n\n${baseInput.url}`,
      )}`,
    );
  });
});
