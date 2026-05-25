"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Briefcase, Loader2, MapPin } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/auf/EmptyState";

type Job = {
  _id: string;
  title: string;
  description: string;
  location: string;
  employmentType: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  targetingBatches?: number[];
  targetingPrograms?: string[];
  targetingSkills?: string[];
  publishedAt?: number;
  closingAt?: number;
  employerName: string;
  employerTier: string;
};

function formatSalary(min?: number, max?: number, ccy?: string): string | null {
  if (!min && !max) return null;
  const c = ccy ?? "PHP";
  if (min && max) return `${c} ${min.toLocaleString()} – ${max.toLocaleString()}`;
  return `${c} ${(min ?? max)!.toLocaleString()}+`;
}

export default function JobsBoardPage() {
  const [showUnmatched, setShowUnmatched] = useState(false);
  const jobs = useQuery(api.jobs.browse, { showUnmatched });
  const apply = useMutation(api.jobs.apply);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [coverNote, setCoverNote] = useState("");
  const [dialogJobId, setDialogJobId] = useState<string | null>(null);

  const list = (jobs ?? []) as Job[];

  const onApply = async () => {
    if (!dialogJobId) return;
    setBusyJobId(dialogJobId);
    try {
      await apply({
        jobId: dialogJobId as unknown as never,
        coverNote: coverNote.trim() || undefined,
      });
      toast.success("Application sent");
      setDialogJobId(null);
      setCoverNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Roles posted by verified employers, filtered to match your profile.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showUnmatched}
            onChange={(e) => setShowUnmatched(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Show all jobs (not just matches)
        </label>
      </div>

      <div className="mt-6 space-y-3">
        {jobs === undefined ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        ) : list.length === 0 ? (
          <EmptyState
            message={showUnmatched ? "No jobs published yet" : "No matched jobs right now"}
            description={
              showUnmatched
                ? "Once employers start posting, opportunities will appear here."
                : "Toggle 'Show all jobs' to see roles outside your profile match."
            }
          />
        ) : (
          list.map((j) => {
            const salary = formatSalary(j.salaryMin, j.salaryMax, j.salaryCurrency);
            return (
              <Card key={j._id}>
                <CardContent className="space-y-2 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold">{j.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {j.employerName} ·{" "}
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                          {j.employerTier}
                        </span>
                      </p>
                    </div>
                    {salary && (
                      <span className="text-sm font-medium">{salary}</span>
                    )}
                  </div>
                  <p className="line-clamp-3 text-sm">{j.description}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {j.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      {j.employmentType}
                    </span>
                  </div>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      disabled={busyJobId === j._id}
                      onClick={() => {
                        setDialogJobId(j._id);
                        setCoverNote("");
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog
        open={dialogJobId != null}
        onOpenChange={(open) => !open && setDialogJobId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send your application</AlertDialogTitle>
            <AlertDialogDescription>
              Your privacy-permitted profile fields are attached automatically.
              Add an optional cover note to introduce yourself.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={4}
            maxLength={1500}
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            placeholder="Optional — what would you like the employer to know?"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onApply();
              }}
            >
              Send application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
