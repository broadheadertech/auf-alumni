"use client";

/**
 * Admin command center — the Alumni Relations office's at-a-glance view.
 *
 * Zones, top to bottom:
 *   1. Core counts        — employers, alumni, postings, hire rate
 *   2. Needs attention    — approvals, expiring contracts, postings to review
 *   3. Insights           — the dashboard interpreting its own numbers
 *   4. Outcomes           — hires, time-to-hire, supply/demand
 *   5. Engagement         — new signups, registrations trend, upcoming events
 *   6. Breakdown charts   — alumni by college/batch, hire rate by college, tiers
 *
 * Mock-data prototype for stakeholder review — see lib/mock-admin.ts.
 */

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileWarning,
  GraduationCap,
  Lightbulb,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  ALUMNAE,
  ALUMNI_POPULATION,
  EMPLOYERS,
  EVENTS,
  JOB_APPLICATIONS,
  PENDING_ALUMNI,
  contractState,
  fmtMonth,
  isUpcoming,
  postingCount,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function AdminDashboardPage() {
  const d = useMemo(() => buildMetrics(), []);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Admin dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alumni network, hiring marketplace, and partnerships at a glance.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          As of Jun 28, 2026 · demo data
        </span>
      </div>

      {/* 1 · Core counts */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={Building2}
          label="Employers"
          value={d.employers}
          sub={`${d.tierCounts.Partner} Partner · ${d.tierCounts.Verified} Verified · ${d.tierCounts.Unverified} Unverified`}
          href="/admin/employers"
        />
        <Tile
          icon={Users}
          label="Alumni"
          value={d.alumniRegistered}
          sub={`registered · of ~${d.alumniTotal.toLocaleString()} total`}
          href="/admin/alumni"
        />
        <Tile
          icon={Briefcase}
          label="Job postings"
          value={d.postings}
          sub={`${d.publishedPostings} published`}
          href="/admin/employers"
        />
        <Tile
          icon={TrendingUp}
          label="Hire rate"
          value={`${(d.hireRate * 100).toFixed(1)}%`}
          sub={`${d.hires} hires · ${d.totalApps} applications`}
          href="/admin/analytics/jobs"
          accent="emerald"
        />
      </div>

      {/* 2 · Needs attention */}
      <SectionTitle>Needs attention</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          icon={UserPlus}
          label="Pending approvals"
          value={d.pendingApprovals}
          sub={`${d.flaggedApprovals} flagged for review`}
          href="/admin/alumni/approvals"
          accent={d.pendingApprovals > 0 ? "amber" : "muted"}
        />
        <Tile
          icon={FileWarning}
          label="Contracts expiring"
          value={d.expiringContracts + d.expiredContracts}
          sub={
            d.expiredContracts > 0
              ? `${d.expiringContracts} soon · ${d.expiredContracts} expired`
              : `within 45 days`
          }
          href="/admin/employers"
          accent={
            d.expiredContracts > 0
              ? "red"
              : d.expiringContracts > 0
                ? "amber"
                : "muted"
          }
        />
        <Tile
          icon={Clock}
          label="Postings to review"
          value={d.postingsToReview}
          sub="awaiting moderation"
          href="/admin/moderation/jobs"
          accent={d.postingsToReview > 0 ? "amber" : "muted"}
        />
      </div>

      {/* 3 · Insights */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-medium">Insights</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {d.insights.map((ins, i) => (
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

      {/* 4 · Outcomes */}
      <SectionTitle>Outcomes</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={CheckCircle2} label="Hires via AUF" value={d.hires} sub="in the last 6 months" />
        <Tile icon={Clock} label="Avg time to hire" value={d.avgTimeToHire ? `${d.avgTimeToHire}d` : "—"} sub="application → offer" />
        <Tile icon={Users} label="Open to work" value={d.openToWork} sub="alumni seeking roles" />
        <Tile icon={Briefcase} label="Open roles" value={d.openRoles} sub="published postings" />
      </div>

      {/* 5 · Engagement & growth */}
      <SectionTitle>Engagement &amp; growth</SectionTitle>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
        <Tile
          icon={UserPlus}
          label="New this week"
          value={d.pendingApprovals}
          sub="registrations awaiting approval"
          href="/admin/alumni/approvals"
        />
        <Tile
          icon={CalendarDays}
          label="Upcoming events"
          value={d.upcomingEvents}
          sub={`~${d.upcomingGoing.toLocaleString()} going`}
          href="/admin/events"
        />
        <Card>
          <CardContent className="p-4">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
              Verified registrations by month
            </h3>
            <div className="mt-3 flex items-end gap-2">
              {d.registrationTrend.map((m) => (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-16 w-full items-end justify-center">
                    <div
                      className="w-5 rounded-t bg-foreground/25 sm:w-7"
                      style={{ height: `${(m.count / d.maxReg) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {m.count}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {fmtMonth(m.key).split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6 · Breakdown charts */}
      <SectionTitle>Breakdowns</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Alumni by college" icon={GraduationCap}>
          {d.alumniByCollege.map((c) => (
            <Bar key={c.label} label={c.label} value={c.count} pct={c.count / d.maxCollege} />
          ))}
        </ChartCard>

        <ChartCard title="Hire rate by college" icon={TrendingUp}>
          {d.hireRateByCollege.map((c) => (
            <Bar
              key={c.label}
              label={c.label}
              value={`${(c.rate * 100).toFixed(0)}%`}
              sub={`${c.hires}/${c.total}`}
              pct={c.rate}
              tone="emerald"
            />
          ))}
        </ChartCard>

        <ChartCard title="Alumni by batch" icon={Users}>
          {d.alumniByBatch.map((b) => (
            <Bar key={b.label} label={`Class of ${b.label}`} value={b.count} pct={b.count / d.maxBatch} />
          ))}
        </ChartCard>

        <ChartCard title="Employers by tier" icon={Building2}>
          {d.employersByTier.map((t) => (
            <Bar key={t.label} label={t.label} value={t.count} pct={t.count / d.employers} />
          ))}
        </ChartCard>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- computation ---

type Insight = { tone: "good" | "warn" | "neutral"; text: string };

function buildMetrics() {
  // Core counts
  const employers = EMPLOYERS.length;
  const tierCounts = {
    Partner: EMPLOYERS.filter((e) => e.tier === "Partner").length,
    Verified: EMPLOYERS.filter((e) => e.tier === "Verified").length,
    Unverified: EMPLOYERS.filter((e) => e.tier === "Unverified").length,
  };
  const alumniRegistered = ALUMNAE.length;
  const alumniTotal = ALUMNI_POPULATION;
  const postings = EMPLOYERS.reduce((s, e) => s + postingCount(e), 0);
  const publishedPostings = EMPLOYERS.reduce(
    (s, e) => s + e.postings.filter((p) => p.status === "published").length,
    0,
  );

  // Hire metrics (historical application records)
  const totalApps = JOB_APPLICATIONS.length;
  const hires = JOB_APPLICATIONS.filter((r) => r.hired).length;
  const hireRate = totalApps ? hires / totalApps : 0;
  const hiredTimes = JOB_APPLICATIONS.filter(
    (r) => r.hired && r.timeToHireDays != null,
  );
  const avgTimeToHire = hiredTimes.length
    ? Math.round(
        hiredTimes.reduce((s, r) => s + (r.timeToHireDays ?? 0), 0) /
          hiredTimes.length,
      )
    : null;
  const reachedInterview = JOB_APPLICATIONS.filter((r) =>
    ["interview", "offered", "hired"].includes(r.stage),
  ).length;
  const reachedOffer = JOB_APPLICATIONS.filter((r) =>
    ["offered", "hired"].includes(r.stage),
  ).length;

  // Needs attention
  const pendingApprovals = PENDING_ALUMNI.length;
  const flaggedApprovals = PENDING_ALUMNI.filter((p) => p.flags.length > 0).length;
  const expiringContracts = EMPLOYERS.filter(
    (e) => contractState(e) === "expiring",
  ).length;
  const expiredContracts = EMPLOYERS.filter(
    (e) => contractState(e) === "expired",
  ).length;
  const postingsToReview = EMPLOYERS.reduce(
    (s, e) =>
      s + e.postings.filter((p) => p.status === "pending-moderation").length,
    0,
  );

  // Outcomes
  const openToWork = ALUMNAE.filter((a) => a.openToWork).length;
  const openRoles = publishedPostings;

  // Engagement
  const upcomingEvents = EVENTS.filter(isUpcoming).length;
  const upcomingGoing = EVENTS.filter(isUpcoming).reduce(
    (s, e) => s + e.rsvpYes,
    0,
  );
  const regMap = new Map<string, number>();
  for (const a of ALUMNAE) {
    const k = a.registeredAt.slice(0, 7);
    regMap.set(k, (regMap.get(k) ?? 0) + 1);
  }
  const registrationTrend = [...regMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count }));
  const maxReg = Math.max(1, ...registrationTrend.map((m) => m.count));

  // Breakdowns
  const byCollege = groupCount(ALUMNAE.map((a) => a.college.replace("College of ", "")));
  const alumniByCollege = byCollege.sort((a, b) => b.count - a.count);
  const maxCollege = Math.max(1, ...alumniByCollege.map((c) => c.count));

  const byBatch = groupCount(ALUMNAE.map((a) => String(a.batch))).sort((a, b) =>
    b.label.localeCompare(a.label),
  );
  const alumniByBatch = byBatch;
  const maxBatch = Math.max(1, ...alumniByBatch.map((b) => b.count));

  const hireRateByCollege = collegeHireRates();
  const employersByTier = [
    { label: "Partner", count: tierCounts.Partner },
    { label: "Verified", count: tierCounts.Verified },
    { label: "Unverified", count: tierCounts.Unverified },
  ];

  // Insights — the dashboard interpreting itself
  const topPartner = topHiringPartner();
  const insights: Insight[] = [];
  if (topPartner) {
    insights.push({
      tone: "neutral",
      text: `Top hiring partner: ${topPartner.company} with ${topPartner.hires} hires this period.`,
    });
  }
  if (hireRateByCollege.length) {
    const best = hireRateByCollege[0];
    const worst = hireRateByCollege[hireRateByCollege.length - 1];
    insights.push({
      tone: "good",
      text: `Best-placing college: ${best.label} (${(best.rate * 100).toFixed(0)}% hire rate); lowest is ${worst.label} (${(worst.rate * 100).toFixed(0)}%).`,
    });
  }
  const interviewPct = totalApps ? (reachedInterview / totalApps) * 100 : 0;
  const offerPct = totalApps ? (reachedOffer / totalApps) * 100 : 0;
  insights.push({
    tone: offerPct < interviewPct * 0.5 ? "warn" : "neutral",
    text: `${interviewPct.toFixed(0)}% of applicants reach interview, but only ${offerPct.toFixed(0)}% get an offer — the biggest drop-off is at the offer stage.`,
  });
  insights.push({
    tone: openToWork > openRoles ? "warn" : "neutral",
    text:
      openToWork > openRoles
        ? `Demand-constrained: ${openToWork} alumni are open to work but only ${openRoles} roles are live. More employer postings would help.`
        : `Healthy supply of roles: ${openRoles} live postings for ${openToWork} alumni actively seeking.`,
  });
  if (expiringContracts + expiredContracts > 0) {
    insights.push({
      tone: "warn",
      text: `${expiringContracts + expiredContracts} employer ${expiringContracts + expiredContracts === 1 ? "contract needs" : "contracts need"} renewal attention (expiring soon or lapsed).`,
    });
  }

  return {
    employers,
    tierCounts,
    alumniRegistered,
    alumniTotal,
    postings,
    publishedPostings,
    totalApps,
    hires,
    hireRate,
    avgTimeToHire,
    pendingApprovals,
    flaggedApprovals,
    expiringContracts,
    expiredContracts,
    postingsToReview,
    openToWork,
    openRoles,
    upcomingEvents,
    upcomingGoing,
    registrationTrend,
    maxReg,
    alumniByCollege,
    maxCollege,
    alumniByBatch,
    maxBatch,
    hireRateByCollege,
    employersByTier,
    insights,
  };
}

function groupCount(values: string[]) {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].map(([label, count]) => ({ label, count }));
}

function collegeHireRates() {
  const map = new Map<string, { total: number; hires: number }>();
  for (const r of JOB_APPLICATIONS) {
    const k = r.college.replace("College of ", "");
    const cur = map.get(k) ?? { total: 0, hires: 0 };
    cur.total += 1;
    if (r.hired) cur.hires += 1;
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([label, v]) => ({ label, total: v.total, hires: v.hires, rate: v.hires / v.total }))
    .sort((a, b) => b.rate - a.rate);
}

function topHiringPartner() {
  const map = new Map<string, number>();
  for (const r of JOB_APPLICATIONS) {
    if (r.hired) map.set(r.company, (map.get(r.company) ?? 0) + 1);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.length ? { company: sorted[0][0], hires: sorted[0][1] } : null;
}

// ------------------------------------------------------------- primitives ---

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-7 mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

const ACCENTS = {
  emerald: "bg-emerald-500/5 ring-emerald-500/30",
  amber: "bg-amber-500/5 ring-amber-500/30",
  red: "bg-destructive/5 ring-destructive/30",
  muted: "bg-card ring-foreground/10",
  none: "bg-card ring-foreground/10",
} as const;

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  href,
  accent = "none",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: string;
  href?: string;
  accent?: keyof typeof ACCENTS;
}) {
  const body = (
    <div className={cn("h-full rounded-lg px-4 py-3 ring-1 transition-colors", ACCENTS[accent], href && "hover:ring-foreground/30")}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      {href && (
        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          View <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      {body}
    </Link>
  ) : (
    body
  );
}

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <div className="mt-3 space-y-2">{children}</div>
      </CardContent>
    </Card>
  );
}

function Bar({
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
  tone?: "neutral" | "emerald";
}) {
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
        <div
          className={cn("h-full rounded-full", tone === "emerald" ? "bg-emerald-500" : "bg-foreground/30")}
          style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }}
        />
      </div>
    </div>
  );
}
