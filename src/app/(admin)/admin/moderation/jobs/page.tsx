"use client";

/**
 * Admin job-post moderation queue (Epic 13).
 *
 * Every newly-created job enters pending-moderation; this view is the
 * approve/reject surface. Decisions are audit-logged server-side.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/auf/EmptyState";

type QueuedJob = {
  _id: string;
  title: string;
  description: string;
  location: string;
  employmentType: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  createdAt: number;
  employerName: string;
  employerTier: string;
};

export default function AdminJobModerationPage() {
  const queue = useQuery(api.jobs.moderationQueue);
  const approve = useMutation(api.jobs.approveJob);
  const reject = useMutation(api.jobs.rejectJob);
  const [busy, setBusy] = useState<string | null>(null);

  if (queue === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const list = (queue ?? []) as QueuedJob[];

  const onApprove = async (id: string) => {
    setBusy(id);
    try {
      await approve({ jobId: id as unknown as never });
      toast.success("Job approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const onReject = async (id: string) => {
    const reason = window.prompt("Reason for rejection? (visible to employer)");
    if (!reason?.trim()) return;
    setBusy(id);
    try {
      await reject({ jobId: id as unknown as never, reason });
      toast.success("Job rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Job moderation queue
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Approve or reject pending job posts. Every decision is audit-logged.
      </p>

      <div className="mt-6 space-y-3">
        {list.length === 0 ? (
          <EmptyState
            message="Queue is empty"
            description="All pending job posts have been reviewed."
          />
        ) : (
          list.map((j) => (
            <Card key={j._id}>
              <CardContent className="space-y-2 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{j.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {j.employerName} ·{" "}
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                        {j.employerTier}
                      </span>{" "}
                      · {j.location} · {j.employmentType}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(j.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{j.description}</p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={busy === j._id}
                    onClick={() => onApprove(j._id)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === j._id}
                    onClick={() => onReject(j._id)}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
