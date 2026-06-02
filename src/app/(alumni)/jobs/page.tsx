"use client";

import { useState } from "react";
import Link from "next/link";
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
  type SavedResume = {
    filename: string;
    uploadedAt: number | null;
    url: string | null;
    storageId: string;
  } | null;
  const savedResume = useQuery(api.profiles.getMyProfileResume) as
    | SavedResume
    | undefined;
  const apply = useMutation(api.jobs.apply);
  const generateResumeUploadUrl = useMutation(api.jobs.generateResumeUploadUrl);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [coverNote, setCoverNote] = useState("");
  const [salaryShare, setSalaryShare] = useState(false);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [resumeMode, setResumeMode] =
    useState<"saved" | "upload" | "none">("saved");
  const [salaryPeriod, setSalaryPeriod] =
    useState<"monthly" | "annual">("monthly");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dialogJobId, setDialogJobId] = useState<string | null>(null);

  const list = (jobs ?? []) as Job[];

  const resetApplyForm = () => {
    setCoverNote("");
    setSalaryShare(false);
    setSalaryMin("");
    setSalaryMax("");
    setSalaryPeriod("monthly");
    setResumeFile(null);
  };

  const onApply = async () => {
    if (!dialogJobId) return;

    // Validate salary if user opted to share it.
    let salaryExpectation:
      | { min: number; max: number; currency: string; period: string }
      | undefined;
    if (salaryShare) {
      const min = Number(salaryMin);
      const max = Number(salaryMax);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
        toast.error("Salary range invalid — max must be ≥ min and both ≥ 0");
        return;
      }
      salaryExpectation = {
        min,
        max,
        currency: "PHP",
        period: salaryPeriod,
      };
    }

    // Validate resume + select source.
    let resumeStorageId: string | undefined;
    let resumeFilename: string | undefined;
    if (resumeMode === "saved" && savedResume) {
      resumeStorageId = savedResume.storageId;
      resumeFilename = savedResume.filename;
    } else if (resumeMode === "upload" && resumeFile) {
      const okType = /\.(pdf|doc|docx)$/i.test(resumeFile.name);
      if (!okType) {
        toast.error("Resume must be a PDF, DOC, or DOCX");
        return;
      }
      if (resumeFile.size > 8 * 1024 * 1024) {
        toast.error("Resume must be ≤ 8 MB");
        return;
      }
    }

    setBusyJobId(dialogJobId);
    try {
      if (resumeMode === "upload" && resumeFile) {
        const uploadUrl = await generateResumeUploadUrl({});
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": resumeFile.type || "application/pdf" },
          body: resumeFile,
        });
        if (!res.ok) {
          throw new Error("Resume upload failed");
        }
        const { storageId } = (await res.json()) as { storageId: string };
        resumeStorageId = storageId;
        resumeFilename = resumeFile.name;
      }
      await apply({
        jobId: dialogJobId as unknown as never,
        coverNote: coverNote.trim() || undefined,
        salaryExpectation,
        resumeStorageId: resumeStorageId as unknown as never,
        resumeFilename,
      });
      toast.success("Application sent");
      setDialogJobId(null);
      resetApplyForm();
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
        onOpenChange={(open) => {
          if (!open) {
            setDialogJobId(null);
            resetApplyForm();
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Send your application</AlertDialogTitle>
            <AlertDialogDescription>
              Your privacy-permitted profile fields are attached automatically.
              Add a cover note, optionally share salary expectations, and
              upload a resume.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {/* Cover note */}
            <div>
              <label className="block text-xs font-medium ink-2 mb-1">
                Cover note <span className="ink-3">(optional)</span>
              </label>
              <Textarea
                rows={3}
                maxLength={1500}
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                placeholder="What would you like the employer to know?"
              />
            </div>

            {/* Salary expectation */}
            <div className="rounded-md border border-border p-3 space-y-2">
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={salaryShare}
                  onChange={(e) => setSalaryShare(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <span>
                  <span className="block font-medium ink-2">
                    Share my salary expectation
                  </span>
                  <span className="block ink-3">
                    Visible only to this employer. Sharing can speed up the
                    process and avoid mismatches; leave unchecked to skip.
                  </span>
                </span>
              </label>
              {salaryShare && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <label className="text-[11px] ink-3">
                    Min (PHP)
                    <input
                      type="number"
                      min={0}
                      value={salaryMin}
                      onChange={(e) => setSalaryMin(e.target.value)}
                      placeholder="50000"
                      className="auf-input mt-0.5"
                    />
                  </label>
                  <label className="text-[11px] ink-3">
                    Max (PHP)
                    <input
                      type="number"
                      min={0}
                      value={salaryMax}
                      onChange={(e) => setSalaryMax(e.target.value)}
                      placeholder="80000"
                      className="auf-input mt-0.5"
                    />
                  </label>
                  <label className="text-[11px] ink-3 col-span-2 sm:col-span-1">
                    Period
                    <select
                      value={salaryPeriod}
                      onChange={(e) =>
                        setSalaryPeriod(
                          e.target.value as "monthly" | "annual",
                        )
                      }
                      className="auf-input mt-0.5"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            {/* Resume / CV */}
            <div>
              <label className="block text-xs font-medium ink-2 mb-2">
                Resume / CV <span className="ink-3">(optional)</span>
              </label>
              <div className="space-y-2">
                {savedResume ? (
                  <label className="flex items-start gap-2 text-[13px] cursor-pointer">
                    <input
                      type="radio"
                      name="resumeMode"
                      checked={resumeMode === "saved"}
                      onChange={() => setResumeMode("saved")}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="flex-1">
                      <span className="block font-medium">
                        Use my saved resume
                      </span>
                      <span className="block text-[11.5px] ink-3 truncate">
                        {savedResume.filename}
                      </span>
                    </span>
                  </label>
                ) : (
                  <p className="text-[11.5px] ink-3">
                    No saved resume on file —{" "}
                    <Link
                      href="/settings/resume"
                      className="brand-fg underline-offset-2 hover:underline"
                    >
                      add one in settings
                    </Link>{" "}
                    to reuse on every application.
                  </p>
                )}
                <label className="flex items-start gap-2 text-[13px] cursor-pointer">
                  <input
                    type="radio"
                    name="resumeMode"
                    checked={resumeMode === "upload"}
                    onChange={() => setResumeMode("upload")}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span className="flex-1">
                    <span className="block font-medium">
                      Upload a new file for this application
                    </span>
                    <span className="block text-[11.5px] ink-3">
                      PDF, DOC, or DOCX · ≤ 8 MB
                    </span>
                    {resumeMode === "upload" && (
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) =>
                          setResumeFile(e.target.files?.[0] ?? null)
                        }
                        className="mt-2 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-(--brand-50) file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-(--brand-ink) hover:file:bg-(--brand-100)"
                      />
                    )}
                    {resumeMode === "upload" && resumeFile && (
                      <span className="block text-[11px] ink-3 mt-1">
                        {resumeFile.name} ·{" "}
                        {(resumeFile.size / 1024).toFixed(0)} KB
                      </span>
                    )}
                  </span>
                </label>
                <label className="flex items-start gap-2 text-[13px] cursor-pointer">
                  <input
                    type="radio"
                    name="resumeMode"
                    checked={resumeMode === "none"}
                    onChange={() => setResumeMode("none")}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span className="text-[13px] font-medium">
                    Skip — apply without a resume
                  </span>
                </label>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onApply();
              }}
            >
              {busyJobId === dialogJobId ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  Sending…
                </>
              ) : (
                "Send application"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
