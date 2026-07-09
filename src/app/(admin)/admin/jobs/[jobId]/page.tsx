"use client";

/**
 * Admin job-posting detail — opened from the Job postings list.
 *
 * Shows the post details, a summary (applicants · days live · CVs reviewed ·
 * hires), and the full applicant list for the posting. "CVs reviewed" counts
 * applicants who have moved past the initial "new" stage.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock,
  FileCheck2,
  FileText,
  MapPin,
} from "lucide-react";
import {
  daysSincePosted,
  fmtDate,
  getPostingById,
  jobApplicants,
  reviewedCount,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/auf/EmptyState";
import {
  PostingStatusBadge,
  StageBadge,
  StatTile,
} from "@/components/auf/AdminBits";

export default function AdminJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const found = getPostingById(params.jobId);

  const applicants = useMemo(
    () => (found ? jobApplicants(found.posting) : []),
    [found],
  );

  if (!found) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          message="Posting not found"
          cta={{ label: "Back to job postings", href: "/admin/jobs" }}
        />
      </div>
    );
  }

  const { posting, employer } = found;
  const reviewed = reviewedCount(applicants);
  const hired = applicants.filter((a) => a.stage === "hired").length;
  const daysLive = daysSincePosted(posting.postedAt);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <Link
        href="/admin/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Job postings
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {posting.title}
            </h1>
            <PostingStatusBadge status={posting.status} />
          </div>
          <Link
            href={`/admin/employers/${employer.id}`}
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Building2 className="h-4 w-4" />
            {employer.name}
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Applicants" value={applicants.length} />
        <StatTile
          label="Days posted"
          value={daysLive}
          hint={`since ${fmtDate(posting.postedAt)}`}
        />
        <StatTile
          label="CVs reviewed"
          value={`${reviewed} / ${applicants.length}`}
          hint={
            applicants.length
              ? `${Math.round((reviewed / applicants.length) * 100)}% screened`
              : undefined
          }
        />
        <StatTile label="Hired" value={hired} />
      </div>

      {/* Post details */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <h2 className="text-sm font-medium">Post details</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Detail icon={MapPin} label="Location" value={`${posting.location} · ${posting.employmentType}`} />
            <Detail icon={FileText} label="Salary" value={posting.salaryLabel} />
            <Detail icon={CalendarDays} label="Posted" value={fmtDate(posting.postedAt)} />
            <Detail icon={Clock} label="Closes" value={fmtDate(posting.closesAt)} />
          </dl>
        </CardContent>
      </Card>

      {/* Applicants */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          Applicants ({applicants.length})
        </h2>
        {applicants.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {reviewed} CV{reviewed === 1 ? "" : "s"} reviewed
          </span>
        )}
      </div>

      <Card className="mt-3">
        <CardContent className="p-0">
          {applicants.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No applicants for this posting yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Applicant</th>
                    <th className="px-3 py-2 text-left font-medium">College</th>
                    <th className="px-3 py-2 text-left font-medium">Applied</th>
                    <th className="px-3 py-2 text-right font-medium">Match</th>
                    <th className="px-3 py-2 text-center font-medium">CV</th>
                    <th className="px-3 py-2 text-left font-medium">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((a) => {
                    const reviewedRow = a.stage !== "new";
                    const nameEl = (
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                          {a.initials}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{a.name}</span>
                          {a.currentRole && (
                            <span className="block text-[11px] text-muted-foreground">
                              {a.currentRole}
                            </span>
                          )}
                        </span>
                      </span>
                    );
                    return (
                      <tr
                        key={a.key}
                        className="border-b border-border align-top last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2">
                          {a.alumnaId ? (
                            <Link
                              href={`/admin/alumni/${a.alumnaId}`}
                              className="hover:underline"
                            >
                              {nameEl}
                            </Link>
                          ) : (
                            nameEl
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {a.college.replace("College of ", "")} · Batch {a.batch}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {fmtDate(a.appliedAt)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {a.matchScore}%
                        </td>
                        <td className="px-3 py-2 text-center">
                          {!a.hasCv ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : reviewedRow ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                              title={a.cvFilename ?? "CV reviewed"}
                            >
                              <FileCheck2 className="h-4 w-4" /> Reviewed
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                              title={a.cvFilename ?? "CV attached"}
                            >
                              <FileText className="h-4 w-4" /> New
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <StageBadge stage={a.stage} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-3 text-xs italic text-muted-foreground">
        “CVs reviewed” counts applicants moved past the New stage. Demo data.
      </p>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  );
}
