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
 * Live data: counts, needs-attention, engagement and breakdowns come from
 * `api.adminData.overview`; hiring metrics from `api.adminData.applicationRecords`
 * over the default analytics window (last 6 calendar months) — the same sources
 * the Analytics page and the record lists read.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileWarning,
  GraduationCap,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { useAsOf } from "@/lib/use-as-of";
import { defaultFrom, type AnalyticsRecord } from "@/lib/analytics-filters";
import { quickLink } from "@/lib/use-url-filters";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/auf/admin-ui";

type Overview = FunctionReturnType<typeof api.adminData.overview>;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthAbbr(key: string) {
  return MONTH_ABBR[Number(key.slice(5, 7)) - 1] ?? key;
}

function shortCollege(name: string) {
  return name.replace("College of ", "");
}

export default function AdminDashboardPage() {
  const nowStep = useAsOf();
  const overview = useQuery(api.adminData.overview, { asOf: nowStep });
  const records = useQuery(api.adminData.applicationRecords);
  const d = useMemo(
    () => (overview && records ? buildMetrics(overview, records) : null),
    [overview, records],
  );

  const asOf = overview
    ? new Date(overview.asOf).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

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
          {asOf ? `As of ${asOf} · live data` : "Loading…"}
        </span>
      </div>

      {!d ? <DashboardSkeleton /> : <DashboardBody d={d} />}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard…</span>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="mt-4 h-40 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

function DashboardBody({ d }: { d: ReturnType<typeof buildMetrics> }) {
  const contractsHref =
    d.expiringContracts > 0
      ? quickLink("/admin/employers", { contract: "expiring" })
      : d.expiredContracts > 0
        ? quickLink("/admin/employers", { contract: "expired" })
        : "/admin/employers";

  return (
    <>
      {/* 1 · Core counts */}
      <div data-tour="dash-counts" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          value={d.alumniRegistered.toLocaleString()}
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
          value={d.totalApps ? `${(d.hireRate * 100).toFixed(1)}%` : "—"}
          sub={`${d.hires} hires · ${d.totalApps} applications · last 6 mo`}
          href="/admin/analytics"
          accent="emerald"
        />
      </div>

      {/* 2 · Needs attention */}
      <SectionTitle>Needs attention</SectionTitle>
      <div data-tour="dash-attention" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          href={contractsHref}
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
      {d.insights.length > 0 && (
        /*
          A lightbulb above a bulleted list of colour-dotted sentences is the
          house style of generated copy, and it made the one genuinely
          interpretive part of the dashboard look the least trustworthy.
          These are read as findings now: two columns, a rule between them,
          and tone carried by a short prefix rather than a decorative dot.
        */
        <div data-tour="dash-insights" className="mt-4 rounded-lg border border-border bg-card p-4">
          <SectionHeading className="mb-3">What the numbers say</SectionHeading>
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {d.insights.map((ins, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug">
                <span
                  className={cn(
                    "shrink-0 font-semibold tabular-nums",
                    ins.tone === "good"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : ins.tone === "warn"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground/60",
                  )}
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{ins.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 4 · Outcomes */}
      <SectionTitle>Outcomes</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={CheckCircle2} label="Hires via AUF" value={d.hires} sub="in the last 6 months" />
        <Tile icon={Clock} label="Avg time to hire" value={d.avgTimeToHire != null ? `${d.avgTimeToHire}d` : "—"} sub="application → hire" />
        <Tile icon={Users} label="Open to work" value={d.openToWork} sub="alumni seeking roles" />
        <Tile icon={Briefcase} label="Open roles" value={d.openRoles} sub="published postings" />
      </div>

      {/* 5 · Engagement & growth */}
      <SectionTitle>Engagement &amp; growth</SectionTitle>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
        <Tile
          icon={UserPlus}
          label="New this week"
          value={d.newRegistrationsThisWeek}
          sub={`registrations in the last 7 days · ${d.pendingApprovals} awaiting approval`}
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
                    {monthAbbr(m.key)}
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
          {d.alumniByCollege.length === 0 ? (
            <Empty>No verified alumni yet.</Empty>
          ) : (
            d.alumniByCollege.map((c) => (
              <Bar key={c.label} label={c.label} value={c.count} pct={c.count / d.maxCollege} />
            ))
          )}
        </ChartCard>

        <ChartCard title="Hire rate by college" icon={TrendingUp}>
          {d.hireRateByCollege.length === 0 ? (
            <Empty>No applications in the last 6 months.</Empty>
          ) : (
            d.hireRateByCollege.map((c) => (
              <Bar
                key={c.label}
                label={c.label}
                value={`${(c.rate * 100).toFixed(0)}%`}
                sub={`${c.hires}/${c.total}`}
                pct={c.rate}
                tone="emerald"
              />
            ))
          )}
        </ChartCard>

        <ChartCard title="Alumni by batch" icon={Users}>
          {d.alumniByBatch.length === 0 ? (
            <Empty>No verified alumni yet.</Empty>
          ) : (
            d.alumniByBatch.map((b) => (
              <Bar key={b.label} label={`Class of ${b.label}`} value={b.count} pct={b.count / d.maxBatch} />
            ))
          )}
        </ChartCard>

        <ChartCard title="Employers by tier" icon={Building2}>
          {d.employersByTier.map((t) => (
            <Bar key={t.label} label={t.label} value={t.count} pct={t.count / Math.max(1, d.employers)} />
          ))}
        </ChartCard>
      </div>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

// ----------------------------------------------------------- computation ---

type Insight = { tone: "good" | "warn" | "neutral"; text: string };

function buildMetrics(o: Overview, allRecords: AnalyticsRecord[]) {
  // Core counts
  const employers = o.employers;
  const tierCounts = o.tierCounts;
  const alumniRegistered = o.alumniRegistered;
  const alumniTotal = o.alumniPopulation;
  const postings = o.postings;
  const publishedPostings = o.publishedPostings;

  // Hire metrics — applications in the default analytics window (last 6 months)
  const since = defaultFrom();
  const recent = allRecords.filter((r) => r.appliedAt >= since);
  const totalApps = recent.length;
  const hires = recent.filter((r) => r.hired).length;
  const hireRate = totalApps ? hires / totalApps : 0;
  const hiredTimes = recent.filter((r) => r.hired && r.timeToHireDays != null);
  const avgTimeToHire = hiredTimes.length
    ? Math.round(
        hiredTimes.reduce((s, r) => s + (r.timeToHireDays ?? 0), 0) /
          hiredTimes.length,
      )
    : null;
  const reachedInterview = recent.filter((r) =>
    ["interview", "offered", "hired"].includes(r.stage),
  ).length;
  const reachedOffer = recent.filter((r) =>
    ["offered", "hired"].includes(r.stage),
  ).length;

  // Needs attention
  const pendingApprovals = o.pendingApprovals;
  const flaggedApprovals = o.flaggedApprovals;
  const expiringContracts = o.expiringContracts;
  const expiredContracts = o.expiredContracts;
  const postingsToReview = o.postingsToReview;

  // Outcomes
  const openToWork = o.openToWork;
  const openRoles = publishedPostings;

  // Engagement
  const upcomingEvents = o.upcomingEvents;
  const upcomingGoing = o.upcomingGoing;
  const newRegistrationsThisWeek = o.newRegistrationsThisWeek;
  const registrationTrend = o.registrationTrend;
  const maxReg = Math.max(1, ...registrationTrend.map((m) => m.count));

  // Breakdowns
  const alumniByCollege = o.alumniByCollege.map((c) => ({
    label: shortCollege(c.label),
    count: c.count,
  }));
  const maxCollege = Math.max(1, ...alumniByCollege.map((c) => c.count));

  const alumniByBatch = o.alumniByBatch;
  const maxBatch = Math.max(1, ...alumniByBatch.map((b) => b.count));

  const hireRateByCollege = collegeHireRates(recent);
  const employersByTier = [
    { label: "Partner", count: tierCounts.Partner },
    { label: "Verified", count: tierCounts.Verified },
    { label: "Unverified", count: tierCounts.Unverified },
  ];

  // Insights — the dashboard interpreting itself
  const topPartner = topHiringPartner(recent);
  const insights: Insight[] = [];
  if (topPartner) {
    insights.push({
      tone: "neutral",
      text: `Top hiring partner: ${topPartner.company} with ${topPartner.hires} ${topPartner.hires === 1 ? "hire" : "hires"} in the last 6 months.`,
    });
  }
  if (hireRateByCollege.length >= 2) {
    const best = hireRateByCollege[0];
    const worst = hireRateByCollege[hireRateByCollege.length - 1];
    insights.push({
      tone: "good",
      text: `Best-placing college: ${best.label} (${(best.rate * 100).toFixed(0)}% hire rate); lowest is ${worst.label} (${(worst.rate * 100).toFixed(0)}%).`,
    });
  }
  if (totalApps > 0) {
    const interviewPct = (reachedInterview / totalApps) * 100;
    const offerPct = (reachedOffer / totalApps) * 100;
    const offerDrop = offerPct < interviewPct * 0.5;
    insights.push({
      tone: offerDrop ? "warn" : "neutral",
      text: offerDrop
        ? `${interviewPct.toFixed(0)}% of applicants reach interview, but only ${offerPct.toFixed(0)}% get an offer — the biggest drop-off is at the offer stage.`
        : `${interviewPct.toFixed(0)}% of applicants reach interview and ${offerPct.toFixed(0)}% get an offer.`,
    });
  }
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
    newRegistrationsThisWeek,
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

function collegeHireRates(recs: AnalyticsRecord[]) {
  const map = new Map<string, { total: number; hires: number }>();
  for (const r of recs) {
    const k = shortCollege(r.college);
    const cur = map.get(k) ?? { total: 0, hires: 0 };
    cur.total += 1;
    if (r.hired) cur.hires += 1;
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([label, v]) => ({ label, total: v.total, hires: v.hires, rate: v.hires / v.total }))
    .sort((a, b) => b.rate - a.rate);
}

function topHiringPartner(recs: AnalyticsRecord[]) {
  const map = new Map<string, number>();
  for (const r of recs) {
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

/**
 * Tile accents.
 *
 * Previously every accent tinted the whole tile, which meant a healthy hire
 * rate was shaded mint and sat beside a pink "contracts expiring" tile — two
 * different meanings rendered as the same kind of signal. A dashboard where
 * eleven of fourteen tiles are coloured has no way left to say "look here".
 *
 * Colour is now a 2px left edge, used only where something needs a decision.
 * `emerald` is deliberately uncoloured: a number being good is not an action.
 */
const ACCENTS = {
  emerald: "border-l-transparent",
  amber: "border-l-amber-500",
  red: "border-l-destructive",
  muted: "border-l-transparent",
  none: "border-l-transparent",
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
    <div
      className={cn(
        "h-full rounded-lg border border-l-2 border-border bg-card px-3.5 py-2.5 transition-colors",
        ACCENTS[accent],
        href && "hover:bg-muted/40",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] leading-tight text-muted-foreground">{sub}</div>}
      {href && (
        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground/70">
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
