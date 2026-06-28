"use client";

/**
 * Employer dashboard — at-a-glance view for the signed-in employer org
 * (Kollab AI in this prototype). KPIs, hiring-pipeline snapshot, posting
 * performance, and the most recent applicants, with quick links into the
 * deeper surfaces (postings, applicants, analytics, reports).
 *
 * Mock-data prototype for stakeholder review — see lib/mock-admin.ts.
 */

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  FileText,
  Users,
} from "lucide-react";
import {
  APPLICATION_STAGES,
  EMPLOYER_APPLICANTS,
  STAGE_LABEL,
  contractState,
  currentEmployer,
  employerApplicantsForJob,
  fmtDate,
  type ApplicationStage,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  ContractBadge,
  PostingStatusBadge,
  StageBadge,
  StatTile,
} from "@/components/auf/AdminBits";
import { cn } from "@/lib/utils";

export default function EmployerDashboardPage() {
  const employer = currentEmployer();

  const stats = useMemo(() => {
    const apps = EMPLOYER_APPLICANTS;
    const activePostings = employer.postings.filter(
      (p) => p.status === "published",
    ).length;
    const inInterview = apps.filter((a) => a.stage === "interview").length;
    const offered = apps.filter((a) => a.stage === "offered").length;
    const hired = apps.filter((a) => a.stage === "hired").length;
    const needsReview = apps.filter((a) => a.stage === "new").length;
    return {
      activePostings,
      totalApplicants: apps.length,
      inInterview,
      offered,
      hired,
      needsReview,
    };
  }, [employer]);

  const stageCounts = useMemo(() => {
    const map = Object.fromEntries(
      APPLICATION_STAGES.map((s) => [s, 0]),
    ) as Record<ApplicationStage, number>;
    for (const a of EMPLOYER_APPLICANTS) map[a.stage] += 1;
    return map;
  }, []);

  const recent = useMemo(
    () =>
      [...EMPLOYER_APPLICANTS]
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
        .slice(0, 5),
    [],
  );

  const maxStage = Math.max(1, ...Object.values(stageCounts));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground text-base font-bold text-background">
            {employer.initials}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {employer.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{employer.tier} partner</span>
              <span>·</span>
              <ContractBadge state={contractState(employer)} />
              <span className="text-xs">
                contract ends {fmtDate(employer.contractEnd)}
              </span>
            </div>
          </div>
        </div>
        <Link
          href="/employer/jobs"
          className={buttonVariants({ size: "sm" })}
        >
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
              {APPLICATION_STAGES.map((s) => (
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
                      style={{
                        width: `${(stageCounts[s] / maxStage) * 100}%`,
                      }}
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
              {employer.postings.map((p) => {
                const count = employerApplicantsForJob(p.id).length;
                return (
                  <div
                    key={p.id}
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
                      <PostingStatusBadge status={p.status} />
                      <span className="text-sm tabular-nums">
                        {count}
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          appl.
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
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
          <div className="mt-3 divide-y divide-border">
            {recent.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {a.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {a.jobTitle} · applied {fmtDate(a.appliedAt)}
                  </div>
                </div>
                <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
                  {a.matchScore}% match
                </span>
                <StageBadge stage={a.stage} />
              </div>
            ))}
          </div>
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
