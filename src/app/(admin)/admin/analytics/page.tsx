"use client";

/**
 * Analytics — the single admin analytics surface (merges the former "Analytics"
 * and "Job analytics" pages).
 *
 * Network overview + hiring marketplace performance, sliceable by company,
 * college, and date. Beyond the descriptive charts it adds a decision layer:
 *   • period-over-period deltas + targets on the hiring KPIs
 *   • an auto-generated insights strip
 *   • hardest-to-fill postings (not just the most popular)
 *   • supply vs demand (open-to-work alumni, open roles, applicants-per-hire)
 *   • quick links — every KPI tile has "View list", opening the records behind
 *     the number with the current filters carried over (filters live in the URL)
 *
 * Live data: application rows from `api.adminData.applicationRecords`, network
 * counts from `api.adminData.overview`, college chips from the taxonomy tables
 * — the same sources as the Dashboard and the record lists.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Clock,
  Download,
  Lightbulb,
  TrendingUp,
  Users,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { useAsOf } from "@/lib/use-as-of";
import { APPLICATION_STAGES, STAGE_LABEL } from "@/lib/mock-admin";
import {
  ANALYTICS_FILTER_KEYS,
  TARGET_HIRE_RATE,
  TARGET_TIME_TO_HIRE,
  applyFilters,
  defaultFrom,
  defaultTo,
  employerIdForCompany,
  isDefaultFilters,
  parseAnalyticsFilters,
  toAnalyticsValues,
  type AnalyticsRecord,
} from "@/lib/analytics-filters";
import { useCollegePrograms } from "@/lib/use-program-options";
import { joinList, quickLink, useUrlFilters } from "@/lib/use-url-filters";
import { SectionHeading } from "@/components/auf/admin-ui";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09" → "Sep" (or "Sep '26" when the range spans years). */
function monthLabel(key: string, withYear = false) {
  const [y, m] = key.split("-");
  const abbr = MONTH_ABBR[Number(m) - 1] ?? key;
  return withYear ? `${abbr} '${y.slice(2)}` : abbr;
}

/** Every "YYYY-MM" from the month of `from` through the month of `to`. */
function monthKeysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  // Guard against absurd ranges (e.g. a hand-typed year 1900) — cap at 10 years.
  while ((y < endY || (y === endY && m <= endM)) && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function shortCollege(name: string) {
  return name.replace("College of ", "");
}

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Equal-length window immediately preceding [from, to]. */
function priorRange(from: string, to: string) {
  const day = 86_400_000;
  const f = new Date(from + "T00:00:00Z").getTime();
  const t = new Date(to + "T00:00:00Z").getTime();
  const len = t - f;
  const pto = new Date(f - day).toISOString().slice(0, 10);
  const pfrom = new Date(f - day - len).toISOString().slice(0, 10);
  return { pfrom, pto };
}

const NO_RECORDS: AnalyticsRecord[] = [];

export default function AdminAnalyticsPage() {
  const recordsQ = useQuery(api.adminData.applicationRecords);
  const asOf = useAsOf();
  const overviewQ = useQuery(api.adminData.overview, { asOf });
  const taxonomy = useCollegePrograms();
  const records = recordsQ ?? NO_RECORDS;
  const loading = recordsQ === undefined || overviewQ === undefined;

  // Filters live in the URL and persist for the session (standard list filters).
  const { values, set, reset } = useUrlFilters("admin-analytics", ANALYTICS_FILTER_KEYS);
  const filters = useMemo(
    () => parseAnalyticsFilters({ get: (k) => values[k as keyof typeof values] }),
    [values],
  );
  const { company, colleges, from, to } = filters;
  const setCompany = (v: string) => set("company", v === "all" ? "" : v);
  const setColleges = (next: string[] | ((prev: string[]) => string[])) =>
    set("college", joinList(typeof next === "function" ? next(colleges) : next));
  const setFrom = (v: string) => set("from", v === defaultFrom() ? "" : v);
  const setTo = (v: string) => set("to", v === defaultTo() ? "" : v);

  // Company dropdown: every employer that appears in the application data
  // (plus the selected one, so a URL value never renders as blank).
  const companyOptions = useMemo(() => {
    const names = new Set(records.map((r) => r.company).filter((c) => c && c !== "—"));
    if (company !== "all") names.add(company);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [records, company]);

  // College chips: taxonomy colleges, plus any selected value not in it (so it can be cleared).
  const collegeChips = useMemo(() => {
    const chips = taxonomy.colleges.map((c) => ({
      name: c.name,
      label: c.shortName || shortCollege(c.name),
    }));
    const known = new Set(chips.map((c) => c.name));
    for (const c of colleges) {
      if (!known.has(c)) chips.push({ name: c, label: shortCollege(c) });
    }
    return chips;
  }, [taxonomy.colleges, colleges]);

  // Quick-link targets for each KPI tile — each opens exactly this slice.
  const links = useMemo(() => {
    const employerId = company !== "all" ? employerIdForCompany(records, company) : null;
    const recordsLink = (view: string) =>
      quickLink("/admin/analytics/applications", { ...toAnalyticsValues(filters), view });
    return {
      // The roster filters by a single college; pass it through when exactly one is picked.
      alumni: quickLink("/admin/alumni", { college: colleges.length === 1 ? colleges[0] : "" }),
      employers: employerId ? `/admin/employers/${employerId}` : "/admin/employers",
      postings: quickLink("/admin/jobs", { status: "published", employer: employerId ?? "" }),
      hireRate: recordsLink("hire-rate"),
      applications: recordsLink("applications"),
      hires: recordsLink("hires"),
      timeToHire: recordsLink("time-to-hire"),
    };
  }, [filters, company, colleges, records]);

  const current = useMemo(() => applyFilters(records, filters), [records, filters]);
  const { pfrom, pto } = useMemo(() => priorRange(from, to), [from, to]);
  const prior = useMemo(
    () => applyFilters(records, { company, colleges, from: pfrom, to: pto }),
    [records, company, colleges, pfrom, pto],
  );

  const m = useMemo(() => metrics(current, from, to), [current, from, to]);
  const pm = useMemo(() => metrics(prior, pfrom, pto), [prior, pfrom, pto]);

  const overview = useMemo(
    () => ({
      alumniRegistered: overviewQ?.alumniRegistered ?? 0,
      alumniTotal: overviewQ?.alumniPopulation ?? 0,
      activeEmployers: overviewQ?.activeEmployers ?? 0,
      openPostings: overviewQ?.publishedPostings ?? 0,
      openToWork: overviewQ?.openToWork ?? 0,
    }),
    [overviewQ],
  );

  const insights = useMemo(
    () => (loading ? [] : buildInsights(m, pm, overview, to)),
    [loading, m, pm, overview, to],
  );

  const toggleCollege = (c: string) =>
    setColleges((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const filtersActive = !isDefaultFilters(filters);

  const hasPrior = pm.total > 0;
  const maxMonth = Math.max(1, ...m.monthly.map((x) => x.apps));
  const multiYear = from.slice(0, 4) !== to.slice(0, 4);

  const exportCompanies = () => {
    downloadCsv(
      "auf-hiring-by-company.csv",
      ["Company", "Applications", "Hires", "Hire rate %", "Avg days to hire"],
      m.byCompany.map((c) => [c.label, c.apps, c.hires, (c.rate * 100).toFixed(1), c.avgDays ?? ""]),
    );
    toast.success("Company hiring report exported");
  };

  const asOfLabel = overviewQ
    ? new Date(overviewQ.asOf).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCompanies}
          disabled={loading || m.byCompany.length === 0}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Network and hiring-marketplace performance. Slice by company, college, or
        date — KPIs compare against the previous equal period.
      </p>

      {/* Filters */}
      <Card className="mt-5">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[200px_1fr]">
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                Company
              </Label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              >
                <option value="all">All companies</option>
                {companyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                  From
                </Label>
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                  To
                </Label>
                <input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
              College
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {!taxonomy.ready && collegeChips.length === 0 ? (
                <span className="text-xs text-muted-foreground">Loading colleges…</span>
              ) : collegeChips.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No colleges in the taxonomy yet.
                </span>
              ) : (
                collegeChips.map((c) => {
                  const on = colleges.includes(c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => toggleCollege(c.name)}
                      aria-pressed={on}
                      title={c.name}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })
              )}
            </div>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-muted-foreground"
                onClick={reset}
              >
                Reset filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {/*
            Network size is context, not performance: it does not move with
            the date filter and nothing on this page is measured against it.
            It reads as a line of supporting figures so the four time-bound
            KPIs below can carry the page.

            It also fixes an alignment bug. These two blocks used to be
            grid-cols-3 above grid-cols-4, so the tiles in one row never lined
            up with the tiles in the other.
          */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
            <Link href={links.alumni} className="hover:text-foreground">
              <span className="font-medium tabular-nums text-foreground">
                {overview.alumniRegistered.toLocaleString()}
              </span>{" "}
              alumni registered
              <span className="text-muted-foreground/70">
                {" "}of ~{overview.alumniTotal.toLocaleString()}
              </span>
            </Link>
            <span aria-hidden className="text-border">|</span>
            <Link href={links.employers} className="hover:text-foreground">
              <span className="font-medium tabular-nums text-foreground">
                {overview.activeEmployers}
              </span>{" "}
              active employers
            </Link>
            <span aria-hidden className="text-border">|</span>
            <Link href={links.postings} className="hover:text-foreground">
              <span className="font-medium tabular-nums text-foreground">
                {overview.openPostings}
              </span>{" "}
              open postings
            </Link>
          </div>

          <SectionHeading className="mt-5">Hiring performance</SectionHeading>
          <div data-tour="analytics-kpis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={TrendingUp}
              label="Hire rate"
              value={`${(m.hireRate * 100).toFixed(1)}%`}
              accent
              delta={hasPrior ? ppDelta(m.hireRate, pm.hireRate) : null}
              target={{ met: m.hireRate >= TARGET_HIRE_RATE, text: `target ${(TARGET_HIRE_RATE * 100).toFixed(0)}%` }}
              href={links.hireRate}
            />
            <Kpi
              icon={Users}
              label="Applications"
              value={m.total.toLocaleString()}
              delta={hasPrior ? pctDelta(m.total, pm.total) : null}
              href={links.applications}
            />
            <Kpi
              icon={Award}
              label="Hires"
              value={m.hires.toLocaleString()}
              delta={hasPrior ? pctDelta(m.hires, pm.hires) : null}
              href={links.hires}
            />
            <Kpi
              icon={Clock}
              label="Avg time to hire"
              value={m.avgTime != null ? `${m.avgTime}d` : "—"}
              delta={hasPrior && m.avgTime != null && pm.avgTime != null ? dayDelta(m.avgTime, pm.avgTime) : null}
              target={m.avgTime != null ? { met: m.avgTime <= TARGET_TIME_TO_HIRE, text: `target ${TARGET_TIME_TO_HIRE}d` } : undefined}
              href={links.timeToHire}
            />
          </div>
          {!hasPrior && records.length > 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              No applications in the previous equal period ({pfrom} – {pto}), so
              there is nothing to compare against.
            </p>
          )}

          {/* Insights strip */}
          {insights.length > 0 && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-medium">Insights</h2>
                </div>
                <ul className="mt-3 space-y-2">
                  {insights.map((ins, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          ins.tone === "good"
                            ? "bg-emerald-500"
                            : ins.tone === "warn"
                              ? "bg-amber-500"
                              : "bg-muted-foreground/50",
                        )}
                      />
                      <span>{ins.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {records.length === 0 ? (
            <Card className="mt-4">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">No applications yet</p>
                <p className="mt-1">
                  Hiring analytics will appear here once alumni start applying to
                  published job postings.
                </p>
              </CardContent>
            </Card>
          ) : m.total === 0 ? (
            <Card className="mt-4">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                No applications match these filters.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Trend */}
              <Card className="mt-4">
                <CardContent className="p-4">
                  <h2 className="text-sm font-medium">Applications &amp; hiring rate by month</h2>
                  <div className="overflow-x-auto">
                    <div className="mt-4 flex min-w-fit items-end gap-3 sm:gap-6">
                      {m.monthly.map((mo) => (
                        <div key={mo.key} className="flex min-w-10 flex-1 flex-col items-center gap-1.5">
                          <div className="text-[11px] font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                            {mo.apps > 0 ? `${(mo.rate * 100).toFixed(0)}%` : "—"}
                          </div>
                          <div className="flex h-28 w-full items-end justify-center">
                            <div
                              className="relative w-7 sm:w-10 rounded-t bg-foreground/15"
                              style={{ height: `${(mo.apps / maxMonth) * 100}%` }}
                            >
                              <div
                                className="absolute bottom-0 w-full rounded-t bg-emerald-500"
                                style={{ height: `${mo.apps ? (mo.hires / mo.apps) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-[11px] tabular-nums text-muted-foreground">{mo.apps}</div>
                          <div className="whitespace-nowrap text-[11px] text-muted-foreground">
                            {monthLabel(mo.key, multiYear)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                    <Legend className="bg-foreground/15" label="Applications" />
                    <Legend className="bg-emerald-500" label="Hires" />
                    <span>· % = hiring rate</span>
                  </div>
                </CardContent>
              </Card>

              {/* Funnel + conversion */}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Panel title="Pipeline funnel">
                  {APPLICATION_STAGES.map((s) => (
                    <BarRow key={s} label={STAGE_LABEL[s]} value={m.funnel[s] ?? 0} pct={(m.funnel[s] ?? 0) / m.total} tone={s === "hired" ? "emerald" : "neutral"} />
                  ))}
                </Panel>
                <Panel title="Stage conversion">
                  <Conversion label="Application → Interview" value={m.conv.toInterview} />
                  <Conversion label="Interview → Offer" value={m.conv.interviewToOffer} />
                  <Conversion label="Offer → Hire" value={m.conv.offerToHire} />
                </Panel>
              </div>

              {/* Top postings + top companies */}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Panel title="Top postings by applicants" subtitle="Most applications received">
                  {m.topPostings.map((p, i) => (
                    <RankRow key={p.key} rank={i + 1} label={p.title} meta={p.company} value={p.apps} sub={`${p.hires} hired`} pct={p.apps / m.maxPostingApps} />
                  ))}
                </Panel>
                <Panel title="Companies that hire the most" subtitle="Ranked by total hires">
                  {m.topCompaniesByHires.map((c, i) => (
                    <RankRow key={c.label} rank={i + 1} label={c.label} value={c.hires} sub={`${(c.rate * 100).toFixed(0)}% of ${c.apps}`} pct={c.hires / m.maxCompanyHires} tone="emerald" />
                  ))}
                </Panel>
              </div>

              {/* Hardest-to-fill + supply/demand */}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Panel title="Hardest-to-fill postings" subtitle="Lowest hire rate (min. 3 applicants)">
                  {m.hardestPostings.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No posting has 3+ applicants in this slice yet.
                    </p>
                  ) : (
                    m.hardestPostings.map((p) => (
                      <BarRow
                        key={p.key}
                        label={`${p.title} · ${p.company}`}
                        value={`${(p.rate * 100).toFixed(0)}%`}
                        sub={`${p.hires}/${p.apps}`}
                        pct={p.rate}
                        tone="amber"
                      />
                    ))
                  )}
                </Panel>
                <Panel
                  title="Supply &amp; demand"
                  subtitle={`${overview.openToWork} open to work · ${overview.openPostings} open roles`}
                >
                  <p className="mb-1 text-[11px] text-muted-foreground">
                    Applicants per hire by college — higher means more competition /
                    oversupply.
                  </p>
                  {m.byCollege.map((c) => (
                    <BarRow
                      key={c.label}
                      label={c.label}
                      value={c.hires > 0 ? `${Math.round(c.apps / c.hires)}:1` : "no hire"}
                      pct={
                        c.hires > 0
                          ? Math.round(c.apps / c.hires) / m.maxAppsPerHire
                          : 1
                      }
                      tone={c.hires > 0 && c.apps / c.hires > 6 ? "amber" : "neutral"}
                    />
                  ))}
                </Panel>
              </div>

              {/* By college */}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Panel title="Applications by college" subtitle="Where applicants studied">
                  {m.byCollege.map((c) => (
                    <BarRow key={c.label} label={c.label} value={c.apps} pct={c.apps / m.maxCollegeApps} />
                  ))}
                </Panel>
                <Panel title="Hire rate by college" subtitle="Which programs place best">
                  {[...m.byCollege]
                    .sort((a, b) => b.rate - a.rate)
                    .map((c) => (
                      <BarRow key={c.label} label={c.label} value={`${(c.rate * 100).toFixed(0)}%`} sub={`${c.hires}/${c.apps}`} pct={c.rate} tone="emerald" />
                    ))}
                </Panel>
              </div>

              {/* Fastest hiring */}
              <div className="mt-4">
                <Panel title="Fastest-hiring companies" subtitle="Avg days from application to hire (lower is better)">
                  {m.byCompany.some((c) => c.avgDays != null) ? (
                    m.byCompany
                      .filter((c) => c.avgDays != null)
                      .sort((a, b) => (a.avgDays ?? 0) - (b.avgDays ?? 0))
                      .map((c) => (
                        <BarRow key={c.label} label={c.label} value={`${c.avgDays}d`} sub={`${c.hires} hires`} pct={1 - (c.avgDays ?? 0) / m.maxAvgDays} />
                      ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No hires in this slice yet.</p>
                  )}
                </Panel>
              </div>
            </>
          )}

          <p className="mt-4 text-xs italic text-muted-foreground">
            Live data: {records.length.toLocaleString()} application record
            {records.length === 1 ? "" : "s"} in total, {m.total.toLocaleString()} in
            this slice. Overview counts{asOfLabel ? ` as of ${asOfLabel}` : ""}; alumni
            population is the registrar&apos;s estimate. Targets are illustrative.
          </p>
        </>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading analytics…</span>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="mt-4 h-52 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

// ----------------------------------------------------------- deltas ---

type Delta = { text: string; good: boolean };

function pctDelta(cur: number, prior: number): Delta | null {
  if (prior === 0) return null;
  const pct = ((cur - prior) / prior) * 100;
  return { text: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`, good: pct >= 0 };
}
function ppDelta(cur: number, prior: number): Delta {
  const pp = (cur - prior) * 100;
  return { text: `${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp`, good: pp >= 0 };
}
function dayDelta(cur: number, prior: number): Delta {
  const diff = cur - prior;
  return { text: `${diff >= 0 ? "+" : ""}${diff}d`, good: diff <= 0 };
}

// ----------------------------------------------------------- insights ---

type Insight = { tone: "good" | "warn" | "neutral"; text: string };

function buildInsights(
  m: ReturnType<typeof metrics>,
  pm: ReturnType<typeof metrics>,
  overview: { openToWork: number; openPostings: number },
  to: string,
): Insight[] {
  const out: Insight[] = [];
  if (m.total === 0) return out;

  // Month-over-month trend (the last bucket may be a partial month)
  if (m.monthly.length >= 2) {
    const last = m.monthly[m.monthly.length - 1];
    const prev = m.monthly[m.monthly.length - 2];
    if (prev.apps > 0) {
      const pct = Math.round(((last.apps - prev.apps) / prev.apps) * 100);
      const [y, mo] = last.key.split("-").map(Number);
      const lastDay = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
      const partial = to < lastDay;
      out.push({
        tone: pct < -15 && !partial ? "warn" : "neutral",
        text: `Applications ${pct >= 0 ? "rose" : "fell"} ${Math.abs(pct)}% in ${monthLabel(last.key)}${partial ? " (month to date)" : ""} vs ${monthLabel(prev.key)}.`,
      });
    }
  }

  // Hire rate vs target
  out.push({
    tone: m.hireRate >= TARGET_HIRE_RATE ? "good" : "warn",
    text:
      m.hireRate >= TARGET_HIRE_RATE
        ? `Hire rate ${(m.hireRate * 100).toFixed(0)}% is meeting the ${(TARGET_HIRE_RATE * 100).toFixed(0)}% goal.`
        : `Hire rate ${(m.hireRate * 100).toFixed(0)}% is below the ${(TARGET_HIRE_RATE * 100).toFixed(0)}% goal.`,
  });

  // Biggest funnel leak
  const stages: { label: string; v: number }[] = [
    { label: "application→interview", v: m.conv.toInterview },
    { label: "interview→offer", v: m.conv.interviewToOffer },
    { label: "offer→hire", v: m.conv.offerToHire },
  ];
  const weakest = stages.reduce((a, b) => (b.v < a.v ? b : a));
  out.push({
    tone: "warn",
    text: `Biggest funnel leak: ${weakest.label} — only ${(weakest.v * 100).toFixed(0)}% convert.`,
  });

  // Best / worst college
  if (m.byCollege.length >= 2) {
    const sorted = [...m.byCollege].sort((a, b) => b.rate - a.rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    out.push({
      tone: "good",
      text: `Best-placing college: ${best.label} (${(best.rate * 100).toFixed(0)}%); lowest is ${worst.label} (${(worst.rate * 100).toFixed(0)}%).`,
    });
  }

  // Hardest-to-fill
  if (m.hardestPostings.length > 0) {
    const hard = m.hardestPostings.filter((p) => p.rate < TARGET_HIRE_RATE);
    if (hard.length > 0) {
      out.push({
        tone: "warn",
        text: `${hard.length} posting${hard.length === 1 ? " is" : "s are"} hard to fill (hire rate below goal despite 3+ applicants).`,
      });
    }
  }

  // Supply / demand
  out.push({
    tone: overview.openToWork > overview.openPostings ? "warn" : "neutral",
    text:
      overview.openToWork > overview.openPostings
        ? `Demand-constrained: ${overview.openToWork} alumni open to work vs ${overview.openPostings} open roles — more employer postings would help.`
        : `${overview.openPostings} open roles for ${overview.openToWork} actively-seeking alumni.`,
  });

  // Period delta call-out
  if (pm.total > 0) {
    const d = ppDelta(m.hireRate, pm.hireRate);
    out.push({
      tone: d.good ? "good" : "warn",
      text: `Hire rate ${d.good ? "improved" : "declined"} ${d.text} versus the previous period.`,
    });
  }

  return out;
}

// ----------------------------------------------------------- aggregation ---

function metrics(recs: AnalyticsRecord[], from: string, to: string) {
  const total = recs.length;
  const hires = recs.filter((r) => r.hired).length;
  const hireRate = total ? hires / total : 0;

  const funnel = Object.fromEntries(
    APPLICATION_STAGES.map((s) => [s, recs.filter((r) => r.stage === s).length]),
  ) as Record<string, number>;

  const reachedInterview = recs.filter((r) => ["interview", "offered", "hired"].includes(r.stage)).length;
  const reachedOffer = recs.filter((r) => ["offered", "hired"].includes(r.stage)).length;
  const conv = {
    toInterview: total ? reachedInterview / total : 0,
    interviewToOffer: reachedInterview ? reachedOffer / reachedInterview : 0,
    offerToHire: reachedOffer ? hires / reachedOffer : 0,
  };

  const hiredTimes = recs.filter((r) => r.hired && r.timeToHireDays != null);
  const avgTime = hiredTimes.length
    ? Math.round(hiredTimes.reduce((s, r) => s + (r.timeToHireDays ?? 0), 0) / hiredTimes.length)
    : null;

  // Month buckets span the selected range (empty months included).
  const monthBuckets = new Map(
    monthKeysBetween(from, to).map((key) => [key, { apps: 0, hires: 0 }]),
  );
  for (const r of recs) {
    const b = monthBuckets.get(r.appliedAt.slice(0, 7));
    if (!b) continue;
    b.apps += 1;
    if (r.hired) b.hires += 1;
  }
  const monthly = [...monthBuckets.entries()].map(([key, b]) => ({
    key,
    apps: b.apps,
    hires: b.hires,
    rate: b.apps ? b.hires / b.apps : 0,
  }));

  // Postings (one bar per job)
  const postingMap = new Map<string, { title: string; company: string; apps: number; hires: number }>();
  for (const r of recs) {
    const key = r.jobId;
    const cur = postingMap.get(key) ?? { title: r.jobTitle, company: r.company, apps: 0, hires: 0 };
    cur.apps += 1;
    if (r.hired) cur.hires += 1;
    postingMap.set(key, cur);
  }
  const postings = [...postingMap.entries()].map(([key, v]) => ({ key, ...v, rate: v.apps ? v.hires / v.apps : 0 }));
  const topPostings = [...postings].sort((a, b) => b.apps - a.apps).slice(0, 8);
  const maxPostingApps = Math.max(1, ...topPostings.map((p) => p.apps));
  const hardestPostings = postings
    .filter((p) => p.apps >= 3)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 6);

  // Companies
  const companyMap = new Map<string, { apps: number; hires: number; days: number[] }>();
  for (const r of recs) {
    const cur = companyMap.get(r.company) ?? { apps: 0, hires: 0, days: [] };
    cur.apps += 1;
    if (r.hired) {
      cur.hires += 1;
      if (r.timeToHireDays != null) cur.days.push(r.timeToHireDays);
    }
    companyMap.set(r.company, cur);
  }
  const byCompany = [...companyMap.entries()].map(([label, v]) => ({
    label,
    apps: v.apps,
    hires: v.hires,
    rate: v.apps ? v.hires / v.apps : 0,
    avgDays: v.days.length ? Math.round(v.days.reduce((s, d) => s + d, 0) / v.days.length) : null,
  }));
  const topCompaniesByHires = [...byCompany].sort((a, b) => b.hires - a.hires);
  const maxCompanyHires = Math.max(1, ...byCompany.map((c) => c.hires));
  const maxAvgDays = Math.max(1, ...byCompany.map((c) => c.avgDays ?? 0));

  // Colleges
  const collegeMap = new Map<string, { apps: number; hires: number }>();
  for (const r of recs) {
    const k = shortCollege(r.college);
    const cur = collegeMap.get(k) ?? { apps: 0, hires: 0 };
    cur.apps += 1;
    if (r.hired) cur.hires += 1;
    collegeMap.set(k, cur);
  }
  const byCollege = [...collegeMap.entries()]
    .map(([label, v]) => ({ label, apps: v.apps, hires: v.hires, rate: v.apps ? v.hires / v.apps : 0 }))
    .sort((a, b) => b.apps - a.apps);
  const maxCollegeApps = Math.max(1, ...byCollege.map((c) => c.apps));
  const maxAppsPerHire = Math.max(
    1,
    ...byCollege.filter((c) => c.hires > 0).map((c) => Math.round(c.apps / c.hires)),
  );

  return {
    total,
    hires,
    hireRate,
    avgTime,
    funnel,
    conv,
    monthly,
    topPostings,
    maxPostingApps,
    hardestPostings,
    byCompany,
    topCompaniesByHires,
    maxCompanyHires,
    maxAvgDays,
    byCollege,
    maxCollegeApps,
    maxAppsPerHire,
  };
}

// ------------------------------------------------------------- primitives ---

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  delta,
  target,
  href,
  linkLabel = "View list",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  delta?: Delta | null;
  target?: { met: boolean; text: string };
  /** Quick link: the whole tile navigates here; "View list" marks it. */
  href?: string;
  linkLabel?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg px-4 py-3 ring-1 transition-colors",
        accent ? "bg-emerald-500/5 ring-emerald-500/30" : "bg-card ring-foreground/10",
        href && "group-hover:ring-foreground/30",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium",
              delta.good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
            )}
          >
            {delta.good ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta.text}
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
        {target && (
          <span
            className={cn(
              "ml-auto text-[11px]",
              target.met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {target.met ? "✓ " : ""}
            {target.text}
          </span>
        )}
      </div>
      {href && (
        <span className="mt-auto flex justify-end pt-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            {linkLabel}
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
      )}
    </div>
  );
  return href ? (
    <Link
      href={href}
      aria-label={`${label}: ${value}. ${linkLabel}`}
      className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="text-sm font-medium">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        <div className="mt-3 space-y-2">{children}</div>
      </CardContent>
    </Card>
  );
}

function BarRow({
  label,
  value,
  sub,
  pct,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  pct: number;
  tone?: "neutral" | "emerald" | "amber";
}) {
  const barTone =
    tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-foreground/30";
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">
          {value}
          {sub && <span className="ml-1 text-muted-foreground">{sub}</span>}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barTone)} style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }} />
      </div>
    </div>
  );
}

function RankRow({
  rank,
  label,
  meta,
  value,
  sub,
  pct,
  tone = "neutral",
}: {
  rank: number;
  label: string;
  meta?: string;
  value: React.ReactNode;
  sub?: string;
  pct: number;
  tone?: "neutral" | "emerald";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-4 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate">
            {label}
            {meta && <span className="text-muted-foreground"> · {meta}</span>}
          </span>
          <span className="shrink-0 font-medium tabular-nums">
            {value}
            {sub && <span className="ml-1 text-muted-foreground">{sub}</span>}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", tone === "emerald" ? "bg-emerald-500" : "bg-foreground/30")}
            style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Conversion({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, value * 100)}%` }} />
        </div>
        <span className="w-10 text-right text-xs font-medium tabular-nums">{(value * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", className)} />
      {label}
    </span>
  );
}
