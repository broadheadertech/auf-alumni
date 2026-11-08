import { describe, it, expect } from "vitest";
import {
  formatPeriod,
  parseLegacyPeriod,
  normalizeEntry,
  tenureMonths,
  earliestStart,
} from "../helpers/experience";

const DASH = "–";

describe("parseLegacyPeriod", () => {
  it("parses the seeded 'YYYY - YYYY' shape", () => {
    expect(parseLegacyPeriod("2020 – 2023")).toEqual({
      startYear: 2020,
      startMonth: undefined,
      endYear: 2023,
      endMonth: undefined,
    });
  });

  it("treats Present as an open-ended entry", () => {
    expect(parseLegacyPeriod("2017 – Present")).toEqual({
      startYear: 2017,
      startMonth: undefined,
      current: true,
    });
  });

  it("accepts hyphen, em-dash and the word 'to'", () => {
    for (const sep of ["-", "—", "to"]) {
      const parsed = parseLegacyPeriod(`2019 ${sep} 2021`);
      expect(parsed?.startYear).toBe(2019);
      expect(parsed?.endYear).toBe(2021);
    }
  });

  it("reads month names when present", () => {
    expect(parseLegacyPeriod("March 2020 – Sep 2021")).toEqual({
      startYear: 2020,
      startMonth: 3,
      endYear: 2021,
      endMonth: 9,
    });
  });

  it("handles a bare year", () => {
    expect(parseLegacyPeriod("2015")).toEqual({
      startYear: 2015,
      startMonth: undefined,
    });
  });

  it("returns null rather than inventing a date", () => {
    expect(parseLegacyPeriod("a while ago")).toBeNull();
    expect(parseLegacyPeriod("")).toBeNull();
    expect(parseLegacyPeriod(undefined)).toBeNull();
  });
});

describe("formatPeriod", () => {
  it("renders year-only ranges", () => {
    expect(formatPeriod({ startYear: 2020, endYear: 2023 })).toBe(
      `2020 ${DASH} 2023`,
    );
  });

  it("renders month + year when the month is known", () => {
    expect(
      formatPeriod({ startYear: 2020, startMonth: 3, endYear: 2021, endMonth: 9 }),
    ).toBe(`Mar 2020 ${DASH} Sep 2021`);
  });

  it("renders Present for a current role", () => {
    expect(formatPeriod({ startYear: 2022, startMonth: 6, current: true })).toBe(
      `Jun 2022 ${DASH} Present`,
    );
  });

  it("falls back to the original text when nothing parsed", () => {
    expect(formatPeriod({ years: "sometime in the 90s" })).toBe(
      "sometime in the 90s",
    );
  });
});

describe("normalizeEntry", () => {
  it("recomputes a years label that disagrees with the dates", () => {
    const out = normalizeEntry({
      role: "Engineer",
      company: "Globe",
      // A client could post a label that contradicts the structured fields.
      years: "1999 – 2001",
      startYear: 2022,
      startMonth: 1,
      current: true,
    });
    expect(out.years).toBe(`Jan 2022 ${DASH} Present`);
  });

  it("drops the end date when the entry is marked current", () => {
    const out = normalizeEntry({
      role: "Analyst",
      company: "TaskUs",
      years: "",
      startYear: 2021,
      endYear: 2023,
      current: true,
    });
    expect(out.endYear).toBeUndefined();
    expect(out.years).toBe(`2021 ${DASH} Present`);
  });

  it("discards an out-of-range month", () => {
    const out = normalizeEntry({
      role: "Officer",
      company: "Clark",
      years: "",
      startYear: 2020,
      startMonth: 13,
    });
    expect(out.startMonth).toBeUndefined();
    expect(out.years).toBe("2020");
  });

  it("keeps unparsed legacy text instead of blanking it", () => {
    const out = normalizeEntry({
      role: "Volunteer",
      company: "Red Cross",
      years: "summers, on and off",
    });
    expect(out.years).toBe("summers, on and off");
  });
});

describe("tenureMonths", () => {
  const asOf = Date.UTC(2025, 5, 15); // June 2025

  it("measures a closed range", () => {
    expect(
      tenureMonths(
        { role: "r", company: "c", years: "", startYear: 2020, startMonth: 1, endYear: 2021, endMonth: 7 },
        asOf,
      ),
    ).toBe(18);
  });

  it("measures an open range up to asOf", () => {
    expect(
      tenureMonths(
        { role: "r", company: "c", years: "", startYear: 2024, startMonth: 6, current: true },
        asOf,
      ),
    ).toBe(12);
  });

  it("returns null without a start", () => {
    expect(tenureMonths({ role: "r", company: "c", years: "ages" }, asOf)).toBeNull();
  });
});

describe("earliestStart", () => {
  it("finds the earliest dated entry and ignores undated ones", () => {
    expect(
      earliestStart([
        { role: "r", company: "c", years: "", startYear: 2022, startMonth: 3 },
        { role: "r", company: "c", years: "undated" },
        { role: "r", company: "c", years: "", startYear: 2019, startMonth: 11 },
      ]),
    ).toEqual({ year: 2019, month: 11 });
  });

  it("returns null when nothing is dated", () => {
    expect(earliestStart([{ role: "r", company: "c", years: "undated" }])).toBeNull();
  });
});
