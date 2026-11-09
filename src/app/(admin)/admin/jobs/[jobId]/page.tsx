"use client";

/**
 * Admin job-posting detail — opened from the Job postings list.
 *
 * Shows the post details, a summary (applicants · days live · CVs reviewed ·
 * hires), and the full applicant list for the posting. "CVs reviewed" counts
 * applications an employer has opened (applications.reviewedAt set).
 *
 * Live data: convex/adminData.ts `posting`. Pending postings can be approved
 * or rejected here via convex/jobs.ts approveJob / rejectJob.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Building2,
  CalendarDays,
  Check,
  Clock,
  FileCheck2,
  FileText,
  Loader2,
  MapPin,
  X,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { useAsOf } from "@/lib/use-as-of";
import { fmtDate } from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/auf/EmptyState";
import {
  PostingStatusBadge,
  StageBadge,
} from "@/components/auf/AdminBits";
import {
  DetailPage,
  Stat,
  StatStrip,
} from "@/components/auf/admin-ui";

const DAY = 86_400_000;

/** Whole days between an ISO date and today (UTC); never negative. */
function daysSince(iso: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((today - new Date(iso + "T00:00:00Z").getTime()) / DAY));
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const data = err.data as { message?: string } | string;
    return typeof data === "string" ? data : data?.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

export default function AdminJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const asOf = useAsOf();
  const found = useQuery(api.adminData.posting, { id: params.jobId, asOf });
  const approveJob = useMutation(api.jobs.approveJob);
  const rejectJob = useMutation(api.jobs.rejectJob);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const applicants = useMemo(
    () =>
      found
        ? [...found.posting.applicants].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
        : [],
    [found],
  );

  if (found === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 text-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading posting…
      </div>
    );
  }

  if (found === null) {
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
  const reviewed = applicants.filter((a) => a.reviewed).length;
  const withCv = applicants.filter((a) => a.hasCv).length;
  const hired = applicants.filter((a) => a.stage === "hired").length;
  const daysLive = daysSince(posting.postedAt);
  const pending = posting.status === "pending-moderation";

  const onApprove = async () => {
    setBusy(true);
    try {
      await approveJob({ jobId: posting.id as never });
      toast.success(`“${posting.title}” approved — now published`);
    } catch (err) {
      toast.error(errorMessage(err, "Approve failed"));
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    const why = reason.trim();
    if (!why) {
      toast.error("A rejection reason is required");
      return;
    }
    setBusy(true);
    try {
      await rejectJob({ jobId: posting.id as never, reason: why });
      toast.success(`“${posting.title}” rejected`);
      setRejectOpen(false);
      setReason("");
    } catch (err) {
      toast.error(errorMessage(err, "Reject failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailPage
      backHref="/admin/jobs"
      backLabel="Job postings"
      title={posting.title}
      badges={<PostingStatusBadge status={posting.status} />}
      subtitle={
        <Link
          href={`/admin/employers/${employer.id}`}
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <Building2 className="h-3.5 w-3.5" />
          {employer.name}
        </Link>
      }
      actions={
        pending ? (
          <>
            <Button size="sm" disabled={busy} onClick={onApprove}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve &amp; publish
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setReason("");
                setRejectOpen(true);
              }}
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
          </>
        ) : undefined
      }
    >
      {posting.statusReason && (
        <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">Moderation note:</span> {posting.statusReason}
        </div>
      )}

      <StatStrip className={posting.statusReason ? "mt-3" : ""}>
        <Stat label="Applicants" value={applicants.length} />
        <Stat
          label="Days posted"
          value={daysLive}
          hint={`since ${fmtDate(posting.postedAt)}`}
        />
        <Stat
          label="CVs reviewed"
          value={`${reviewed} / ${applicants.length}`}
          hint={
            applicants.length
              ? `${Math.round((reviewed / applicants.length) * 100)}% screened · ${withCv} with CV`
              : undefined
          }
        />
        <Stat label="Hired" value={hired} tone={hired > 0 ? "good" : "default"} />
      </StatStrip>

      {/* Post details */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <h2 className="text-sm font-medium">Post details</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Detail icon={MapPin} label="Location" value={`${posting.location} · ${posting.employmentType}`} />
            <Detail icon={FileText} label="Salary" value={posting.salaryLabel} />
            <Detail icon={CalendarDays} label="Posted" value={fmtDate(posting.postedAt)} />
            <Detail
              icon={Clock}
              label="Closes"
              value={posting.closesAt ? fmtDate(posting.closesAt) : "No closing date"}
            />
          </dl>
          {posting.description && (
            <p className="mt-4 whitespace-pre-line text-sm text-foreground/90">
              {posting.description}
            </p>
          )}
          {posting.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {posting.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px]"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <BulletList title="Responsibilities" items={posting.responsibilities} />
            <BulletList title="Requirements" items={posting.requirements} />
            <BulletList title="Benefits" items={posting.benefits} />
          </div>
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
                        key={a.applicationId}
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
                          {a.college.replace("College of ", "")}
                          {a.batch != null ? ` · Batch ${a.batch}` : ""}
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
                          ) : a.reviewed ? (
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
        “CVs reviewed” counts applications the employer has opened.
      </p>

      <Dialog open={rejectOpen} onOpenChange={(open) => !open && !busy && setRejectOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject “{posting.title}”?</DialogTitle>
            <DialogDescription>
              The reason is sent to {employer.name}. The posting is taken out of
              the review queue.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (sent to the employer)"
            aria-label="Rejection reason"
          />
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy || !reason.trim()} onClick={onReject}>
              {busy ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DetailPage>
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

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-foreground/90">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
