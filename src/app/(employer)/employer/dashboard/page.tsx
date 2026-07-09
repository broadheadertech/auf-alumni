"use client";

/**
 * Employer dashboard — live view for the signed-in employer org (Convex).
 * KPIs, hiring-pipeline snapshot, posting performance, and recent applicants,
 * all read from real jobs + applications.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight, BarChart3, Briefcase, FileText, Users } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatTile, StageBadge, JobStatusBadge } from "@/components/auf/employer-ui";
import { STAGE_ORDER, STAGE_LABEL, fmtDate } from "@/lib/employer-format";
import { cn } from "@/lib/utils";

export default function EmployerDashboardPage() {
  const orgs = useQuery(api.employerOrgs.listMine);
  const jobs = useQuery(api.jobs.listMyOrgJobs);
  const applicants = useQuery(api.jobs.myApplicants);

  const loading =
    orgs === undefined || jobs === undefined || applicants === undefined;

  const org = orgs?.[0];

  const stats = useMemo(() => {
    const j = jobs ?? [];
    const a = applicants ?? [];
    return {
      activePostings: j.filter((p) => p.status === "published").length,
      totalApplicants: a.length,
      needsReview: a.filter((x) => x.stage === "new").length,
      inInterview: a.filter((x) => x.stage === "interview").length,
      offered: a.filter((x) => x.stage === "offered").length,
      hired: a.filter((x) => x.stage === "hired").length,
    };
  }, [jobs, applicants]);

  const stageCounts = useMemo(() => {
    const map = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<
      string,
      number
    >;
    for (const a of applicants ?? []) map[a.stage] = (map[a.stage] ?? 0) + 1;
    return map;
  }, [applicants]);

  const recent = useMemo(
    () => [...(applicants ?? [])].slice(0, 5),
    [applicants],
  );

  const maxStage = Math.max(1, ...Object.values(stageCounts));

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 text-sm text-muted-foreground">
        Loading dashboard…
      </div>
    );
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <Card>
          <CardContent className="p-10 text-center">
            <h1 className="text-lg font-semibold">No employer organisation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your account isn&apos;t linked to an employer yet. Ask an AUF admin
              to grant your organisation access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground text-base font-bold text-background">
            {org.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="capitalize">{org.tier} partner</span>
              {org.hqCity ? (
                <>
                  <span>·</span>
                  <span>{org.hqCity}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <Link href="/employer/jobs" className={buttonVariants({ size: "sm" })}>
          <Briefcase className="h-4 w-4" />
          Manage postings
        </Link>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Active postings" value={stats.activePostings} />
        <StatTile label="Applicants" value={stats.totalApplicants} />
        <StatTile label="Needs review" value={stats.needsReview} />
        <StatTile label="In interview" value={stats.inInterview} />
        <StatTile label="Offered" value={stats.offered} />
        <StatTile label="Hired" value={stats.hired} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Pipeline */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Hiring pipeline</h2>
              <Link
                href="/employer/applicants"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View all →
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {STAGE_ORDER.map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">
                    {STAGE_LABEL[s]}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        s === "hired" ? "bg-emerald-500" : "bg-foreground/30",
                      )}
                      style={{ width: `${(stageCounts[s] / maxStage) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs tabular-nums">
                    {stageCounts[s]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Posting performance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Posting performance</h2>
              <Link
                href="/employer/jobs"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Manage →
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No postings yet.</p>
              ) : (
                jobs.map((p) => (
                  <div
                    key={p._id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {p.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.location}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <JobStatusBadge status={p.status} />
                      <span className="text-sm tabular-nums">
                        {p.applicantCount}
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          appl.
                        </span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent applicants */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent applicants</h2>
            <Link
              href="/employer/applicants"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              All applicants →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No applications yet. They&apos;ll show here as alumni apply.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {recent.map((a) => (
                <div key={a._id} className="flex items-center gap-3 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {a.snapshot?.initials ?? "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {a.snapshot?.displayName ?? "Applicant"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.jobTitle} · applied {fmtDate(a.createdAt)}
                    </div>
                  </div>
                  <StageBadge stage={a.stage} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <QuickLink href="/employer/applicants" icon={Users} title="Applicants" desc="Review and move candidates" />
        <QuickLink href="/employer/analytics" icon={BarChart3} title="Analytics" desc="Funnel & time-to-fill" />
        <QuickLink href="/employer/reports" icon={FileText} title="Reports" desc="Export hiring summaries" />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="transition-colors hover:ring-foreground/30">
        <CardContent className="flex items-center gap-3 p-4">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{title}</div>
            <div className="truncate text-xs text-muted-foreground">{desc}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
