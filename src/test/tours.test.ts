import { describe, it, expect } from "vitest";
import { TOURS, tourForPath } from "@/lib/guide/tours";

describe("tourForPath", () => {
  it("matches an exact route", () => {
    expect(tourForPath("/admin/users")?.label).toBe("Managing accounts");
    expect(tourForPath("/feed")?.label).toBe("Your home feed");
  });

  it("gives the roster the roster tour, not the record tour", () => {
    // /admin/alumni/* would otherwise also match /admin/alumni, and a prefix
    // beating an exact match put the single-record tour on the whole roster.
    expect(tourForPath("/admin/alumni")?.label).toBe("The alumni roster");
  });

  it("gives an individual record the record tour", () => {
    expect(tourForPath("/admin/alumni/mx749x0hhbxdrp70069c8xw0898f9ahf")?.label).toBe(
      "An alumnus record",
    );
  });

  it("does not let a prefix route claim an excluded sibling", () => {
    // /admin/alumni/approvals is a different screen, so it must not get the
    // single-record tour talking about an employment-status override. It has
    // a tour of its own; the point is that it is not the record one.
    const tour = tourForPath("/admin/alumni/approvals");
    expect(tour?.label).toBe("Approving registrations");
    expect(tour?.label).not.toBe("An alumnus record");

    const onboard = tourForPath("/admin/employers/onboard");
    expect(onboard?.label).not.toBe("An employer record");
  });

  it("returns null for a path with no tour", () => {
    expect(tourForPath("/nonsense")).toBeNull();
    expect(tourForPath("/admin")).toBeNull();
  });
});

describe("tour content", () => {
  it("every tour has a label, a route and at least one step", () => {
    for (const tour of TOURS) {
      expect(tour.route, JSON.stringify(tour)).toBeTruthy();
      expect(tour.label, tour.route).toBeTruthy();
      expect(tour.steps.length, tour.route).toBeGreaterThan(0);
    }
  });

  it("every step has a title and a body", () => {
    for (const tour of TOURS) {
      for (const step of tour.steps) {
        expect(step.title, `${tour.route}: ${JSON.stringify(step)}`).toBeTruthy();
        expect(step.body, `${tour.route}: ${step.title}`).toBeTruthy();
      }
    }
  });

  it("keeps step bodies short enough for a tooltip", () => {
    // Anything longer belongs in the written guide, which the last step links
    // to. This is the rule that stops tours drifting back into documentation.
    for (const tour of TOURS) {
      for (const step of tour.steps) {
        expect(
          step.body.length,
          `${tour.route} / "${step.title}" is ${step.body.length} chars`,
        ).toBeLessThanOrEqual(220);
      }
    }
  });

  it("has no duplicate routes", () => {
    const routes = TOURS.map((t) => t.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("covers the features added after the written guide was authored", () => {
    const text = JSON.stringify(TOURS).toLowerCase();
    expect(text).toContain("interview");
    expect(text).toContain("employment history");
    expect(text).toContain("audit log");
    expect(text).toContain("social links");
  });
});
