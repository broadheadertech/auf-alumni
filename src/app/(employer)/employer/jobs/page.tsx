"use client";

/**
 * Employer job postings (Convex). The signed-in employer's real listings with
 * status, live applicant counts, and a stage breakdown per posting. Post a new
 * role → it's created in Convex as `pending-moderation` and enters the admin
 * review queue before going live to alumni.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Plus, Search, Users, X } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { JobStatusBadge, StatTile } from "@/components/auf/employer-ui";
import {
  STAGE_ORDER,
  STAGE_LABEL,
  fmtDate,
  salaryLabel,
} from "@/lib/employer-format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type StatusFilter =
  | "all"
  | "published"
  | "pending-moderation"
  | "suspended"
  | "closed";
type SortKey = "recent" | "oldest" | "applicants";

const EMP_TYPES: { value: string; label: string }[] = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

export default function EmployerJobsPage() {
  const orgs = useQuery(api.employerOrgs.listMine);
  const jobs = useQuery(api.jobs.listMyOrgJobs);
  const applicants = useQuery(api.jobs.myApplicants);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [empType, setEmpType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [dialogOpen, setDialogOpen] = useState(false);

  // stage breakdown per job
  const stagesByJob = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const a of applicants ?? []) {
      (m[a.jobId] ??= {})[a.stage] = (m[a.jobId]?.[a.stage] ?? 0) + 1;
    }
    return m;
  }, [applicants]);

  const all = useMemo(() => jobs ?? [], [jobs]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = from ? new Date(from).getTime() : 0;
    const toMs = to ? new Date(to).getTime() + 86_400_000 : Infinity;
    return all
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) => (empType === "all" ? true : p.employmentType === empType))
      .filter((p) => p.createdAt >= fromMs && p.createdAt <= toMs)
      .filter((p) =>
        q ? (p.title + " " + p.location).toLowerCase().includes(q) : true,
      )
      .sort((a, b) => {
        switch (sort) {
          case "oldest":
            return a.createdAt - b.createdAt;
          case "applicants":
            return b.applicantCount - a.applicantCount;
          case "recent":
          default:
            return b.createdAt - a.createdAt;
        }
      });
  }, [all, status, empType, from, to, search, sort]);

  const activeFilters =
    (status !== "all" ? 1 : 0) +
    (empType !== "all" ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0);
  const clearFilters = () => {
    setStatus("all");
    setEmpType("all");
    setFrom("");
    setTo("");
    setSearch("");
  };

  const totals = useMemo(() => {
    const published = all.filter((p) => p.status === "published").length;
    const pending = all.filter(
      (p) => p.status === "pending-moderation",
    ).length;
    const applicantCount = all.reduce((s, p) => s + p.applicantCount, 0);
    return { postings: all.length, published, applicants: applicantCount, pending };
  }, [all]);

  const org = orgs?.[0];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Job postings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Roles posted to verified AUF alumni. Every post is reviewed by the
            school before it goes live.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={!org}
        >
          <Plus className="h-4 w-4" />
          Post a job
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Postings" value={totals.postings} />
        <StatTile label="Published" value={totals.published} />
        <StatTile label="Pending review" value={totals.pending} />
        <StatTile label="Total applicants" value={totals.applicants} />
      </div>

      {/* Controls */}
      <div className="mt-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                "all",
                "published",
                "pending-moderation",
                "suspended",
                "closed",
              ] as StatusFilter[]
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  status === s
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all"
                  ? "All"
                  : s === "pending-moderation"
                    ? "Pending"
                    : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="relative sm:w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search postings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <span className="text-muted-foreground">Posted</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Posted from"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Posted to"
          />
          <span className="mx-1 h-4 w-px bg-border" />
          <select
            value={empType}
            onChange={(e) => setEmpType(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Employment type"
          >
            <option value="all">Any type</option>
            {EMP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Sort"
          >
            <option value="recent">Newest posted</option>
            <option value="oldest">Oldest posted</option>
            <option value="applicants">Most applicants</option>
          </select>
          {activeFilters > 0 && (
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

      <div className="mt-4 space-y-3">
        {jobs === undefined ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Loading postings…
            </CardContent>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              {all.length === 0
                ? "No postings yet. Click “Post a job” to create your first listing."
                : "No postings match these filters."}
            </CardContent>
          </Card>
        ) : (
          visible.map((p) => (
            <PostingCard
              key={p._id}
              posting={p}
              stageCounts={stagesByJob[p._id] ?? {}}
            />
          ))
        )}
      </div>

      {org ? (
        <PostJobDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          employerOrgId={org._id}
        />
      ) : null}
    </div>
  );
}

function PostingCard({
  posting,
  stageCounts,
}: {
  posting: {
    _id: string;
    title: string;
    location: string;
    employmentType: string;
    status: string;
    salaryMin?: number;
    salaryMax?: number;
    salaryCurrency?: string;
    createdAt: number;
    publishedAt?: number;
    applicantCount: number;
  };
  stageCounts: Record<string, number>;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">{posting.title}</h2>
              <JobStatusBadge status={posting.status} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {posting.location} · {posting.employmentType} ·{" "}
              {salaryLabel(
                posting.salaryMin,
                posting.salaryMax,
                posting.salaryCurrency,
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Posted {fmtDate(posting.createdAt)}
              {posting.publishedAt
                ? ` · published ${fmtDate(posting.publishedAt)}`
                : ""}
            </div>
          </div>
          <Link
            href={`/employer/applicants?posting=${posting._id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            <Users className="h-3.5 w-3.5" />
            {posting.applicantCount} applicant
            {posting.applicantCount === 1 ? "" : "s"} →
          </Link>
        </div>

        {posting.applicantCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-xs">
            {STAGE_ORDER.filter((s) => (stageCounts[s] ?? 0) > 0).map((s) => (
              <span key={s} className="text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">
                  {stageCounts[s]}
                </span>{" "}
                {STAGE_LABEL[s]}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PostJobDialog({
  open,
  onClose,
  employerOrgId,
}: {
  open: boolean;
  onClose: () => void;
  employerOrgId: string;
}) {
  const createJob = useMutation(api.jobs.createJob);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("full-time");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim() || !location.trim() || !description.trim()) {
      toast.error("Title, location, and description are required");
      return;
    }
    setSubmitting(true);
    try {
      await createJob({
        employerOrgId: employerOrgId as never,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        employmentType,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        salaryCurrency: "PHP",
      });
      toast.success("Job submitted — awaiting admin moderation");
      setTitle("");
      setLocation("");
      setSalaryMin("");
      setSalaryMax("");
      setDescription("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post job");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post a new job</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="pj-title" className="text-xs">
              Job title
            </Label>
            <Input
              id="pj-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Backend Engineer"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pj-loc" className="text-xs">
                Location
              </Label>
              <Input
                id="pj-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Makati · Hybrid"
              />
            </div>
            <div>
              <Label htmlFor="pj-type" className="text-xs">
                Employment type
              </Label>
              <select
                id="pj-type"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="mt-0.5 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                {EMP_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pj-min" className="text-xs">
                Salary min (₱/mo)
              </Label>
              <Input
                id="pj-min"
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="30000"
              />
            </div>
            <div>
              <Label htmlFor="pj-max" className="text-xs">
                Salary max (₱/mo)
              </Label>
              <Input
                id="pj-max"
                type="number"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="45000"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="pj-desc" className="text-xs">
              Description
            </Label>
            <Textarea
              id="pj-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the role does and who you're looking for."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            After you submit, an AUF admin reviews the listing before it goes
            live to alumni.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            <Plus className="h-4 w-4" />
            {submitting ? "Submitting…" : "Submit for review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
