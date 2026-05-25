"use client";

/**
 * Employer applicant pipeline (Epic 13).
 *
 * Pick one of your jobs → see Kanban-style stages → move applicants between
 * stages. Snapshot of the applicant's privacy-filtered profile is rendered;
 * it's the snapshot taken at apply-time, so later profile edits don't leak.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/auf/EmptyState";

const STAGES = [
  { value: "new", label: "New" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offered", label: "Offered" },
  { value: "hired", label: "Hired" },
  { value: "not-selected", label: "Not selected" },
];

type Application = {
  _id: string;
  applicantId: string;
  coverNote?: string;
  profileSnapshot: Record<string, unknown>;
  stage: string;
  referredBy?: string;
  createdAt: number;
};

export default function EmployerApplicantsPage() {
  type EmployerOrg = { _id: string; name: string };
  const employersRaw = useQuery(api.employerOrgs.listMine);
  const employers = (employersRaw ?? null) as EmployerOrg[] | null;
  const [employerOrgId, setEmployerOrgId] = useState<string | null>(null);

  /* eslint-disable */
  useEffect(() => {
    if (!employerOrgId && employers && employers.length > 0) {
      setEmployerOrgId(employers[0]._id);
    }
  }, [employerOrgId, employers]);
  /* eslint-enable */

  const myJobs = useQuery(api.jobs.browse, { showUnmatched: true });
  type Job = {
    _id: string;
    title: string;
    employerOrgId: string;
    status: string;
    location?: string;
  };
  const jobs = ((myJobs ?? []) as Job[]).filter(
    (j) => j.employerOrgId === employerOrgId,
  );
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  /* eslint-disable */
  useEffect(() => {
    if (!activeJobId && jobs.length > 0) {
      setActiveJobId(jobs[0]._id);
    }
  }, [activeJobId, jobs]);
  /* eslint-enable */

  const pipelineData = useQuery(
    api.jobs.pipeline,
    activeJobId ? { jobId: activeJobId as unknown as never } : "skip",
  );
  const moveApplication = useMutation(api.jobs.moveApplication);
  const [busy, setBusy] = useState<string | null>(null);

  const onMove = async (appId: string, stage: string) => {
    setBusy(appId);
    try {
      await moveApplication({
        applicationId: appId as unknown as never,
        stage,
      });
      toast.success(`Moved to ${stage}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  if (employersRaw === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <EmptyState
          message="No jobs yet"
          description="Post a job and admin-approval first; applicants will land here."
          cta={{ label: "Go to jobs", href: "/employer/jobs" }}
        />
      </div>
    );
  }

  const applications = (pipelineData?.applications ?? []) as Application[];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Applicants</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        {employers && employers.length > 1 && (
          <div>
            <Label htmlFor="org">Employer</Label>
            <select
              id="org"
              value={employerOrgId ?? ""}
              onChange={(e) => {
                setEmployerOrgId(e.target.value);
                setActiveJobId(null);
              }}
              className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {employers.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label htmlFor="job">Job</Label>
          <select
            id="job"
            value={activeJobId ?? ""}
            onChange={(e) => setActiveJobId(e.target.value)}
            className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {jobs.map((j) => (
              <option key={j._id} value={j._id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {pipelineData === undefined ? (
        <Loader2 className="mt-8 h-6 w-6 animate-spin text-muted-foreground" />
      ) : pipelineData === null ? (
        <EmptyState
          className="mt-8"
          message="No pipeline data"
          description="Only the posting employer or a moderator can view this job's pipeline."
        />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {STAGES.map((stage) => {
            const items = applications.filter((a) => a.stage === stage.value);
            return (
              <section
                key={stage.value}
                className="rounded-lg border border-border bg-muted/30 p-3"
              >
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {stage.label} · {items.length}
                </h2>
                <div className="mt-2 space-y-2">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">—</p>
                  ) : (
                    items.map((app) => {
                      const snap = app.profileSnapshot;
                      const displayName =
                        (snap?.displayName as string) ?? "Applicant";
                      const role = snap?.currentRole as string | undefined;
                      const company = snap?.company as string | undefined;
                      return (
                        <Card key={app._id}>
                          <CardContent className="space-y-1 p-3 text-xs">
                            <p className="text-sm font-medium">{displayName}</p>
                            {(role || company) && (
                              <p className="text-muted-foreground">
                                {[role, company].filter(Boolean).join(" · ")}
                              </p>
                            )}
                            {app.coverNote && (
                              <p className="line-clamp-3 text-muted-foreground">
                                {app.coverNote}
                              </p>
                            )}
                            {app.referredBy && (
                              <p className="text-[10px] uppercase tracking-wide text-(--color-success)">
                                Referred
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 pt-1">
                              {STAGES.filter(
                                (s) => s.value !== app.stage,
                              ).map((s) => (
                                <Button
                                  key={s.value}
                                  size="sm"
                                  variant="outline"
                                  disabled={busy === app._id}
                                  onClick={() => onMove(app._id, s.value)}
                                  className="h-6 px-2 text-[10px]"
                                >
                                  → {s.label}
                                </Button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
