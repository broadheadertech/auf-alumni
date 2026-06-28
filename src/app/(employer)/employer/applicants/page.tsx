"use client";

/**
 * Employer applicants — every candidate who applied to this employer's
 * postings. Filter by posting, stage, college, and applied-date; search by
 * name/skill; sort by recency or match. Each row expands to the applicant's
 * detail (skills, experience, CV) and the employer can move them through the
 * pipeline (stage change is local to this prototype).
 *
 * Mock-data prototype for stakeholder review — see lib/mock-admin.ts.
 */

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Download, FileText, Search } from "lucide-react";
import {
  APPLICATION_STAGES,
  COLLEGES,
  EMPLOYER_APPLICANTS,
  STAGE_LABEL,
  currentEmployer,
  fmtDate,
  type ApplicationStage,
  type College,
  type EmployerApplicant,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StageBadge, StatTile } from "@/components/auf/AdminBits";
import { cn } from "@/lib/utils";

export default function EmployerApplicantsPage() {
  return (
    <Suspense fallback={<div className="p-10" />}>
      <ApplicantsInner />
    </Suspense>
  );
}

function ApplicantsInner() {
  const employer = currentEmployer();
  const sp = useSearchParams();
  const initialPosting = sp.get("posting") ?? "all";

  // Stage overrides (employer moves candidates through the pipeline).
  const [stageOverride, setStageOverride] = useState<Record<string, ApplicationStage>>({});
  const [posting, setPosting] = useState<string>(initialPosting);
  const [stages, setStages] = useState<ApplicationStage[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "match">("recent");
  const [expanded, setExpanded] = useState<string | null>(null);

  const stageOf = (a: EmployerApplicant): ApplicationStage =>
    stageOverride[a.id] ?? a.stage;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EMPLOYER_APPLICANTS.filter((a) => {
      if (posting !== "all" && a.jobId !== posting) return false;
      if (stages.length && !stages.includes(stageOf(a))) return false;
      if (colleges.length && !colleges.includes(a.college)) return false;
      if (from && a.appliedAt < from) return false;
      if (to && a.appliedAt > to) return false;
      if (q) {
        const hay = [a.name, a.currentRole ?? "", ...a.topSkills]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) =>
      sort === "match"
        ? b.matchScore - a.matchScore
        : b.appliedAt.localeCompare(a.appliedAt),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posting, stages, colleges, from, to, search, sort, stageOverride]);

  const totals = useMemo(() => {
    const counts = Object.fromEntries(
      APPLICATION_STAGES.map((s) => [s, 0]),
    ) as Record<ApplicationStage, number>;
    for (const a of EMPLOYER_APPLICANTS) counts[stageOf(a)] += 1;
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageOverride]);

  const toggle = <T,>(arr: T[], v: T, set: (a: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const moveStage = (a: EmployerApplicant, next: ApplicationStage) => {
    setStageOverride((m) => ({ ...m, [a.id]: next }));
    toast.success(`${a.name} → ${STAGE_LABEL[next]}`);
  };

  const activeFilters =
    (posting !== "all" ? 1 : 0) +
    stages.length +
    colleges.length +
    (from ? 1 : 0) +
    (to ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Applicants</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Candidates who applied to {employer.name}&apos;s postings. Review,
        filter, and move them through your pipeline.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {APPLICATION_STAGES.map((s) => (
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
              {employer.postings.map((p) => (
                <option key={p.id} value={p.id}>
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
              {APPLICATION_STAGES.map((s) => {
                const on = stages.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(stages, s, setStages as (a: ApplicationStage[]) => void)}
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
              College
            </Label>
            <div className="flex flex-col gap-1">
              {COLLEGES.map((c) => {
                const on = colleges.includes(c);
                return (
                  <label key={c} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(colleges, c, setColleges as (a: College[]) => void)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                    />
                    <span className={on ? "font-medium" : ""}>
                      {c.replace("College of ", "")}
                    </span>
                  </label>
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
                setColleges([]);
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
              onChange={(e) => setSort(e.target.value as "recent" | "match")}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="recent">Most recent</option>
              <option value="match">Best match</option>
            </select>
          </div>

          <div className="space-y-2">
            {rows.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  No applicants match these filters.
                </CardContent>
              </Card>
            ) : (
              rows.map((a) => (
                <ApplicantRow
                  key={a.id}
                  applicant={a}
                  stage={stageOf(a)}
                  open={expanded === a.id}
                  onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
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
  stage,
  open,
  onToggle,
  onMove,
}: {
  applicant: EmployerApplicant;
  stage: ApplicationStage;
  open: boolean;
  onToggle: () => void;
  onMove: (s: ApplicationStage) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {a.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{a.name}</span>
              <span className="text-xs text-muted-foreground">
                Batch {a.batch} · {a.college.replace("College of ", "")}
              </span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {a.jobTitle} · applied {fmtDate(a.appliedAt)}
            </div>
          </div>
          <span className="hidden w-16 text-right text-xs tabular-nums text-muted-foreground sm:block">
            {a.matchScore}% match
          </span>
          <StageBadge stage={stage} />
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
                  <span className="text-xs text-muted-foreground">Current role</span>
                  <div>{a.currentRole ?? "—"} · {a.yearsExperience} yr exp</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Contact</span>
                  <div>{a.email} · {a.city}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Top skills</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {a.topSkills.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                {a.cv ? (
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                    {a.cv.filename}
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    No CV uploaded
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Move to</span>
                  <select
                    value={stage}
                    onChange={(e) => onMove(e.target.value as ApplicationStage)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    {APPLICATION_STAGES.map((s) => (
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
