"use client";

/**
 * Employer job postings — the signed-in employer's listings with status,
 * applicant counts, and a stage breakdown per posting. Filter by status,
 * search, and post a new role (added to the local list for the prototype;
 * new posts would enter the admin moderation queue when wired to Convex).
 *
 * Mock-data prototype for stakeholder review — see lib/mock-admin.ts.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Search, Users } from "lucide-react";
import {
  APPLICATION_STAGES,
  STAGE_LABEL,
  currentEmployer,
  employerApplicantsForJob,
  fmtDate,
  type ApplicationStage,
  type EmployerPosting,
  type PostingStatus,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PostingStatusBadge, StatTile } from "@/components/auf/AdminBits";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | PostingStatus;

export default function EmployerJobsPage() {
  const employer = currentEmployer();
  const [extra, setExtra] = useState<EmployerPosting[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const all = useMemo(
    () => [...extra, ...employer.postings],
    [extra, employer],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) =>
        q ? (p.title + " " + p.location).toLowerCase().includes(q) : true,
      );
  }, [all, status, search]);

  const totals = useMemo(() => {
    const published = all.filter((p) => p.status === "published").length;
    const applicants = all.reduce(
      (s, p) => s + employerApplicantsForJob(p.id).length,
      0,
    );
    const pending = all.filter((p) => p.status === "pending-moderation").length;
    return { postings: all.length, published, applicants, pending };
  }, [all]);

  const addPosting = (p: EmployerPosting) => setExtra((cur) => [p, ...cur]);

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
        <Button size="sm" onClick={() => setDialogOpen(true)}>
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
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "published", "pending-moderation", "closed", "draft"] as StatusFilter[]).map(
            (s) => (
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
            ),
          )}
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

      <div className="mt-4 space-y-3">
        {visible.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              No postings match these filters.
            </CardContent>
          </Card>
        ) : (
          visible.map((p) => <PostingCard key={p.id} posting={p} />)
        )}
      </div>

      <PostJobDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={addPosting}
      />
    </div>
  );
}

function PostingCard({ posting }: { posting: EmployerPosting }) {
  const applicants = employerApplicantsForJob(posting.id);
  const stageCounts = useMemo(() => {
    const map = Object.fromEntries(
      APPLICATION_STAGES.map((s) => [s, 0]),
    ) as Record<ApplicationStage, number>;
    for (const a of applicants) map[a.stage] += 1;
    return map;
  }, [applicants]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">{posting.title}</h2>
              <PostingStatusBadge status={posting.status} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {posting.location} · {posting.employmentType} · {posting.salaryLabel}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Posted {fmtDate(posting.postedAt)} · closes {fmtDate(posting.closesAt)}
            </div>
          </div>
          <Link
            href={`/employer/applicants?posting=${posting.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            <Users className="h-3.5 w-3.5" />
            {applicants.length} applicant{applicants.length === 1 ? "" : "s"} →
          </Link>
        </div>

        {applicants.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-xs">
            {APPLICATION_STAGES.filter((s) => stageCounts[s] > 0).map((s) => (
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
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (p: EmployerPosting) => void;
}) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [description, setDescription] = useState("");
  const seq = useRef(0);

  const submit = () => {
    if (!title.trim() || !location.trim()) {
      toast.error("Title and location are required");
      return;
    }
    onCreate({
      id: `job-new-${seq.current++}`,
      title: title.trim(),
      location: location.trim(),
      employmentType: "Full-time",
      status: "pending-moderation",
      postedAt: "2026-06-28",
      closesAt: "2026-08-15",
      salaryLabel: salary.trim() || "Negotiable",
      applicants: [],
    });
    toast.success("Job submitted — awaiting admin moderation");
    setTitle("");
    setLocation("");
    setSalary("");
    setDescription("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post a new job</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="pj-title" className="text-xs">Job title</Label>
            <Input
              id="pj-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Backend Engineer"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pj-loc" className="text-xs">Location</Label>
              <Input
                id="pj-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Makati · Hybrid"
              />
            </div>
            <div>
              <Label htmlFor="pj-sal" className="text-xs">Salary</Label>
              <Input
                id="pj-sal"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="₱90k–₱130k / mo"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="pj-desc" className="text-xs">Description</Label>
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>
            <Plus className="h-4 w-4" />
            Submit for review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
