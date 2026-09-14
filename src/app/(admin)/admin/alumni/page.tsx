"use client";

/**
 * Alumni roster — every registered alumna with their employment signals.
 *
 * Live Convex data (api.adminAlumni.listRoster): hired / open-to-work status,
 * what roles they're applying to (joined from real applications), CV
 * availability, top skills, and application counts. Uses the standard
 * FilterPanel (URL-backed, persisted for the session): College -> Program from
 * the taxonomy tables, batch year/range, work status, employment status (from
 * the admin-managed statuses list), company applied to, and open-to-work.
 * Sortable columns; each row links to the per-alumna drill-down.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import {
  ArrowUpDown,
  ChevronRight,
  FileCheck2,
  FileX2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { WORK_STATUSES, type WorkStatus } from "@/lib/mock-admin";
import { useCollegePrograms } from "@/lib/use-program-options";
import { useLookupOptions } from "@/lib/use-lookup-options";
import { useUrlFilters } from "@/lib/use-url-filters";
import { parseBatchInput } from "@/lib/batch-input";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile, WorkStatusBadge } from "@/components/auf/AdminBits";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";
import {
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_TONE,
  type AccountStatus,
} from "@/lib/account-status";
import { cn } from "@/lib/utils";

type RosterApplication = {
  applicationId: string;
  jobTitle: string;
  company: string;
  stage: string;
};

type Alumna = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  batch: number;
  program: string;
  college: string;
  city: string;
  employmentStatus: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  openToWork: boolean;
  hired: boolean;
  workStatus: WorkStatus;
  skills: string[];
  cv: boolean;
  verifiedAt: number | null;
  accountStatus: AccountStatus;
  registeredAt: number;
  applications: RosterApplication[];
};

type SortKey = "name" | "batch" | "applications" | "registered";

const FILTER_KEYS = [
  "q",
  "college",
  "program",
  "batch",
  "workStatus",
  "employmentStatus",
  "company",
  "openToWork",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export default function AdminAlumniPage() {
  const data = useQuery(api.adminAlumni.listRoster);

  const { values, set, setMany, reset, restored } = useUrlFilters(
    "admin-alumni",
    FILTER_KEYS,
  );
  const taxonomy = useCollegePrograms();
  const employmentStatuses = useLookupOptions("status");
  const [sort, setSort] = useState<SortKey>("registered");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const alumni = useMemo(
    () => (data?.alumni ?? []) as Alumna[],
    [data],
  );
  const pendingCount = data?.pendingCount ?? 0;

  const companyOptions = useMemo(
    () =>
      Array.from(
        new Set(alumni.flatMap((a) => a.applications.map((ap) => ap.company))),
      ).sort(),
    [alumni],
  );

  const batch = parseBatchInput(values.batch);
  const collegePrograms = values.college ? taxonomy.programsFor(values.college) : [];

  const rows = useMemo(() => {
    const q = values.q.trim().toLowerCase();
    const years = batch.years;
    const list = alumni.filter((a) => {
      if (values.workStatus && a.workStatus !== values.workStatus) return false;
      if (values.college && a.college !== values.college) return false;
      if (values.program && a.program !== values.program) return false;
      if (years && !years.includes(a.batch)) return false;
      if (values.employmentStatus && a.employmentStatus !== values.employmentStatus)
        return false;
      if (values.openToWork === "yes" && !a.openToWork) return false;
      if (values.company && !a.applications.some((ap) => ap.company === values.company))
        return false;
      if (q) {
        const hay = [
          a.name,
          a.program,
          a.currentRole ?? "",
          a.currentCompany ?? "",
          a.city,
          ...a.skills,
          ...a.applications.map((ap) => ap.jobTitle),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const val = (a: Alumna): number | string => {
      switch (sort) {
        case "name":
          return a.name.toLowerCase();
        case "batch":
          return a.batch;
        case "applications":
          return a.applications.length;
        case "registered":
          return a.registeredAt;
      }
    };
    return [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const cmp =
        typeof va === "string"
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number);
      return dir === "asc" ? cmp : -cmp;
    });
  }, [alumni, values, batch.years, sort, dir]);

  const setSortKey = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "name" ? "asc" : "desc");
    }
  };

  const totals = useMemo(
    () => ({
      total: alumni.length,
      verified: alumni.filter((a) => a.verifiedAt != null).length,
      open: alumni.filter((a) => a.openToWork).length,
      hired: alumni.filter((a) => a.hired).length,
      applying: alumni.filter((a) => a.applications.length > 0).length,
    }),
    [alumni],
  );

  const fields: FilterField[] = [
    { type: "search", key: "q", label: "Search", placeholder: "Name, role, skill, job…" },
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
      key: "workStatus",
      label: "Work status",
      allLabel: "Any work status",
      options: WORK_STATUSES.map((w) => ({ value: w, label: w })),
    },
    {
      type: "select",
      key: "employmentStatus",
      label: "Employment status",
      allLabel: "Any employment status",
      options: employmentStatuses.options.map((o) => ({ value: o.name, label: o.name })),
    },
    {
      type: "select",
      key: "company",
      label: "Applied to company",
      allLabel: "Any company",
      options: companyOptions.map((c) => ({ value: c, label: c })),
    },
    {
      type: "select",
      key: "openToWork",
      label: "Open to work",
      allLabel: "Everyone",
      options: [{ value: "yes", label: "Open to work only" }],
    },
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

  const loading = data === undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Alumni</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Registered graduates, their job-seeking status, applications, and
        profile assessment.
      </p>

      {pendingCount > 0 && (
        <Link
          href="/admin/alumni/approvals"
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm transition-colors hover:bg-amber-500/10"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            <span className="font-medium">
              {pendingCount} alumnus registration
              {pendingCount === 1 ? "" : "s"} awaiting approval
            </span>
          </span>
          <span className="text-xs text-muted-foreground">Review queue →</span>
        </Link>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Registered" value={totals.total} hint={`${totals.verified} verified`} />
        <StatTile label="Open to work" value={totals.open} />
        <StatTile label="Hired via AUF" value={totals.hired} />
        <StatTile label="Actively applying" value={totals.applying} />
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

        {/* Table */}
        <section>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <Th label="Alumna" sortKey="name" {...{ sort, dir, setSortKey }} />
                      <Th label="Batch" sortKey="batch" {...{ sort, dir, setSortKey }} />
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Applying to</th>
                      <th className="px-3 py-2 text-center font-medium">CV</th>
                      <Th label="Apps" sortKey="applications" align="right" {...{ sort, dir, setSortKey }} />
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-muted-foreground">
                          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          {alumni.length === 0
                            ? "No alumni registered yet."
                            : "No alumni match these filters."}
                        </td>
                      </tr>
                    ) : (
                      rows.map((a) => (
                        <tr
                          key={a.id}
                          className="group border-b border-border align-top last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-3 py-3">
                            <Link
                              href={`/admin/alumni/${a.id}`}
                              className="flex items-start gap-3"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                                {a.initials}
                              </span>
                              <span className="min-w-0">
                                <span className="block font-medium group-hover:underline">
                                  {a.name}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {a.currentRole
                                    ? `${a.currentRole}${a.currentCompany ? " · " + a.currentCompany : ""}`
                                    : "No current role"}
                                </span>
                                <span className="text-[11px] text-muted-foreground/80">
                                  {a.college}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-3 tabular-nums text-muted-foreground">
                            {a.batch}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col items-start gap-1">
                              {a.accountStatus && (
                                <span
                                  className={cn(
                                    "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
                                    ACCOUNT_STATUS_TONE[a.accountStatus.kind],
                                  )}
                                >
                                  {ACCOUNT_STATUS_LABEL[a.accountStatus.kind]}
                                </span>
                              )}
                              <WorkStatusBadge status={a.workStatus} />
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {a.applications.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <div className="space-y-0.5">
                                {a.applications.slice(0, 2).map((ap) => (
                                  <div key={ap.applicationId} className="text-xs">
                                    <span className="font-medium">{ap.jobTitle}</span>
                                    <span className="text-muted-foreground">
                                      {" "}· {ap.company}
                                    </span>
                                  </div>
                                ))}
                                {a.applications.length > 2 && (
                                  <div className="text-[11px] text-muted-foreground">
                                    +{a.applications.length - 2} more
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {a.cv ? (
                              <FileCheck2 className="mx-auto h-4 w-4 text-emerald-600" />
                            ) : (
                              <FileX2 className="mx-auto h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {a.applications.length}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Link
                              href={`/admin/alumni/${a.id}`}
                              className="inline-flex text-muted-foreground hover:text-foreground"
                              aria-label={`Open ${a.name}`}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          {!loading && (
            <p className="mt-3 text-xs italic text-muted-foreground">
              Showing {rows.length} of {alumni.length} alumni · sorted by {sort}{" "}
              ({dir}).
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Th({
  label,
  sortKey,
  sort,
  dir,
  setSortKey,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  setSortKey: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort === sortKey;
  return (
    <th className={cn("px-3 py-2 font-medium", align === "right" ? "text-right" : "text-left")}>
      <button
        type="button"
        onClick={() => setSortKey(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
        {active && <span className="sr-only">{dir}</span>}
      </button>
    </th>
  );
}
