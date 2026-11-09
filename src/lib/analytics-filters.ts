/**
 * Admin analytics filters (company, colleges, date range), shared by the
 * Analytics page, the record lists its KPI quick links open, and the
 * Dashboard's hiring window.
 *
 * Stored with the standard `useUrlFilters` keys (company, college, from, to —
 * colleges comma-joined), so they live in the URL, persist for the session,
 * and "back to Analytics" restores the slice. Defaults are omitted.
 *
 * Data-agnostic: records are the live `api.adminData.applicationRecords` rows;
 * company / college values are plain strings (unknown values match nothing).
 */

import type { ApplicationRecord } from "../../convex/adminData";
import { joinList, splitList } from "@/lib/use-url-filters";

/** One application row — the live `api.adminData.applicationRecords` shape. */
export type AnalyticsRecord = ApplicationRecord;

// Performance goals — what "good" looks like, so KPIs read against a benchmark.
export const TARGET_HIRE_RATE = 0.25;
export const TARGET_TIME_TO_HIRE = 21;

export const ANALYTICS_FILTER_KEYS = ["company", "college", "from", "to"] as const;
export type AnalyticsFilterValues = Record<(typeof ANALYTICS_FILTER_KEYS)[number], string>;

export type AnalyticsFilters = {
  company: string; // "all" or a company name
  colleges: string[]; // full taxonomy college names
  from: string; // YYYY-MM-DD
  to: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function localIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Default window start: the 1st of the month five months before today (6 calendar months). */
export function defaultFrom(now: Date = new Date()): string {
  return localIso(new Date(now.getFullYear(), now.getMonth() - 5, 1));
}

/** Default window end: today. */
export function defaultTo(now: Date = new Date()): string {
  return localIso(now);
}

export function defaultFilters(): AnalyticsFilters {
  return { company: "all", colleges: [], from: defaultFrom(), to: defaultTo() };
}

function isValidIsoDate(d: string | null | undefined): d is string {
  if (!d || !ISO_DATE.test(d)) return false;
  const t = new Date(d + "T00:00:00Z");
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

/** Parse raw filter values; malformed dates fall back to the default window. */
export function parseAnalyticsFilters(raw: {
  get(key: string): string | null | undefined;
}): AnalyticsFilters {
  const dFrom = defaultFrom();
  const dTo = defaultTo();
  const company = raw.get("company")?.trim();
  const rawFrom = raw.get("from");
  const rawTo = raw.get("to");
  const f: AnalyticsFilters = {
    company: company ? company : "all",
    colleges: splitList(raw.get("college") ?? "").map((c) => c.trim()).filter(Boolean),
    from: isValidIsoDate(rawFrom) ? rawFrom : dFrom,
    to: isValidIsoDate(rawTo) ? rawTo : dTo,
  };
  if (f.from > f.to) return { ...f, from: dFrom, to: dTo };
  return f;
}

/** Filters → raw values for the URL (defaults become empty = omitted). */
export function toAnalyticsValues(f: AnalyticsFilters): AnalyticsFilterValues {
  return {
    company: f.company === "all" ? "" : f.company,
    college: joinList(f.colleges),
    from: f.from === defaultFrom() ? "" : f.from,
    to: f.to === defaultTo() ? "" : f.to,
  };
}

export function isDefaultFilters(f: AnalyticsFilters): boolean {
  return Object.values(toAnalyticsValues(f)).every((v) => !v);
}

export function applyFilters<R extends AnalyticsRecord>(records: readonly R[], f: AnalyticsFilters): R[] {
  return records.filter((r) => {
    if (f.company !== "all" && r.company !== f.company) return false;
    if (f.colleges.length && !f.colleges.includes(r.college)) return false;
    if (r.appliedAt < f.from || r.appliedAt > f.to) return false;
    return true;
  });
}

/** Company name → employer org id, from the records themselves (drill-down links). */
export function employerIdForCompany(
  records: readonly Pick<AnalyticsRecord, "company" | "employerOrgId">[],
  name: string,
): string | null {
  return records.find((r) => r.company === name)?.employerOrgId ?? null;
}
