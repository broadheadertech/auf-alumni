"use client";

/**
 * Employer analytics — hiring performance for the signed-in employer (Kollab
 * AI). Hiring rate + funnel + monthly trend + time-to-hire, plus current-
 * pipeline breakdowns by posting and by applicant college. Date-filterable
 * over the employer's application history.
 *
 * Built on the employer's slice of JOB_APPLICATIONS (historical) plus the
 * live EMPLOYER_APPLICANTS pipeline. Mock-data prototype for stakeholder
 * review — see lib/mock-admin.ts.
 */

import { useMemo, useState } from "react";
import { BarChart3, Clock, Award, TrendingUp, Users } from "lucide-react";
import {
  ANALYTICS_DATE_MAX,
  ANALYTICS_DATE_MIN,
  APPLICATION_STAGES,
  EMPLOYER_APPLICANTS,
  STAGE_LABEL,
  currentEmployer,
  currentEmployerHistory,
  employerApplicantsForJob,
  fmtMonth,
  type ApplicationStage,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function EmployerAnalyticsPage() {
  const employer = currentEmployer();
  const history = useMemo(() => currentEmployerHistory(), []);
  const [from, setFrom] = useState(ANALYTICS_DATE_MIN);
  const [to, setTo] = useState(ANALYTICS_DATE_MAX);

  const filtered = useMemo(
    () => history.filter((r) => r.appliedAt >= from && r.appliedAt <= to),
    [history, from, to],
  );

  const m = useMemo(() => {
    const total = filtered.length;
    const hires = filtered.filter((r) => r.hired).length;
    const reachedInterview = filtered.filter((r) =>
      ["interview", "offered", "hired"].includes(r.stage),
    ).length;
    const reachedOffer = filtered.filter((r) =>
      ["offered", "hired"].includes(r.stage),
    ).length;
    const hiredTimes = filtered.filter((r) => r.hired && r.timeToHireDays != null);
    const avgTime = hiredTimes.length
      ? Math.round(
          hiredTimes.reduce((s, r) => s + (r.timeToHireDays ?? 0), 0) /
            hiredTimes.length,
        )
      : null;

    const monthKeys = Array.from(
      new Set(filtered.map((r) => r.appliedAt.slice(0, 7))),
    ).sort();
    const monthly = monthKeys.map((key) => {
      const inMonth = filtered.filter((r) => r.appliedAt.slice(0, 7) === key);
      const h = inMonth.filter((r) => r.hired).length;
      return {
        key,
        apps: inMonth.length,
        hires: h,
        rate: inMonth.length ? h / inMonth.length : 0,
      };
    });

    return {
      total,
      hires,
      hireRate: total ? hires / total : 0,
      interviewRate: total ? reachedInterview / total : 0,
      offerRate: total ? reachedOffer / total : 0,
      avgTime,
      monthly,
    };
  }, [filtered]);

  // Current live pipeline (not date-bound): stage funnel + by posting + college
  const pipeline = useMemo(() => {
    const stageCounts = Object.fromEntries(
      APPLICATION_STAGES.map((s) => [s, 0]),
    ) as Record<ApplicationStage, number>;
    for (const a of EMPLOYER_APPLICANTS) stageCounts[a.stage] += 1;

    const byPosting = employer.postings.map((p) => ({
      label: p.title,
      count: employerApplicantsForJob(p.id).length,
    }));

    const collegeMap = new Map<string, number>();
    for (const a of EMPLOYER_APPLICANTS) {
      const k = a.college.replace("College of ", "");
      collegeMap.set(k, (collegeMap.get(k) ?? 0) + 1);
    }
    const byCollege = [...collegeMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    return { stageCounts, byPosting, byCollege, total: EMPLOYER_APPLICANTS.length };
  }, [employer]);

  const maxMonthApps = Math.max(1, ...m.monthly.map((x) => x.apps));
  const maxPosting = Math.max(1, ...pipeline.byPosting.map((x) => x.count));
  const maxCollege = Math.max(1, ...pipeline.byCollege.map((x) => x.count));
  const maxStage = Math.max(1, ...Object.values(pipeline.stageCounts));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-2">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Hiring performance for {employer.name}. Funnel, hiring rate, time-to-hire,
        and where your applicants come from.
      </p>

      {/* Date filter */}
      <Card className="mt-5">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
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
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
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
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          {(from !== ANALYTICS_DATE_MIN || to !== ANALYTICS_DATE_MAX) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setFrom(ANALYTICS_DATE_MIN);
                setTo(ANALYTICS_DATE_MAX);
              }}
            >
              Reset
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} applications in range
          </span>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={TrendingUp} label="Hiring rate" value={`${(m.hireRate * 100).toFixed(1)}%`} hint={`${m.hires}/${m.total}`} accent />
        <Kpi icon={Users} label="Applications" value={m.total.toLocaleString()} />
        <Kpi icon={Award} label="Hires" value={m.hires.toLocaleString()} />
        <Kpi icon={Clock} label="Avg time to hire" value={m.avgTime ? `${m.avgTime}d` : "—"} />
      </div>

      {/* Monthly trend */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <h2 className="text-sm font-medium">Applications &amp; hiring rate by month</h2>
          {m.monthly.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No data in range.</p>
          ) : (
            <div className="mt-4 flex items-end gap-3 sm:gap-6">
              {m.monthly.map((mo) => (
                <div key={mo.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="text-[11px] font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                    {mo.apps > 0 ? `${(mo.rate * 100).toFixed(0)}%` : "—"}
                  </div>
                  <div className="flex h-28 w-full items-end justify-center">
                    <div
                      className="relative w-7 sm:w-10 rounded-t bg-foreground/15"
                      style={{ height: `${(mo.apps / maxMonthApps) * 100}%` }}
                    >
                      <div
                        className="absolute bottom-0 w-full rounded-t bg-emerald-500"
                        style={{ height: `${mo.apps ? (mo.hires / mo.apps) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] tabular-nums text-muted-foreground">{mo.apps}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtMonth(mo.key).split(" ")[0]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Live funnel */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium">Current pipeline funnel</h2>
            <p className="text-[11px] text-muted-foreground">
              {pipeline.total} active candidates
            </p>
            <div className="mt-3 space-y-2">
              {APPLICATION_STAGES.map((s) => (
                <BarRow
                  key={s}
                  label={STAGE_LABEL[s]}
                  count={pipeline.stageCounts[s]}
                  pct={pipeline.stageCounts[s] / maxStage}
                  tone={s === "hired" ? "emerald" : "neutral"}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Conversion */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium">Conversion (in range)</h2>
            <div className="mt-3 space-y-3">
              <Conversion label="Application → Interview" value={m.interviewRate} />
              <Conversion label="Application → Offer" value={m.offerRate} />
              <Conversion label="Application → Hire" value={m.hireRate} />
            </div>
          </CardContent>
        </Card>

        {/* By posting */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium">Applicants by posting</h2>
            <div className="mt-3 space-y-2">
              {pipeline.byPosting.map((p) => (
                <BarRow key={p.label} label={p.label} count={p.count} pct={p.count / maxPosting} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By college */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium">Applicants by college</h2>
            <div className="mt-3 space-y-2">
              {pipeline.byCollege.map((c) => (
                <BarRow key={c.label} label={c.label} count={c.count} pct={c.count / maxCollege} tone="emerald" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-xs italic text-muted-foreground">
        Demo analytics — historical trend from {history.length} application
        records; funnel/breakdowns from the current live pipeline.
      </p>
    </div>
  );
}

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
        accent ? "bg-emerald-500/5 ring-emerald-500/30" : "bg-card ring-foreground/10",
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
  tone = "neutral",
}: {
  label: string;
  count: number;
  pct: number;
  tone?: "neutral" | "emerald";
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">{count}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", tone === "emerald" ? "bg-emerald-500" : "bg-foreground/30")}
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
          <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, value * 100)}%` }} />
        </div>
        <span className="w-10 text-right text-xs font-medium tabular-nums">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
