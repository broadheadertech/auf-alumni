"use client";

/**
 * Job analytics — hiring funnel + hiring rate, sliceable by company, college,
 * and date range.
 *
 * Headline metric is the hiring rate (hires ÷ applications) for the current
 * filter, with supporting funnel, monthly trend, time-to-hire, and per-college
 * / per-company breakdowns. Built on the deterministic JOB_APPLICATIONS
 * history — swap for a Convex aggregation over `applications` when live.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, TrendingUp, Users, Award, Clock } from "lucide-react";
import {
  ANALYTICS_DATE_MAX,
  ANALYTICS_DATE_MIN,
  APPLICATION_STAGES,
  COLLEGES,
  COMPANIES,
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

export default function JobAnalyticsPage() {
  const [company, setCompany] = useState<string>("all");
  const [colleges, setColleges] = useState<College[]>([]);
  const [from, setFrom] = useState<string>(ANALYTICS_DATE_MIN);
  const [to, setTo] = useState<string>(ANALYTICS_DATE_MAX);

  const filtered = useMemo(
    () =>
      JOB_APPLICATIONS.filter((r) => {
        if (company !== "all" && r.company !== company) return false;
        if (colleges.length && !colleges.includes(r.college)) return false;
        if (r.appliedAt < from || r.appliedAt > to) return false;
        return true;
      }),
    [company, colleges, from, to],
  );

  const m = useMemo(() => metrics(filtered), [filtered]);

  const toggleCollege = (c: College) =>
    setColleges((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  const resetFilters = () => {
    setCompany("all");
    setColleges([]);
    setFrom(ANALYTICS_DATE_MIN);
    setTo(ANALYTICS_DATE_MAX);
  };

  const filtersActive =
    company !== "all" ||
    colleges.length > 0 ||
    from !== ANALYTICS_DATE_MIN ||
    to !== ANALYTICS_DATE_MAX;

  const maxMonthApps = Math.max(1, ...m.monthly.map((x) => x.apps));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-2">
        <Briefcase className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Job analytics</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Hiring performance across the alumni job marketplace. Slice by company,
        college, or date range.
      </p>

      {/* Filters */}
      <Card className="mt-5">
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
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
                  onClick={resetFilters}
                >
                  Reset filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Headline KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={TrendingUp}
          label="Hiring rate"
          value={`${(m.hireRate * 100).toFixed(1)}%`}
          hint={`${m.hires} hires / ${m.total} applications`}
          accent
        />
        <Kpi icon={Users} label="Applications" value={m.total.toLocaleString()} />
        <Kpi icon={Award} label="Hires" value={m.hires.toLocaleString()} />
        <Kpi
          icon={Clock}
          label="Avg time to hire"
          value={m.avgTimeToHire ? `${m.avgTimeToHire}d` : "—"}
          hint={m.offerRate ? `${(m.offerRate * 100).toFixed(0)}% reach offer` : undefined}
        />
      </div>

      {m.total === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No applications match these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Monthly trend */}
          <Card className="lg:col-span-2">
            <CardContent className="p-4">
              <h2 className="text-sm font-medium">Applications &amp; hiring rate by month</h2>
              <div className="mt-4 flex items-end gap-3 sm:gap-6">
                {m.monthly.map((mo) => (
                  <div key={mo.key} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="text-[11px] font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                      {mo.apps > 0 ? `${(mo.rate * 100).toFixed(0)}%` : "—"}
                    </div>
                    <div className="flex h-32 w-full items-end justify-center">
                      <div
                        className="relative w-7 sm:w-10 rounded-t bg-foreground/15"
                        style={{ height: `${(mo.apps / maxMonthApps) * 100}%` }}
                        title={`${mo.apps} applications`}
                      >
                        <div
                          className="absolute bottom-0 w-full rounded-t bg-emerald-500"
                          style={{
                            height: `${mo.apps ? (mo.hires / mo.apps) * 100 : 0}%`,
                          }}
                          title={`${mo.hires} hires`}
                        />
                      </div>
                    </div>
                    <div className="text-[11px] tabular-nums text-muted-foreground">
                      {mo.apps}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {fmtMonth(mo.key).split(" ")[0]}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                <Legend className="bg-foreground/15" label="Applications" />
                <Legend className="bg-emerald-500" label="Hires" />
                <span>· % = hiring rate that month</span>
              </div>
            </CardContent>
          </Card>

          {/* Funnel */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-medium">Pipeline funnel</h2>
              <div className="mt-3 space-y-2">
                {m.funnel.map((f) => (
                  <BarRow
                    key={f.stage}
                    label={STAGE_LABEL[f.stage]}
                    count={f.count}
                    pct={f.count / m.total}
                    tone={f.stage === "hired" ? "emerald" : "neutral"}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Conversions */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-medium">Stage conversion</h2>
              <div className="mt-3 space-y-3">
                <Conversion label="Application → Interview" value={m.conv.toInterview} />
                <Conversion label="Interview → Offer" value={m.conv.interviewToOffer} />
                <Conversion label="Offer → Hire" value={m.conv.offerToHire} />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Reached-stage basis (any candidate who got to or past the stage).
              </p>
            </CardContent>
          </Card>

          {/* By college */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-medium">Hiring rate by college</h2>
              <div className="mt-3 space-y-2">
                {m.byCollege.map((c) => (
                  <BarRow
                    key={c.key}
                    label={c.key.replace("College of ", "")}
                    count={c.hires}
                    suffix={`${(c.rate * 100).toFixed(0)}%`}
                    pct={c.rate}
                    sub={`${c.hires}/${c.total}`}
                    tone="emerald"
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* By company */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-medium">Hiring rate by company</h2>
              <div className="mt-3 space-y-2">
                {m.byCompany.map((c) => (
                  <BarRow
                    key={c.key}
                    label={c.key}
                    count={c.hires}
                    suffix={`${(c.rate * 100).toFixed(0)}%`}
                    pct={c.rate}
                    sub={`${c.hires}/${c.total}`}
                    tone="emerald"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <p className="mt-4 text-xs italic text-muted-foreground">
        Demo analytics over {JOB_APPLICATIONS.length} application records
        (Jan–Jun 2026). See also the{" "}
        <Link href="/admin/employers" className="underline">
          employer roster
        </Link>{" "}
        for per-posting pipelines.
      </p>
    </div>
  );
}

// ----------------------------------------------------------- aggregation ---

function metrics(recs: JobApplicationRecord[]) {
  const total = recs.length;
  const hires = recs.filter((r) => r.hired).length;
  const hireRate = total ? hires / total : 0;

  // funnel — count candidates currently AT each stage
  const funnel = APPLICATION_STAGES.map((stage) => ({
    stage,
    count: recs.filter((r) => r.stage === stage).length,
  }));

  // "reached stage" counts (a hire passed through interview + offer, etc.)
  const reachedInterview = recs.filter((r) =>
    ["interview", "offered", "hired"].includes(r.stage),
  ).length;
  const reachedOffer = recs.filter((r) =>
    ["offered", "hired"].includes(r.stage),
  ).length;
  const offerRate = total ? reachedOffer / total : 0;

  const conv = {
    toInterview: total ? reachedInterview / total : 0,
    interviewToOffer: reachedInterview ? reachedOffer / reachedInterview : 0,
    offerToHire: reachedOffer ? hires / reachedOffer : 0,
  };

  const hiredWithTime = recs.filter((r) => r.hired && r.timeToHireDays != null);
  const avgTimeToHire = hiredWithTime.length
    ? Math.round(
        hiredWithTime.reduce((s, r) => s + (r.timeToHireDays ?? 0), 0) /
          hiredWithTime.length,
      )
    : null;

  // monthly trend (always show the 6 months in range order)
  const monthKeys = Array.from(new Set(recs.map((r) => r.appliedAt.slice(0, 7)))).sort();
  const monthly = monthKeys.map((key) => {
    const inMonth = recs.filter((r) => r.appliedAt.slice(0, 7) === key);
    const h = inMonth.filter((r) => r.hired).length;
    return { key, apps: inMonth.length, hires: h, rate: inMonth.length ? h / inMonth.length : 0 };
  });

  const groupRate = (keyOf: (r: JobApplicationRecord) => string) => {
    const map = new Map<string, { total: number; hires: number }>();
    for (const r of recs) {
      const k = keyOf(r);
      const cur = map.get(k) ?? { total: 0, hires: 0 };
      cur.total += 1;
      if (r.hired) cur.hires += 1;
      map.set(k, cur);
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, total: v.total, hires: v.hires, rate: v.hires / v.total }))
      .sort((a, b) => b.rate - a.rate);
  };

  return {
    total,
    hires,
    hireRate,
    offerRate,
    avgTimeToHire,
    funnel,
    conv,
    monthly,
    byCollege: groupRate((r) => r.college),
    byCompany: groupRate((r) => r.company),
  };
}

// ------------------------------------------------------------- primitives ---

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-4 py-3 ring-1",
        accent
          ? "bg-emerald-500/5 ring-emerald-500/30"
          : "bg-card ring-foreground/10",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function BarRow({
  label,
  count,
  pct,
  sub,
  suffix,
  tone = "neutral",
}: {
  label: string;
  count: number;
  pct: number;
  sub?: string;
  suffix?: string;
  tone?: "neutral" | "emerald";
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">
          {suffix ?? count}
          {sub && <span className="ml-1 text-muted-foreground">{sub}</span>}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "emerald" ? "bg-emerald-500" : "bg-foreground/30",
          )}
          style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }}
        />
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
          <div
            className="h-full rounded-full bg-sky-500"
            style={{ width: `${Math.min(100, value * 100)}%` }}
          />
        </div>
        <span className="w-10 text-right text-xs font-medium tabular-nums">
          {(value * 100).toFixed(0)}%
        </span>
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
