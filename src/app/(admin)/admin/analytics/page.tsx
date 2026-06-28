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
 *
 * Mock-data prototype for stakeholder review — see lib/mock-admin.ts.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Briefcase,
  Building2,
  Clock,
  Download,
  Lightbulb,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  ALUMNAE,
  ALUMNI_POPULATION,
  ANALYTICS_DATE_MAX,
  ANALYTICS_DATE_MIN,
  APPLICATION_STAGES,
  COLLEGES,
  COMPANIES,
  EMPLOYERS,
  JOB_APPLICATIONS,
  STAGE_LABEL,
  fmtMonth,
  type College,
  type JobApplicationRecord,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Performance goals — what "good" looks like, so KPIs read against a benchmark.
const TARGET_HIRE_RATE = 0.25;
const TARGET_TIME_TO_HIRE = 21;

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

type Filters = { company: string; colleges: College[]; from: string; to: string };

function applyFilters(records: JobApplicationRecord[], f: Filters) {
  return records.filter((r) => {
    if (f.company !== "all" && r.company !== f.company) return false;
    if (f.colleges.length && !f.colleges.includes(r.college)) return false;
    if (r.appliedAt < f.from || r.appliedAt > f.to) return false;
    return true;
  });
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

export default function AdminAnalyticsPage() {
  const [company, setCompany] = useState("all");
  const [colleges, setColleges] = useState<College[]>([]);
  const [from, setFrom] = useState(ANALYTICS_DATE_MIN);
  const [to, setTo] = useState(ANALYTICS_DATE_MAX);

  const current = useMemo(
    () => applyFilters(JOB_APPLICATIONS, { company, colleges, from, to }),
    [company, colleges, from, to],
  );
  const prior = useMemo(() => {
    const { pfrom, pto } = priorRange(from, to);
    return applyFilters(JOB_APPLICATIONS, { company, colleges, from: pfrom, to: pto });
  }, [company, colleges, from, to]);

  const m = useMemo(() => metrics(current), [current]);
  const pm = useMemo(() => metrics(prior), [prior]);

  const overview = useMemo(
    () => ({
      alumniRegistered: ALUMNAE.length,
      alumniTotal: ALUMNI_POPULATION,
      activeEmployers: EMPLOYERS.filter((e) =>
        e.postings.some((p) => p.status === "published"),
      ).length,
      openPostings: EMPLOYERS.reduce(
        (s, e) => s + e.postings.filter((p) => p.status === "published").length,
        0,
      ),
      openToWork: ALUMNAE.filter((a) => a.openToWork).length,
    }),
    [],
  );

  const insights = useMemo(
    () => buildInsights(m, pm, overview),
    [m, pm, overview],
  );

  const toggleCollege = (c: College) =>
    setColleges((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const filtersActive =
    company !== "all" ||
    colleges.length > 0 ||
    from !== ANALYTICS_DATE_MIN ||
    to !== ANALYTICS_DATE_MAX;

  const hasPrior = pm.total > 0;
  const maxMonth = Math.max(1, ...m.monthly.map((x) => x.apps));

  const exportCompanies = () => {
    downloadCsv(
      "auf-hiring-by-company.csv",
      ["Company", "Applications", "Hires", "Hire rate %", "Avg days to hire"],
      m.byCompany.map((c) => [c.label, c.apps, c.hires, (c.rate * 100).toFixed(1), c.avgDays ?? ""]),
    );
    toast.success("Company hiring report exported");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        </div>
        <Button variant="outline" size="sm" onClick={exportCompanies}>
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
                {COMPANIES.map((c) => (
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
                  min={ANALYTICS_DATE_MIN}
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
                  max={ANALYTICS_DATE_MAX}
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
              {COLLEGES.map((c) => {
                const on = colleges.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCollege(c)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.replace("College of ", "")}
                  </button>
                );
              })}
            </div>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-muted-foreground"
                onClick={() => {
                  setCompany("all");
                  setColleges([]);
                  setFrom(ANALYTICS_DATE_MIN);
                  setTo(ANALYTICS_DATE_MAX);
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Network overview (not time-bound) */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi icon={Users} label="Alumni" value={overview.alumniRegistered.toString()} hint={`of ~${overview.alumniTotal.toLocaleString()}`} />
        <Kpi icon={Building2} label="Active employers" value={overview.activeEmployers.toString()} />
        <Kpi icon={Briefcase} label="Open postings" value={overview.openPostings.toString()} />
      </div>

      {/* Hiring KPIs with deltas + targets */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={TrendingUp}
          label="Hire rate"
          value={`${(m.hireRate * 100).toFixed(1)}%`}
          accent
          delta={hasPrior ? ppDelta(m.hireRate, pm.hireRate) : null}
          target={{ met: m.hireRate >= TARGET_HIRE_RATE, text: `target ${(TARGET_HIRE_RATE * 100).toFixed(0)}%` }}
        />
        <Kpi
          icon={Users}
          label="Applications"
          value={m.total.toLocaleString()}
          delta={hasPrior ? pctDelta(m.total, pm.total) : null}
        />
        <Kpi
          icon={Award}
          label="Hires"
          value={m.hires.toLocaleString()}
          delta={hasPrior ? pctDelta(m.hires, pm.hires) : null}
        />
        <Kpi
          icon={Clock}
          label="Avg time to hire"
          value={m.avgTime ? `${m.avgTime}d` : "—"}
          delta={hasPrior && m.avgTime != null && pm.avgTime != null ? dayDelta(m.avgTime, pm.avgTime) : null}
          target={m.avgTime != null ? { met: m.avgTime <= TARGET_TIME_TO_HIRE, text: `target ${TARGET_TIME_TO_HIRE}d` } : undefined}
        />
      </div>
      {!hasPrior && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Narrow the date range to compare against the previous equal period
          (the full range has no prior window).
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

      {m.total === 0 ? (
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
              <div className="mt-4 flex items-end gap-3 sm:gap-6">
                {m.monthly.map((mo) => (
                  <div key={mo.key} className="flex flex-1 flex-col items-center gap-1.5">
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
                    <div className="text-[11px] text-muted-foreground">{fmtMonth(mo.key).split(" ")[0]}</div>
                  </div>
                ))}
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
                <BarRow key={s} label={STAGE_LABEL[s]} value={m.funnel[s]} pct={m.funnel[s] / m.total} tone={s === "hired" ? "emerald" : "neutral"} />
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
                  Every posting with traction has at least one hire.
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
              {m.byCompany
                .filter((c) => c.avgDays != null)
                .sort((a, b) => (a.avgDays ?? 0) - (b.avgDays ?? 0))
                .map((c) => (
                  <BarRow key={c.label} label={c.label} value={`${c.avgDays}d`} sub={`${c.hires} hires`} pct={1 - (c.avgDays ?? 0) / m.maxAvgDays} />
                ))}
            </Panel>
          </div>
        </>
      )}

      <p className="mt-4 text-xs italic text-muted-foreground">
        Demo analytics over {JOB_APPLICATIONS.length} application records
        (Jan–Jun 2026). Overview counts from the live roster. Targets are
        illustrative.
      </p>
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
): Insight[] {
  const out: Insight[] = [];
  if (m.total === 0) return out;

  // Month-over-month trend
  if (m.monthly.length >= 2) {
    const last = m.monthly[m.monthly.length - 1];
    const prev = m.monthly[m.monthly.length - 2];
    if (prev.apps > 0) {
      const pct = Math.round(((last.apps - prev.apps) / prev.apps) * 100);
      out.push({
        tone: pct < -15 ? "warn" : "neutral",
        text: `Applications ${pct >= 0 ? "rose" : "fell"} ${Math.abs(pct)}% in ${fmtMonth(last.key).split(" ")[0]} vs ${fmtMonth(prev.key).split(" ")[0]}.`,
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
    out.push({
      tone: "warn",
      text: `${m.hardestPostings.length} posting${m.hardestPostings.length === 1 ? " is" : "s are"} hard to fill (low hire rate despite applicants).`,
    });
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

function metrics(recs: JobApplicationRecord[]) {
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

  const monthKeys = Array.from(new Set(recs.map((r) => r.appliedAt.slice(0, 7)))).sort();
  const monthly = monthKeys.map((key) => {
    const inMonth = recs.filter((r) => r.appliedAt.slice(0, 7) === key);
    const h = inMonth.filter((r) => r.hired).length;
    return { key, apps: inMonth.length, hires: h, rate: inMonth.length ? h / inMonth.length : 0 };
  });

  // Postings (role = company + jobTitle)
  const postingMap = new Map<string, { title: string; company: string; apps: number; hires: number }>();
  for (const r of recs) {
    const key = `${r.company}|||${r.jobTitle}`;
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
    const k = r.college.replace("College of ", "");
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  delta?: Delta | null;
  target?: { met: boolean; text: string };
}) {
  return (
    <div className={cn("rounded-lg px-4 py-3 ring-1", accent ? "bg-emerald-500/5 ring-emerald-500/30" : "bg-card ring-foreground/10")}>
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
    </div>
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
