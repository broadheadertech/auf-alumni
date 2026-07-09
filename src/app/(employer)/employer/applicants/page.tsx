"use client";

/**
 * Employer applicants (Convex) — every candidate who applied to this employer's
 * postings, read from real applications with the apply-time privacy-filtered
 * profile snapshot. Filter by posting, stage, and applied-date; search by
 * name/skill. Move candidates through the pipeline (persisted via Convex).
 */

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ChevronDown, FileText, Search } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StageBadge, StatTile } from "@/components/auf/employer-ui";
import { STAGE_ORDER, STAGE_LABEL, fmtDate } from "@/lib/employer-format";
import { cn } from "@/lib/utils";

type Applicant = {
  _id: string;
  jobId: string;
  jobTitle: string;
  stage: string;
  coverNote?: string;
  resumeFilename?: string;
  createdAt: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshot: any;
};

export default function EmployerApplicantsPage() {
  return (
    <Suspense fallback={<div className="p-10" />}>
      <ApplicantsInner />
    </Suspense>
  );
}

function ApplicantsInner() {
  const sp = useSearchParams();
  const initialPosting = sp.get("posting") ?? "all";

  const applicants = useQuery(api.jobs.myApplicants) as
    | Applicant[]
    | undefined;
  const jobs = useQuery(api.jobs.listMyOrgJobs);
  const moveApplication = useMutation(api.jobs.moveApplication);

  const [posting, setPosting] = useState<string>(initialPosting);
  const [stages, setStages] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = applicants ?? [];
    const q = search.trim().toLowerCase();
    const fromMs = from ? new Date(from).getTime() : 0;
    const toMs = to ? new Date(to).getTime() + 86_400_000 : Infinity;
    return list
      .filter((a) => (posting !== "all" ? a.jobId === posting : true))
      .filter((a) => (stages.length ? stages.includes(a.stage) : true))
      .filter((a) => a.createdAt >= fromMs && a.createdAt <= toMs)
      .filter((a) => {
        if (!q) return true;
        const hay = [
          a.snapshot?.displayName ?? "",
          a.snapshot?.currentRole ?? "",
          ...(a.snapshot?.skills ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) =>
        sort === "name"
          ? (a.snapshot?.displayName ?? "").localeCompare(
              b.snapshot?.displayName ?? "",
            )
          : b.createdAt - a.createdAt,
      );
  }, [applicants, posting, stages, from, to, search, sort]);

  const totals = useMemo(() => {
    const counts = Object.fromEntries(
      STAGE_ORDER.map((s) => [s, 0]),
    ) as Record<string, number>;
    for (const a of applicants ?? []) counts[a.stage] = (counts[a.stage] ?? 0) + 1;
    return counts;
  }, [applicants]);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const moveStage = async (a: Applicant, next: string) => {
    try {
      await moveApplication({ applicationId: a._id as never, stage: next });
      toast.success(
        `${a.snapshot?.displayName ?? "Applicant"} → ${STAGE_LABEL[next]}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move");
    }
  };

  const activeFilters =
    (posting !== "all" ? 1 : 0) +
    stages.length +
    (from ? 1 : 0) +
    (to ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Applicants</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Candidates who applied to your postings. Review, filter, and move them
        through your pipeline.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {STAGE_ORDER.map((s) => (
          <StatTile key={s} label={STAGE_LABEL[s]} value={totals[s]} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[230px_1fr]">
        {/* Filters */}
        <aside className="space-y-5">
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name or skill…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Posting
            </Label>
            <select
              value={posting}
              onChange={(e) => setPosting(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="all">All postings</option>
              {(jobs ?? []).map((p) => (
                <option key={p._id} value={p._id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Stage
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {STAGE_ORDER.map((s) => {
                const on = stages.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(stages, s, setStages)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {STAGE_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Applied between
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
            </div>
          </div>

          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => {
                setPosting("all");
                setStages([]);
                setFrom("");
                setTo("");
              }}
            >
              Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
            </Button>
          )}
        </aside>

        {/* List */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {rows.length} applicant{rows.length === 1 ? "" : "s"}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "recent" | "name")}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="recent">Most recent</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>

          <div className="space-y-2">
            {applicants === undefined ? (
              <Card>
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  Loading applicants…
                </CardContent>
              </Card>
            ) : rows.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  {(applicants ?? []).length === 0
                    ? "No applications yet. They'll appear here as alumni apply to your postings."
                    : "No applicants match these filters."}
                </CardContent>
              </Card>
            ) : (
              rows.map((a) => (
                <ApplicantRow
                  key={a._id}
                  applicant={a}
                  open={expanded === a._id}
                  onToggle={() =>
                    setExpanded(expanded === a._id ? null : a._id)
                  }
                  onMove={(s) => moveStage(a, s)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ApplicantRow({
  applicant: a,
  open,
  onToggle,
  onMove,
}: {
  applicant: Applicant;
  open: boolean;
  onToggle: () => void;
  onMove: (s: string) => void;
}) {
  const snap = a.snapshot ?? {};
  const skills: string[] = snap.skills ?? [];
  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {snap.initials ?? "—"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {snap.displayName ?? "Applicant"}
              </span>
              {snap.batch ? (
                <span className="text-xs text-muted-foreground">
                  Batch {snap.batch}
                  {snap.program ? ` · ${snap.program}` : ""}
                </span>
              ) : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {a.jobTitle} · applied {fmtDate(a.createdAt)}
            </div>
          </div>
          <StageBadge stage={a.stage} />
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {open && (
          <div className="border-t border-border px-4 py-3">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">
                    Current role
                  </span>
                  <div>
                    {snap.currentRole ?? "—"}
                    {snap.company ? ` · ${snap.company}` : ""}
                  </div>
                </div>
                {snap.city ? (
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Location
                    </span>
                    <div>{snap.city}</div>
                  </div>
                ) : null}
                {skills.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Top skills
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {skills.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {a.coverNote ? (
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Cover note
                    </span>
                    <div className="text-sm">{a.coverNote}</div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {a.resumeFilename ?? "No CV uploaded"}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Move to</span>
                  <select
                    value={a.stage}
                    onChange={(e) => onMove(e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    {STAGE_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
