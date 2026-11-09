"use client";

/**
 * Live job moderation queue (Convex). Shows every employer-submitted posting
 * awaiting review with its FULL structured detail — overview, responsibilities,
 * requirements, benefits, compensation, and audience targeting — so an admin
 * can make an informed approve/reject decision. Backed by
 * convex/jobs.ts: moderationQueue / approveJob / rejectJob.
 *
 * Bulk review: Select all / Unselect all, then approve or reject (one shared
 * reason) every selected posting. Each posting still goes through the audited
 * per-job mutation.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Building2, Check, Loader2, X } from "lucide-react";
import { api } from "@/lib/convex-api";
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
import { BulkActionBar, SelectCheckbox } from "@/components/auf/BulkActionBar";
import { runBulk, useBulkSelection } from "@/lib/use-bulk-selection";
import { cn } from "@/lib/utils";
import { AdminPage } from "@/components/auf/admin-ui";

type PendingJob = {
  _id: string;
  title: string;
  description: string;
  responsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  location: string;
  workMode?: string;
  employmentType: string;
  experienceLevel?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  skills?: string[];
  targetingPrograms?: string[];
  targetingSkills?: string[];
  targetingBatches?: number[];
  closingAt?: number;
  createdAt: number;
  employerName: string;
  employerTier: string;
};

const WORK_MODE_LABEL: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "Onsite",
};
const EXP_LABEL: Record<string, string> = {
  entry: "Entry level",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead / manager",
};

function salaryLabel(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const f = (n: number) => `₱${n.toLocaleString()}`;
  if (min && max) return `${f(min)} – ${f(max)} / mo`;
  return `${f((min ?? max) as number)}+ / mo`;
}

function fmtDate(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function JobModerationPage() {
  const queue = useQuery(api.jobs.moderationQueue) as
    | PendingJob[]
    | undefined;
  const approveJob = useMutation(api.jobs.approveJob);
  const rejectJob = useMutation(api.jobs.rejectJob);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const selection = useBulkSelection((queue ?? []).map((j) => j._id));
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState("");

  const onBulk = async (mode: "approve" | "reject") => {
    const ids = selection.selectedIds;
    if (ids.length === 0) return;
    const why = bulkReason.trim();
    if (mode === "reject" && !why) {
      toast.error("A rejection reason is required");
      return;
    }
    setBulkBusy(true);
    try {
      const { ok, failed } = await runBulk(ids, (id) =>
        mode === "approve"
          ? approveJob({ jobId: id as never })
          : rejectJob({ jobId: id as never, reason: why }),
      );
      const verb = mode === "approve" ? "Approved" : "Rejected";
      const msg = `${verb} ${ok.length} posting${ok.length === 1 ? "" : "s"}${
        failed.length ? ` · ${failed.length} failed` : ""
      }`;
      if (failed.length) toast.warning(msg, { description: failed[0].message });
      else toast.success(msg);
      selection.deselect(ok);
      if (mode === "reject") {
        setBulkRejectOpen(false);
        setBulkReason("");
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const onApprove = async (job: PendingJob) => {
    setBusyId(job._id);
    try {
      await approveJob({ jobId: job._id as never });
      toast.success(`“${job.title}” approved — now live to alumni`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (job: PendingJob) => {
    if (!reason.trim()) {
      toast.error("A rejection reason is required");
      return;
    }
    setBusyId(job._id);
    try {
      await rejectJob({ jobId: job._id as never, reason: reason.trim() });
      toast.success(`“${job.title}” rejected`);
      setRejectingId(null);
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminPage
      title="Job moderation"
      description="Employer-submitted postings awaiting review. Read the posting, then approve it to publish to alumni or reject it with a reason."
    >

      <div className="mt-6 space-y-4">
        {queue === undefined ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Loading queue…
            </CardContent>
          </Card>
        ) : queue.length === 0 ? (
          <EmptyState
            icon={Check}
            message="Queue clear"
            description="No postings are waiting for review right now."
            cta={{ label: "All postings", href: "/admin/jobs" }}
          />
        ) : (
          <>
          <BulkActionBar
            noun="posting"
            count={selection.count}
            total={selection.total}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            onSelectAll={selection.selectAll}
            onUnselectAll={selection.unselectAll}
          >
            <Button size="sm" disabled={bulkBusy} onClick={() => onBulk("approve")}>
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve {selection.count}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={bulkBusy}
              onClick={() => {
                setBulkReason("");
                setBulkRejectOpen(true);
              }}
            >
              <X className="h-4 w-4" />
              Reject {selection.count}
            </Button>
          </BulkActionBar>
          {queue.map((job) => {
            const meta = [
              job.location,
              job.workMode ? WORK_MODE_LABEL[job.workMode] ?? job.workMode : null,
              job.employmentType,
              job.experienceLevel
                ? EXP_LABEL[job.experienceLevel] ?? job.experienceLevel
                : null,
            ].filter(Boolean) as string[];
            const salary = salaryLabel(job.salaryMin, job.salaryMax);
            const busy = busyId === job._id;
            const checked = selection.isSelected(job._id);
            return (
              <Card key={job._id} className={cn(checked && "ring-2 ring-foreground/30")}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <SelectCheckbox
                      checked={checked}
                      onChange={() => selection.toggle(job._id)}
                      label={`Select ${job.title}`}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold">{job.title}</h2>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {job.employerName}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] capitalize">
                          {job.employerTier}
                        </span>
                        <span>· submitted {fmtDate(job.createdAt)}</span>
                      </div>
                    </div>
                    {salary && (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {salary}
                      </span>
                    )}
                  </div>

                  {meta.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {meta.map((m) => (
                        <span
                          key={m}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize"
                        >
                          {m}
                        </span>
                      ))}
                      {job.closingAt && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                          Closes {fmtDate(job.closingAt)}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="mt-3 whitespace-pre-line text-sm text-foreground/90">
                    {job.description}
                  </p>

                  {job.skills && job.skills.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Required skills
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {job.skills.map((s) => (
                          <span
                            key={s}
                            className="rounded-full border border-border px-2 py-0.5 text-[11px]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <BulletList title="Responsibilities" items={job.responsibilities} />
                    <BulletList title="Requirements" items={job.requirements} />
                  </div>
                  <BulletList
                    title="Benefits"
                    items={job.benefits}
                    className="mt-3"
                  />

                  {/* Targeting */}
                  {(job.targetingSkills?.length ||
                    job.targetingPrograms?.length ||
                    job.targetingBatches?.length) && (
                    <div className="mt-3 rounded-md border border-border p-3">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Audience targeting
                      </div>
                      <TagRow label="Skills" items={job.targetingSkills} />
                      <TagRow label="Programs" items={job.targetingPrograms} />
                      <TagRow
                        label="Batches"
                        items={job.targetingBatches?.map(String)}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  {rejectingId === job._id ? (
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      <Textarea
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason for rejection (sent to the employer)"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setRejectingId(null);
                            setReason("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy || !reason.trim()}
                          onClick={() => onReject(job)}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Confirm reject
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => onApprove(job)}
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Approve & publish
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => {
                          setRejectingId(job._id);
                          setReason("");
                        }}
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          </>
        )}
      </div>

      <Dialog
        open={bulkRejectOpen}
        onOpenChange={(open) => !open && !bulkBusy && setBulkRejectOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {selection.count} posting{selection.count === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              The same reason is sent to each employer. Rejected postings leave the queue.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder="Reason for rejection (sent to the employers)"
            aria-label="Rejection reason"
          />
          <DialogFooter>
            <Button variant="outline" disabled={bulkBusy} onClick={() => setBulkRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={bulkBusy || !bulkReason.trim()}
              onClick={() => onBulk("reject")}
            >
              {bulkBusy ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-4 text-xs text-muted-foreground">
        Looking for the full postings list?{" "}
        <Link href="/admin/jobs" className="underline">
          Job postings
        </Link>
        .
      </p>
    </AdminPage>
  );
}

function BulletList({
  title,
  items,
  className,
}: {
  title: string;
  items?: string[];
  className?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className={className}>
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

function TagRow({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}:</span>
      {items.map((t) => (
        <span
          key={t}
          className={cn(
            "rounded-full border border-border px-2 py-0.5 text-[11px]",
          )}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
