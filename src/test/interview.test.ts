import { describe, it, expect } from "vitest";
import {
  interviewState,
  describeInterview,
  toLocalInputValue,
  fromLocalInputValue,
  defaultInterviewSlot,
  type Interview,
} from "@/lib/interview";

const NOW = Date.UTC(2026, 10, 9, 12, 0, 0); // 9 Nov 2026, midday UTC

function iv(over: Partial<Interview> = {}): Interview {
  return {
    startsAt: NOW + 3 * 24 * 60 * 60 * 1000,
    durationMinutes: 45,
    mode: "onsite",
    scheduledAt: NOW,
    ...over,
  };
}

describe("interviewState", () => {
  it("is 'none' without an interview", () => {
    expect(interviewState(null, NOW)).toBe("none");
    expect(interviewState(undefined, NOW)).toBe("none");
  });

  it("is 'awaiting' once proposed but not answered", () => {
    expect(interviewState(iv(), NOW)).toBe("awaiting");
  });

  it("is 'accepted' once confirmed", () => {
    expect(interviewState(iv({ response: "accepted" }), NOW)).toBe("accepted");
  });

  it("is 'declined' when the candidate cannot make it", () => {
    expect(interviewState(iv({ response: "declined" }), NOW)).toBe("declined");
  });

  it("reports 'past' for a time that has gone by", () => {
    expect(interviewState(iv({ startsAt: NOW - 1000 }), NOW)).toBe("past");
  });

  it("prefers 'declined' over 'past' — a refusal outlives the slot", () => {
    // An employer looking back needs to know it was declined, not merely
    // that the time elapsed.
    expect(
      interviewState(iv({ startsAt: NOW - 1000, response: "declined" }), NOW),
    ).toBe("declined");
  });

  it("cancellation beats every other state", () => {
    expect(
      interviewState(
        iv({ cancelledAt: NOW, response: "accepted" }),
        NOW,
      ),
    ).toBe("cancelled");
  });
});

describe("describeInterview", () => {
  it("names the format, the time and the length", () => {
    const text = describeInterview(iv({ mode: "online", durationMinutes: 30 }));
    expect(text).toContain("Online");
    expect(text).toContain("30 min");
  });

  it("falls back to the raw mode if it is unrecognised", () => {
    expect(describeInterview(iv({ mode: "carrier-pigeon" }))).toContain(
      "carrier-pigeon",
    );
  });
});

describe("datetime-local round trip", () => {
  // The bug this guards: using toISOString() to fill a datetime-local input
  // shifts the displayed time by the UTC offset, so the employer sees an hour
  // they did not choose.
  it("round-trips a timestamp through the input format", () => {
    const original = new Date(2026, 10, 20, 14, 30, 0, 0).getTime();
    const asInput = toLocalInputValue(original);
    expect(asInput).toBe("2026-11-20T14:30");
    expect(fromLocalInputValue(asInput)).toBe(original);
  });

  it("pads single-digit months, days, hours and minutes", () => {
    const t = new Date(2027, 0, 5, 9, 7, 0, 0).getTime();
    expect(toLocalInputValue(t)).toBe("2027-01-05T09:07");
  });

  it("returns null for empty or malformed input", () => {
    expect(fromLocalInputValue("")).toBeNull();
    expect(fromLocalInputValue("not a date")).toBeNull();
  });
});

describe("defaultInterviewSlot", () => {
  it("suggests 10am, three days out, and always in the future", () => {
    const slot = defaultInterviewSlot(NOW);
    expect(slot).toBeGreaterThan(NOW);
    expect(new Date(slot).getHours()).toBe(10);
    expect(new Date(slot).getMinutes()).toBe(0);
  });
});
