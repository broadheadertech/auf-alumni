import { describe, expect, it } from "vitest";
import {
  buildDigestModel,
  digestHighlight,
  type BuildDigestInput,
  type DigestEvent,
  type DigestJob,
  type DigestPeer,
} from "../../convex/digestModel";

const DAY_MS = 24 * 60 * 60 * 1000;
// Sunday 2026-06-07 10:00 UTC == 18:00 PHT (the digest cron slot).
const NOW = Date.UTC(2026, 5, 7, 10, 0, 0);
const APP_URL = "https://alumni.test";

const SETTINGS_URL = `${APP_URL}/settings/notifications`;

const recipient = {
  displayName: "Jen Cruz",
  batch: 2018,
  program: "BS Information Technology",
  city: "Manila",
};

function makeInput(overrides: Partial<BuildDigestInput> = {}): BuildDigestInput {
  return {
    recipient,
    peers: [],
    jobs: [],
    events: [],
    now: NOW,
    appUrl: APP_URL,
    settingsUrl: SETTINGS_URL,
    ...overrides,
  };
}

function makePeer(overrides: Partial<DigestPeer> = {}): DigestPeer {
  return {
    displayName: "Sample Peer",
    slug: "sample-peer",
    batch: 2018,
    program: "BS Information Technology",
    city: "Manila",
    openTo: [],
    createdAt: NOW - 90 * DAY_MS, // old by default — not a "recent" batchmate
    verifiedAt: NOW - 90 * DAY_MS, // verified by default — pools require it
    ...overrides,
  };
}

function makeJob(overrides: Partial<DigestJob> = {}): DigestJob {
  return {
    id: "job1",
    title: "Software Engineer",
    companyName: "Acme PH",
    location: "Manila",
    status: "published",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<DigestEvent> = {}): DigestEvent {
  return {
    id: "event1",
    title: "Grand Alumni Homecoming",
    startsAt: NOW + 3 * DAY_MS,
    locationLabel: "AUF Campus",
    ...overrides,
  };
}

describe("buildDigestModel", () => {
  it("returns null when every section is empty (zero-content rule)", () => {
    expect(buildDigestModel(makeInput())).toBeNull();
  });

  it("returns null when the only rows present cannot match (stale peers, filtered job, past event)", () => {
    const model = buildDigestModel(
      makeInput({
        peers: [makePeer()], // old, not open to mentorship
        jobs: [makeJob({ targetingBatches: [2005] })],
        events: [makeEvent({ startsAt: NOW - DAY_MS })],
      }),
    );
    expect(model).toBeNull();
  });

  it("renders only the event section when only an event matches (partial content)", () => {
    const model = buildDigestModel(makeInput({ events: [makeEvent()] }));
    expect(model).not.toBeNull();
    expect(model!.batchmates).toBeNull();
    expect(model!.mentorship).toBeNull();
    expect(model!.jobs).toBeNull();
    expect(model!.event).not.toBeNull();
    expect(model!.event!.title).toBe("Grand Alumni Homecoming");
    expect(model!.event!.eventUrl).toBe(`${APP_URL}/events/event1`);
  });

  it("picks the soonest upcoming event and formats its date in Asia/Manila", () => {
    // 2026-06-10 11:00 UTC == 2026-06-10 19:00 in Manila (Wed, Jun 10, 7:00 PM)
    const soonest = makeEvent({
      id: "soonest",
      startsAt: Date.UTC(2026, 5, 10, 11, 0, 0),
    });
    const later = makeEvent({ id: "later", startsAt: NOW + 20 * DAY_MS });
    const cancelled = makeEvent({
      id: "cancelled",
      startsAt: NOW + DAY_MS,
      cancelledAt: NOW - DAY_MS,
    });
    const model = buildDigestModel(
      makeInput({ events: [later, cancelled, soonest] }),
    );
    expect(model!.event!.eventUrl).toBe(`${APP_URL}/events/soonest`);
    expect(model!.event!.whenLabel).toContain("Jun 10");
    expect(model!.event!.whenLabel).toContain("7:00");
    expect(model!.event!.whenLabel).toContain("PM");
  });

  it("excludes jobs whose targeting does not match the recipient's batch/program", () => {
    const jobs = [
      makeJob({ id: "untargeted", title: "Untargeted Role" }),
      makeJob({
        id: "wrong-batch",
        title: "Wrong Batch Role",
        targetingBatches: [2010],
      }),
      makeJob({
        id: "wrong-program",
        title: "Wrong Program Role",
        targetingPrograms: ["BS Nursing"],
      }),
      makeJob({
        id: "targeted",
        title: "Targeted Role",
        targetingBatches: [2017, 2018],
        targetingPrograms: ["BS Information Technology"],
      }),
      makeJob({
        id: "unpublished",
        title: "Unpublished Role",
        status: "pending-moderation",
      }),
    ];
    const model = buildDigestModel(makeInput({ jobs }));
    expect(model).not.toBeNull();
    const titles = model!.jobs!.items.map((i) => i.title);
    expect(titles).toEqual(["Untargeted Role", "Targeted Role"]);
    expect(model!.jobs!.items[1].jobUrl).toBe(`${APP_URL}/jobs/targeted`);
  });

  it("names recently joined/verified batchmates with profile deep links", () => {
    const peers = [
      makePeer({
        displayName: "Sophia Villanueva",
        slug: "sophia-villanueva",
        verifiedAt: NOW - 2 * DAY_MS,
      }),
      makePeer({
        displayName: "Marco Reyes",
        slug: "marco-reyes",
        createdAt: NOW - 1 * DAY_MS,
      }),
      makePeer({ displayName: "Old Timer", slug: "old-timer" }), // stale
      makePeer({
        displayName: "Other Batch",
        slug: "other-batch",
        batch: 2012,
        verifiedAt: NOW - DAY_MS,
      }),
    ];
    const model = buildDigestModel(makeInput({ peers }));
    expect(model).not.toBeNull();
    const items = model!.batchmates!.items;
    const names = items.map((i) => i.name);
    expect(names).toContain("Sophia Villanueva");
    expect(names).toContain("Marco Reyes");
    expect(names).not.toContain("Old Timer");
    expect(names).not.toContain("Other Batch");
    const sophia = items.find((i) => i.name === "Sophia Villanueva")!;
    expect(sophia.profileUrl).toBe(`${APP_URL}/profile/sophia-villanueva`);
    expect(sophia.detail).toContain("verified");
  });

  it("builds the cohort mentorship line with count, sample names, and a directory deep link", () => {
    const peers = [
      makePeer({
        displayName: "Sophia Villanueva",
        slug: "sophia-villanueva",
        openTo: ["mentorship"],
      }),
      makePeer({
        displayName: "Marco Reyes",
        slug: "marco-reyes",
        openTo: ["Mentorship", "referrals"], // case-insensitive match
      }),
      makePeer({
        displayName: "Liza Santos",
        slug: "liza-santos",
        city: "Quezon City", // outside the recipient's city — excluded once
        openTo: ["mentorship"], // a same-city cohort exists
      }),
      makePeer({
        displayName: "Not A Mentor",
        slug: "not-a-mentor",
        openTo: ["hiring"],
      }),
    ];
    const model = buildDigestModel(makeInput({ peers }));
    expect(model).not.toBeNull();
    const mentorship = model!.mentorship!;
    expect(mentorship.headline).toBe(
      "2 BS Information Technology '18 grads in Manila are open to mentorship",
    );
    expect(mentorship.sampleNames).toEqual([
      "Sophia Villanueva",
      "Marco Reyes",
    ]);
    expect(mentorship.directoryUrl).toContain(`${APP_URL}/directory?`);
    expect(mentorship.directoryUrl).toContain("batch=2018");
    expect(mentorship.directoryUrl).toContain("openTo=mentorship");
    expect(mentorship.directoryUrl).toContain("city=Manila");
  });

  it("excludes unverified peers from both the batchmate and mentorship pools", () => {
    const peers = [
      makePeer({
        displayName: "Unverified Joiner",
        slug: "unverified-joiner",
        createdAt: NOW - DAY_MS, // joined this week, but never verified
        verifiedAt: undefined,
      }),
      makePeer({
        displayName: "Unverified Mentor",
        slug: "unverified-mentor",
        openTo: ["mentorship"],
        verifiedAt: undefined,
      }),
    ];
    const model = buildDigestModel(makeInput({ peers }));
    // Neither section may form from unverified peers — zero content overall.
    expect(model).toBeNull();
  });

  it("pools mentorship by exact city match (directory semantics), not case-insensitively", () => {
    const peers = [
      makePeer({
        displayName: "Lowercase City",
        slug: "lowercase-city",
        city: "manila", // different casing — must NOT pool with "Manila"
        openTo: ["mentorship"],
      }),
    ];
    const model = buildDigestModel(makeInput({ peers }));
    expect(model).not.toBeNull();
    const mentorship = model!.mentorship!;
    // No exact-city match → falls back to the whole cohort, no city narrowing.
    expect(mentorship.headline).toBe(
      "1 BS Information Technology '18 grad is open to mentorship",
    );
    expect(mentorship.headline).not.toContain("in Manila");
    expect(mentorship.directoryUrl).not.toContain("city=");
  });

  it("carries settingsUrl into the model for the footer preferences link", () => {
    const model = buildDigestModel(makeInput({ events: [makeEvent()] }));
    expect(model).not.toBeNull();
    expect(model!.settingsUrl).toBe(SETTINGS_URL);
  });
});

describe("digestHighlight", () => {
  it("leads with a named batchmate when that section is present", () => {
    const model = buildDigestModel(
      makeInput({
        peers: [
          makePeer({
            displayName: "Sophia Villanueva",
            slug: "sophia-villanueva",
            verifiedAt: NOW - DAY_MS,
          }),
          makePeer({
            displayName: "Marco Reyes",
            slug: "marco-reyes",
            createdAt: NOW - 2 * DAY_MS,
          }),
        ],
      }),
    )!;
    const highlight = digestHighlight(model);
    expect(highlight).toContain("Sophia Villanueva");
    expect(highlight).toContain("1 more from your batch");
  });

  it("does not say 'and more' when exactly one batchmate is highlighted", () => {
    const model = buildDigestModel(
      makeInput({
        peers: [
          makePeer({
            displayName: "Sophia Villanueva",
            slug: "sophia-villanueva",
            verifiedAt: NOW - DAY_MS,
          }),
        ],
      }),
    )!;
    const highlight = digestHighlight(model);
    expect(highlight).toBe("Sophia Villanueva from your batch");
    expect(highlight).not.toContain("and more");
  });

  it("falls back to the next non-empty section (event title)", () => {
    const model = buildDigestModel(makeInput({ events: [makeEvent()] }))!;
    expect(digestHighlight(model)).toBe("Grand Alumni Homecoming");
  });

  it("names the first matching job when jobs lead", () => {
    const model = buildDigestModel(makeInput({ jobs: [makeJob()] }))!;
    expect(digestHighlight(model)).toBe("Software Engineer at Acme PH");
  });
});

describe("privacy-hidden fields and section caps", () => {
  it("excludes a peer whose batch is privacy-hidden from both pools", () => {
    const model = buildDigestModel(
      makeInput({
        peers: [
          makePeer({
            batch: undefined, // tier-hidden from alumni viewers
            createdAt: NOW - DAY_MS,
            openTo: ["mentorship"],
          }),
        ],
      }),
    );
    expect(model).toBeNull();
  });

  it("keeps a recent joiner in batchmates when only program/openTo are hidden", () => {
    const model = buildDigestModel(
      makeInput({
        peers: [
          makePeer({
            displayName: "Hidden Program Peer",
            slug: "hidden-program-peer",
            program: undefined,
            openTo: undefined,
            createdAt: NOW - DAY_MS,
          }),
        ],
      }),
    )!;
    expect(model.batchmates!.items[0].name).toBe("Hidden Program Peer");
    expect(model.mentorship).toBeNull();
  });

  it("caps batchmate items at 5, newest first", () => {
    const peers = Array.from({ length: 7 }, (_, i) =>
      makePeer({
        displayName: `Peer ${i}`,
        slug: `peer-${i}`,
        createdAt: NOW - (i + 1) * 60_000,
      }),
    );
    const model = buildDigestModel(makeInput({ peers }))!;
    const names = model.batchmates!.items.map((i) => i.name);
    expect(names).toEqual(["Peer 0", "Peer 1", "Peer 2", "Peer 3", "Peer 4"]);
  });

  it("caps the jobs section at 3", () => {
    const jobs = Array.from({ length: 4 }, (_, i) =>
      makeJob({ id: `job-${i}`, title: `Role ${i}` }),
    );
    const model = buildDigestModel(makeInput({ jobs }))!;
    expect(model.jobs!.items).toHaveLength(3);
  });

  it("treats empty targeting arrays as no restriction", () => {
    const model = buildDigestModel(
      makeInput({
        jobs: [makeJob({ targetingBatches: [], targetingPrograms: [] })],
      }),
    )!;
    expect(model.jobs!.items[0].title).toBe("Software Engineer");
  });

  it("never builds a phantom city pool when the recipient has no city", () => {
    const model = buildDigestModel(
      makeInput({
        recipient: { ...recipient, city: undefined },
        peers: [
          makePeer({
            displayName: "No City Peer",
            slug: "no-city-peer",
            city: undefined,
            openTo: ["mentorship"],
          }),
          makePeer({
            displayName: "Cebu Peer",
            slug: "cebu-peer",
            city: "Cebu",
            openTo: ["mentorship"],
          }),
        ],
      }),
    )!;
    const mentorship = model.mentorship!;
    expect(mentorship.headline).toContain("2 ");
    expect(mentorship.headline).not.toContain(" in ");
    expect(mentorship.directoryUrl).not.toContain("city=");
  });
});
