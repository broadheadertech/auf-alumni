"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Briefcase, Loader2, MapPin, Search, X } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  skills?: string[];
  targetingBatches?: number[];
  targetingPrograms?: string[];
  targetingSkills?: string[];
  publishedAt?: number;
  closingAt?: number;
  employerName: string;
  employerTier: string;
  /** True when the viewer has already applied — matches the Jobs nav badge. */
  applied?: boolean;
  /** 0–100 fit with your profile; see scoreJob in convex/jobs.ts. */
  matchScore?: number;
  strongMatch?: boolean;
  matchReasons?: string[];
  matchGaps?: string[];
};

function formatSalary(min?: number, max?: number, ccy?: string): string | null {
  if (!min && !max) return null;
  const c = ccy ?? "PHP";
  if (min && max) return `${c} ${min.toLocaleString()} – ${max.toLocaleString()}`;
  return `${c} ${(min ?? max)!.toLocaleString()}+`;
}

const TYPE_OPTIONS = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];
const MODE_OPTIONS = [
  { value: "Remote", label: "Remote" },
  { value: "Hybrid", label: "Hybrid" },
  { value: "Onsite", label: "Onsite" },
];

/** Infer work mode from a free-text location string. */
function workMode(location: string): string {
  const l = location.toLowerCase();
  if (l.includes("remote")) return "Remote";
  if (l.includes("hybrid")) return "Hybrid";
  return "Onsite";
}

export default function JobsBoardPage() {
  // The board lists every published role, best fit first; this narrows it to
  // strong matches instead of hiding the rest by default.
  const [onlyStrong, setOnlyStrong] = useState(false);
  const jobs = useQuery(api.jobs.browse, { onlyStrong });
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

  // Client-side filters (on top of the matched/unmatched Convex query).
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [modes, setModes] = useState<string[]>([]);
  const [minSalary, setMinSalary] = useState("");
  const [company, setCompany] = useState("all");
  // Default to the server's ranking (best fit for your profile first).
  const [sort, setSort] = useState<"match" | "recent" | "salary">("match");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = (jobs ?? []) as Job[];

  const companies = Array.from(new Set(list.map((j) => j.employerName))).sort();

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const filtered = list
    .filter((j) => {
      if (types.length && !types.includes(j.employmentType)) return false;
      if (modes.length && !modes.includes(workMode(j.location))) return false;
      if (company !== "all" && j.employerName !== company) return false;
      if (minSalary) {
        const cap = j.salaryMax ?? j.salaryMin;
        if (cap != null && cap < Number(minSalary)) return false;
      }
      if (query.trim()) {
        const hay = [j.title, j.employerName, j.description, j.location]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "salary") {
        return (b.salaryMax ?? b.salaryMin ?? 0) - (a.salaryMax ?? a.salaryMin ?? 0);
      }
      if (sort === "match") {
        return (
          (b.matchScore ?? 0) - (a.matchScore ?? 0) ||
          (b.publishedAt ?? 0) - (a.publishedAt ?? 0)
        );
      }
      return (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
    });

  const selected =
    filtered.find((j) => j._id === selectedId) ?? filtered[0] ?? null;

  const activeFilters =
    types.length + modes.length + (minSalary ? 1 : 0) + (company !== "all" ? 1 : 0);
  const clearFilters = () => {
    setQuery("");
    setTypes([]);
    setModes([]);
    setMinSalary("");
    setCompany("all");
  };

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
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Roles posted by verified employers. Filter to find your fit.
          </p>
          {list.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {list.length} role{list.length === 1 ? "" : "s"} ·{" "}
              {list.filter((j) => j.strongMatch).length} strong match
              {list.filter((j) => j.strongMatch).length === 1 ? "" : "es"} ·{" "}
              {list.filter((j) => !j.applied).length}{" "}
              you haven&apos;t applied to
              {/* The Jobs badge in the sidebar counts the not-yet-applied ones. */}
            </p>
          )}
        </div>
        <Link
          href="/jobs/applications"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <Briefcase className="h-4 w-4" />
          My applications
        </Link>
      </div>

      {/* Filter bar */}
      <div className="mt-4 space-y-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search title, company, keyword…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "recent" | "salary")}
            className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
          >
            <option value="match">Best match</option>
            <option value="recent">Most recent</option>
            <option value="salary">Salary (high to low)</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {TYPE_OPTIONS.map((o) => (
            <FilterChip
              key={o.value}
              label={o.label}
              on={types.includes(o.value)}
              onClick={() => toggle(types, o.value, setTypes)}
            />
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {MODE_OPTIONS.map((o) => (
            <FilterChip
              key={o.value}
              label={o.label}
              on={modes.includes(o.value)}
              onClick={() => toggle(modes, o.value, setModes)}
            />
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <input
            type="number"
            min={0}
            placeholder="Min salary"
            value={minSalary}
            onChange={(e) => setMinSalary(e.target.value)}
            className="h-7 w-28 rounded-md border border-border bg-background px-2 text-xs"
          />
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="all">Any company</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={onlyStrong}
              onChange={(e) => setOnlyStrong(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            <span className={onlyStrong ? "font-medium" : "text-muted-foreground"}>
              Best matches only
            </span>
          </label>
          {(query || activeFilters > 0) && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 mb-2 text-sm text-muted-foreground">
        {jobs === undefined
          ? "Loading…"
          : `${filtered.length} job${filtered.length === 1 ? "" : "s"}`}
      </div>

      {/* Two-pane feed */}
      {jobs === undefined ? (
        <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            list.length === 0
              ? onlyStrong
                ? "No strong matches right now"
                : "No jobs published yet"
              : "No jobs match your filters"
          }
          description={
            list.length === 0
              ? onlyStrong
                ? "Untick “Best matches only” to see every open role."
                : "Once employers start posting, opportunities will appear here."
              : "Try widening your search or clearing filters."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,400px)_1fr]">
          {/* List */}
          <div className="space-y-2">
            {filtered.map((j) => {
              const salary = formatSalary(j.salaryMin, j.salaryMax, j.salaryCurrency);
              const isSel = selected?._id === j._id;
              return (
                <button
                  key={j._id}
                  type="button"
                  onClick={() => setSelectedId(j._id)}
                  className={cn(
                    "w-full rounded-lg border bg-card p-4 text-left transition-colors",
                    isSel
                      ? "border-foreground ring-1 ring-foreground/20"
                      : "border-border hover:border-foreground/30",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold">
                      {initialsOf(j.employerName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{j.title}</span>
                        {j.applied && (
                          <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                            Applied
                          </span>
                        )}
                        {typeof j.matchScore === "number" && (
                          <span
                            title={
                              [...(j.matchReasons ?? []), ...(j.matchGaps ?? [])].join(" · ") ||
                              "Based on your program, skills, batch and city"
                            }
                            className={cn(
                              "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              j.strongMatch
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {j.matchScore}% match
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {j.employerName} ·{" "}
                        <span className="rounded bg-muted px-1 py-0.5 text-[10px]">
                          {j.employerTier}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {j.location}
                        </span>
                        <span>· {j.employmentType}</span>
                      </div>
                      {salary && (
                        <div className="mt-1 text-xs font-medium">{salary}</div>
                      )}
                      {j.skills && j.skills.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {j.skills.slice(0, 4).map((s) => (
                            <span
                              key={s}
                              className="rounded-full border border-border px-1.5 py-0.5 text-[10px]"
                            >
                              {s}
                            </span>
                          ))}
                          {j.skills.length > 4 && (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              +{j.skills.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail pane */}
          {selected && (
            <div className="hidden lg:block">
              <div className="sticky top-20">
                <JobDetail
                  job={selected}
                  busy={busyJobId === selected._id}
                  onApply={() => {
                    setDialogJobId(selected._id);
                    setCoverNote("");
                  }}
                />
              </div>
            </div>
          )}

          {/* Mobile detail (below list) */}
          {selected && (
            <div className="lg:hidden">
              <JobDetail
                job={selected}
                busy={busyJobId === selected._id}
                onApply={() => {
                  setDialogJobId(selected._id);
                  setCoverNote("");
                }}
              />
            </div>
          )}
        </div>
      )}

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

function initialsOf(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
}

function FilterChip({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-2.5 py-0.5 transition-colors",
        on
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function JobDetail({
  job,
  busy,
  onApply,
}: {
  job: Job;
  busy: boolean;
  onApply: () => void;
}) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const tags = [
    ...(job.targetingSkills ?? []),
    ...(job.targetingPrograms ?? []),
  ];
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold">
            {initialsOf(job.employerName)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold leading-tight">{job.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {job.employerName} ·{" "}
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                {job.employerTier}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <MapPin className="h-3.5 w-3.5" />
            {job.location}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <Briefcase className="h-3.5 w-3.5" />
            {job.employmentType}
          </span>
          {salary && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-300">
              {salary}
            </span>
          )}
          {job.publishedAt && (
            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
              Posted{" "}
              {new Date(job.publishedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>

        <div className="mt-4">
          <Button disabled={busy} onClick={onApply}>
            Apply now
          </Button>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-medium">About the role</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {job.description}
          </p>
        </div>

        {job.skills && job.skills.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium">Required skills</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border px-2 py-0.5 text-xs"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {tags.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium">Looking for</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border px-2 py-0.5 text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
