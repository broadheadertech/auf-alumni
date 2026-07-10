"use client";

/**
 * My job applications — the alumna's own application tracker. Lists every job
 * they've applied to with the current pipeline stage and whether the employer
 * has reviewed their CV (the explicit, employer-triggered review marker).
 * Read-only; data comes from convex/jobs.myApplications.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/auf/EmptyState";
import { cn } from "@/lib/utils";

type Application = {
  _id: string;
  jobId: string;
  jobTitle: string;
  jobLocation: string;
  jobStatus: string;
  employerName: string;
  stage: string;
  reviewedAt: number | null;
  resumeFilename?: string;
  createdAt: number;
  updatedAt: number;
};

/** Applicant-facing label + tone for each internal pipeline stage. */
const STAGE_META: Record<
  string,
  { label: string; tone: "neutral" | "active" | "positive" | "negative" }
> = {
  new: { label: "Submitted", tone: "neutral" },
  screening: { label: "Under review", tone: "active" },
  interview: { label: "Interview", tone: "active" },
  offered: { label: "Offer extended", tone: "positive" },
  hired: { label: "Hired", tone: "positive" },
  "not-selected": { label: "Not selected", tone: "negative" },
};

const STAGE_TONE: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  active: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  negative: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Filter = "all" | "reviewed" | "pending";

export default function MyApplicationsPage() {
  const applications = useQuery(api.jobs.myApplications) as
    | Application[]
    | undefined;
  const [filter, setFilter] = useState<Filter>("all");

  const totals = useMemo(() => {
    const list = applications ?? [];
    return {
      all: list.length,
      reviewed: list.filter((a) => a.reviewedAt).length,
      pending: list.filter((a) => !a.reviewedAt).length,
    };
  }, [applications]);

  const rows = useMemo(() => {
    const list = applications ?? [];
    if (filter === "reviewed") return list.filter((a) => a.reviewedAt);
    if (filter === "pending") return list.filter((a) => !a.reviewedAt);
    return list;
  }, [applications, filter]);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Jobs
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Briefcase className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">
          My job applications
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Track the status of every role you&apos;ve applied to — including whether
        the employer has reviewed your CV.
      </p>

      {/* Filter chips */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {(
          [
            ["all", `All (${totals.all})`],
            ["reviewed", `Reviewed (${totals.reviewed})`],
            ["pending", `Awaiting review (${totals.pending})`],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === f
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2.5">
        {applications === undefined ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Loading your applications…
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Briefcase}
              message={
                totals.all === 0
                  ? "No applications yet"
                  : "Nothing in this filter"
              }
              description={
                totals.all === 0
                  ? "Roles you apply to will show up here with their status."
                  : "Try another filter to see your other applications."
              }
              cta={
                totals.all === 0
                  ? { label: "Browse jobs", href: "/jobs" }
                  : undefined
              }
            />
          </div>
        ) : (
          rows.map((a) => <ApplicationRow key={a._id} application={a} />)
        )}
      </div>
    </div>
  );
}

function ApplicationRow({ application: a }: { application: Application }) {
  const stage = STAGE_META[a.stage] ?? {
    label: a.stage,
    tone: "neutral" as const,
  };
  const reviewed = Boolean(a.reviewedAt);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/jobs/${a.jobId}`}
              className="font-medium hover:underline"
            >
              {a.jobTitle}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{a.employerName}</span>
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {a.jobLocation}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Applied {fmtDate(a.createdAt)}
              {a.resumeFilename ? (
                <span className="ml-2 inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {a.resumeFilename}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                STAGE_TONE[stage.tone],
              )}
            >
              {stage.label}
            </span>
            {reviewed ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                CV reviewed by employer
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Awaiting employer review
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
