"use client";

/**
 * Employer applicants (Convex) — every candidate who applied to this employer's
 * postings, read from real applications with the apply-time privacy-filtered
 * profile snapshot. Standard FilterPanel (URL-backed, persisted for the
 * session): search, posting, stage, College → Program (taxonomy tables),
 * batch year/range, city, CV review state, and applied-date range. Move
 * candidates through the pipeline (persisted via Convex).
 *
 * `?posting=<jobId>` (linked from the postings page) opens a single posting.
 */

import { Suspense, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, ChevronDown, FileCheck2, FileText } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageBadge, StatTile } from "@/components/auf/employer-ui";
import { InterviewScheduler } from "@/components/auf/InterviewScheduler";
import { interviewState, INTERVIEW_STATE_LABEL, type Interview } from "@/lib/interview";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";
import { STAGE_ORDER, STAGE_LABEL, fmtDate } from "@/lib/employer-format";
import { useUrlFilters } from "@/lib/use-url-filters";
import { useCollegePrograms } from "@/lib/use-program-options";
import { useLookupOptions } from "@/lib/use-lookup-options";
import { parseBatchInput } from "@/lib/batch-input";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/auf/Pagination";
import { usePagination } from "@/lib/use-pagination";

const FILTER_KEYS = [
  "q",
  "posting",
  "stage",
  "college",
  "program",
  "batch",
  "city",
  "cv",
  "from",
  "to",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

type Applicant = {
  _id: string;
  jobId: string;
  jobTitle: string;
  stage: string;
  coverNote?: string;
  resumeFilename?: string;
  reviewedAt?: number;
  interview?: Interview | null;
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
  const applicants = useQuery(api.jobs.myApplicants) as
    | Applicant[]
    | undefined;
  const jobs = useQuery(api.jobs.listMyOrgJobs);
  const moveApplication = useMutation(api.jobs.moveApplication);
  const setReviewed = useMutation(api.jobs.setReviewed);

  const { values, set, setMany, reset, restored } = useUrlFilters(
    "employer-applicants",
    FILTER_KEYS,
  );
  const taxonomy = useCollegePrograms();
  const areas = useLookupOptions("area");
  const batch = parseBatchInput(values.batch);
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Plain computation (not memoized): the taxonomy helpers are rebuilt every
  // render, and the list is one employer's applicants.
  const { collegeOfProgram } = taxonomy;
  const rows = (() => {
    const list = applicants ?? [];
    const q = values.q.trim().toLowerCase();
    const years = batch.years;
    const fromMs = values.from ? new Date(values.from).getTime() : 0;
    const toMs = values.to ? new Date(values.to).getTime() + 86_400_000 : Infinity;
    return list
      .filter((a) => (values.posting ? a.jobId === values.posting : true))
      .filter((a) => (values.stage ? a.stage === values.stage : true))
      .filter((a) => {
        if (!values.college) return true;
        // Snapshots carry the program; the college comes from the taxonomy.
        const program: string | undefined = a.snapshot?.program;
        const college: string | null =
          a.snapshot?.college ?? (program ? collegeOfProgram(program) : null);
        return college === values.college;
      })
      .filter((a) => (values.program ? a.snapshot?.program === values.program : true))
      .filter((a) => (years ? years.includes(Number(a.snapshot?.batch)) : true))
      .filter((a) => (values.city ? a.snapshot?.city === values.city : true))
      .filter((a) =>
        !values.cv
          ? true
          : values.cv === "reviewed"
            ? Boolean(a.reviewedAt)
            : values.cv === "not-reviewed"
              ? !a.reviewedAt
              : !a.resumeFilename,
      )
      .filter((a) => a.createdAt >= fromMs && a.createdAt <= toMs)
      .filter((a) => {
        if (!q) return true;
        const hay = [
          a.snapshot?.displayName ?? "",
          a.snapshot?.currentRole ?? "",
          a.snapshot?.company ?? "",
          a.snapshot?.program ?? "",
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
  })();

  const paged = usePagination(rows, {
    resetKey: Object.values(values).join("|"),
  });

  const totals = useMemo(() => {
    const counts = Object.fromEntries(
      STAGE_ORDER.map((s) => [s, 0]),
    ) as Record<string, number>;
    for (const a of applicants ?? []) counts[a.stage] = (counts[a.stage] ?? 0) + 1;
    return counts;
  }, [applicants]);

  // Applicant counts per posting, for the posting dropdown labels.
  const perJob = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of applicants ?? []) m.set(a.jobId, (m.get(a.jobId) ?? 0) + 1);
    return m;
  }, [applicants]);

  // City: the admin-managed areas list first, then any city present on an
  // applicant snapshot that isn't in it.
  const cityOptions = useMemo(() => {
    const known = new Set(areas.options.map((a) => a.name));
    const extraCities = Array.from(
      new Set(
        (applicants ?? [])
          .map((a) => a.snapshot?.city as string | undefined)
          .filter((c): c is string => !!c && !known.has(c)),
      ),
    ).sort();
    return [
      ...areas.options.map((a) => ({ value: a.name, label: a.name, group: a.group })),
      ...extraCities.map((c) => ({
        value: c,
        label: c,
        group: known.size ? "Other" : undefined,
      })),
    ];
  }, [areas.options, applicants]);

  const collegePrograms = values.college ? taxonomy.programsFor(values.college) : [];

  const fields: FilterField[] = [
    { type: "search", key: "q", label: "Search", placeholder: "Name, role, or skill…" },
    {
      type: "select",
      key: "posting",
      label: "Posting",
      allLabel: "All postings",
      options: (jobs ?? []).map((p) => ({
        value: p._id,
        label: `${p.title} (${perJob.get(p._id) ?? 0})`,
      })),
    },
    {
      type: "select",
      key: "stage",
      label: "Stage",
      allLabel: "Any stage",
      options: STAGE_ORDER.map((s) => ({ value: s, label: STAGE_LABEL[s] })),
    },
    {
      type: "select",
      key: "college",
      label: "College",
      allLabel: "All colleges",
      options: taxonomy.colleges.map((c) => ({ value: c.name, label: c.name })),
    },
    {
      type: "select",
      key: "program",
      label: "Program / degree",
      allLabel: values.college ? "All programs in this college" : "All programs",
      options: (values.college ? collegePrograms : taxonomy.programs).map((p) => ({
        value: p.name,
        label: p.name,
        group: values.college ? undefined : p.collegeName,
      })),
    },
    {
      type: "text",
      key: "batch",
      label: "Batch (year)",
      placeholder: "e.g. 2021 or 2018-2022",
      maxLength: 9,
      hint: batch.error ?? undefined,
    },
    {
      type: "select",
      key: "city",
      label: "City",
      allLabel: "All cities",
      options: cityOptions,
    },
    {
      type: "select",
      key: "cv",
      label: "CV",
      allLabel: "Any CV state",
      options: [
        { value: "reviewed", label: "CV reviewed" },
        { value: "not-reviewed", label: "Not yet reviewed" },
        { value: "missing", label: "No CV uploaded" },
      ],
    },
    { type: "date", key: "from", label: "Applied from", max: values.to },
    { type: "date", key: "to", label: "Applied to", min: values.from },
  ];

  const onFilterChange = (key: string, value: string) => {
    if (key === "college") {
      // Dependent dropdown: keep the program only if it belongs to the new college.
      const keep =
        values.program && value && taxonomy.collegeOfProgram(values.program) === value;
      setMany({ college: value, program: keep ? values.program : "" });
    } else if (key === "program" && value && !values.college) {
      setMany({ program: value, college: taxonomy.collegeOfProgram(value) ?? "" });
    } else {
      set(key as FilterKey, value);
    }
  };

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

  const toggleReviewed = async (a: Applicant) => {
    const next = !a.reviewedAt;
    try {
      await setReviewed({ applicationId: a._id as never, reviewed: next });
      toast.success(
        next
          ? `Marked ${a.snapshot?.displayName ?? "applicant"}'s CV reviewed`
          : "Review mark cleared",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

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

      <div className="mt-6 grid gap-6 lg:grid-cols-[270px_1fr]">
        {/* Filters */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <FilterPanel
            fields={fields}
            values={values}
            onChange={onFilterChange}
            onReset={reset}
            restored={restored}
          />
        </aside>

        {/* List */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {rows.length} applicant{rows.length === 1 ? "" : "s"}
              <span className="ml-2 inline-flex items-center gap-1 text-xs">
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                {rows.filter((a) => a.reviewedAt).length} CV
                {rows.filter((a) => a.reviewedAt).length === 1 ? "" : "s"} reviewed
              </span>
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
                  {(applicants ?? []).length === 0 ? (
                    "No applications yet. They'll appear here as alumni apply to your postings."
                  ) : (
                    <>
                      No applicants match these filters.{" "}
                      <button
                        type="button"
                        onClick={reset}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        Reset filters
                      </button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              paged.pageItems.map((a) => (
                <ApplicantRow
                  key={a._id}
                  applicant={a}
                  open={expanded === a._id}
                  onToggle={() =>
                    setExpanded(expanded === a._id ? null : a._id)
                  }
                  onMove={(s) => moveStage(a, s)}
                  onToggleReviewed={() => toggleReviewed(a)}
                />
              ))
            )}
          </div>
          <Pagination state={paged} noun="applicant" />
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
  onToggleReviewed,
}: {
  applicant: Applicant;
  open: boolean;
  onToggle: () => void;
  onMove: (s: string) => void;
  onToggleReviewed: () => void;
}) {
  const snap = a.snapshot ?? {};
  const skills: string[] = snap.skills ?? [];
  const reviewed = Boolean(a.reviewedAt);
  const ivState = interviewState(a.interview);
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
              {ivState !== "none" && (
                <> · interview {INTERVIEW_STATE_LABEL[ivState].toLowerCase()}</>
              )}
            </div>
          </div>
          {reviewed && (
            <FileCheck2
              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-label="CV reviewed"
            />
          )}
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

                <InterviewScheduler
                  applicationId={a._id}
                  applicantName={snap.displayName ?? "the candidate"}
                  interview={a.interview ?? null}
                />
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {a.resumeFilename ?? "No CV uploaded"}
                </span>
                <Button
                  size="sm"
                  variant={reviewed ? "secondary" : "outline"}
                  onClick={onToggleReviewed}
                >
                  {reviewed ? (
                    <>
                      <FileCheck2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Reviewed
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Mark reviewed
                    </>
                  )}
                </Button>
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
