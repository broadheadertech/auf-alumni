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
import { WorkStatusBadge } from "@/components/auf/AdminBits";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";
import {
  AdminPage,
  Callout,
  DataTable,
  Stat,
  StatStrip,
  THead,
} from "@/components/auf/admin-ui";
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
    <AdminPage
      title="Alumni"
      description="Registered graduates, their job-seeking status and applications."
    >
      {pendingCount > 0 && (
        <Callout
          action={
            <Link
              href="/admin/alumni/approvals"
              className="shrink-0 text-[12px] font-medium underline underline-offset-2"
            >
              Review queue &rarr;
            </Link>
          }
        >
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {pendingCount} alumnus registration
            {pendingCount === 1 ? "" : "s"} awaiting approval
          </span>
        </Callout>
      )}

      <StatStrip data-tour="roster-stats" className={pendingCount > 0 ? "mt-3" : ""}>
        <Stat
          label="Registered"
          value={totals.total}
          hint={`${totals.verified} verified`}
        />
        <Stat label="Open to work" value={totals.open} tone="good" />
        <Stat label="Hired via AUF" value={totals.hired} />
        <Stat label="Actively applying" value={totals.applying} />
      </StatStrip>

      <FilterPanel
        data-tour="roster-filters"
        layout="bar"
        className="mt-3"
        fields={fields}
        values={values}
        onChange={onFilterChange}
        onReset={reset}
        restored={restored}
      />

      <div className="mt-3">
        <DataTable data-tour="roster-table">
                <THead>
                    <tr>
                      <Th label="Alumna" sortKey="name" {...{ sort, dir, setSortKey }} />
                      <Th label="Batch" sortKey="batch" {...{ sort, dir, setSortKey }} />
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Applying to</th>
                      <th className="px-3 py-2 text-center font-medium">CV</th>
                      <Th label="Apps" sortKey="applications" align="right" {...{ sort, dir, setSortKey }} />
                      <th className="px-3 py-2" />
                    </tr>
                </THead>
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
                          className="group border-b border-border last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-3 py-2">
                            <Link
                              href={`/admin/alumni/${a.id}`}
                              className="block min-w-0"
                            >
                              <span className="block truncate font-medium group-hover:underline">
                                {a.name}
                              </span>
                              {/* Role, employer and college on one line: three
                                  stacked lines made every row 80px tall and
                                  put five records on a screen. */}
                              <span className="block truncate text-[11.5px] text-muted-foreground">
                                {a.currentRole
                                  ? `${a.currentRole}${a.currentCompany ? " · " + a.currentCompany : ""}`
                                  : "No current role"}
                                <span className="text-muted-foreground/70">
                                  {" "}· {a.college}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {a.batch}
                          </td>
                          <td className="px-3 py-2 align-middle">
                            <div className="flex flex-wrap items-center gap-1">
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
                          <td className="px-3 py-2 align-middle">
                            {a.applications.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <div className="min-w-0 text-[12px]">
                                <span className="font-medium">
                                  {a.applications[0].jobTitle}
                                </span>
                                <span className="text-muted-foreground">
                                  {" "}· {a.applications[0].company}
                                </span>
                                {a.applications.length > 1 && (
                                  <span className="text-muted-foreground/70">
                                    {" "}+{a.applications.length - 1}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {a.cv ? (
                              <FileCheck2 className="mx-auto h-4 w-4 text-emerald-600" />
                            ) : (
                              <FileX2 className="mx-auto h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {a.applications.length}
                          </td>
                          <td className="px-3 py-2 text-right">
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
        </DataTable>
        {!loading && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Showing {rows.length} of {alumni.length} alumni · sorted by {sort} ({dir}).
          </p>
        )}
      </div>
    </AdminPage>
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
