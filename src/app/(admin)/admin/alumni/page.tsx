"use client";

/**
 * Alumni roster — every registered alumna with their employment signals.
 *
 * Shows hired / open-to-work status, what roles they're applying to, CV
 * availability, EQ composite, top skills, and certifications count. Filterable
 * by work status, college, batch, company-applied-to, and open-to-work; full
 * text search; sortable columns (name, batch, EQ, # applications, registered).
 * Each row links to the per-alumna drill-down.
 *
 * Mock-data prototype for stakeholder review — see lib/mock-admin.ts.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  ChevronRight,
  FileCheck2,
  FileX2,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  ALUMNAE,
  BATCHES,
  COLLEGES,
  COMPANIES,
  PENDING_ALUMNI,
  WORK_STATUSES,
  type AdminAlumna,
  type College,
  type WorkStatus,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatTile, WorkStatusBadge } from "@/components/auf/AdminBits";
import { cn } from "@/lib/utils";

type SortKey = "name" | "batch" | "eq" | "applications" | "registered";

export default function AdminAlumniPage() {
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<WorkStatus[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [batches, setBatches] = useState<number[]>([]);
  const [company, setCompany] = useState<string>("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("registered");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = ALUMNAE.filter((a) => {
      if (statuses.length && !statuses.includes(a.workStatus)) return false;
      if (colleges.length && !colleges.includes(a.college)) return false;
      if (batches.length && !batches.includes(a.batch)) return false;
      if (openOnly && !a.openToWork) return false;
      if (company !== "all" && !a.applications.some((ap) => ap.company === company))
        return false;
      if (q) {
        const hay = [
          a.name,
          a.program,
          a.currentRole ?? "",
          a.currentCompany ?? "",
          a.city,
          ...a.skills.map((s) => s.name),
          ...a.applications.map((ap) => ap.jobTitle),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const val = (a: AdminAlumna): number | string => {
      switch (sort) {
        case "name":
          return a.name.toLowerCase();
        case "batch":
          return a.batch;
        case "eq":
          return a.eqScore;
        case "applications":
          return a.applications.length;
        case "registered":
          return new Date(a.registeredAt).getTime();
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
  }, [search, statuses, colleges, batches, company, openOnly, sort, dir]);

  const setSortKey = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "name" ? "asc" : "desc");
    }
  };

  const toggle = <T,>(arr: T[], v: T, set: (a: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const totals = useMemo(
    () => ({
      total: ALUMNAE.length,
      open: ALUMNAE.filter((a) => a.openToWork).length,
      hired: ALUMNAE.filter((a) => a.hired).length,
      applying: ALUMNAE.filter((a) => a.applications.length > 0).length,
    }),
    [],
  );

  const activeFilters =
    statuses.length +
    colleges.length +
    batches.length +
    (company !== "all" ? 1 : 0) +
    (openOnly ? 1 : 0);

  const clearAll = () => {
    setStatuses([]);
    setColleges([]);
    setBatches([]);
    setCompany("all");
    setOpenOnly(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Alumni</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Registered graduates, their job-seeking status, applications, and
        profile assessment.
      </p>

      {PENDING_ALUMNI.length > 0 && (
        <Link
          href="/admin/alumni/approvals"
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm transition-colors hover:bg-amber-500/10"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            <span className="font-medium">
              {PENDING_ALUMNI.length} alumnus registration
              {PENDING_ALUMNI.length === 1 ? "" : "s"} awaiting approval
            </span>
          </span>
          <span className="text-xs text-muted-foreground">Review queue →</span>
        </Link>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Registered" value={totals.total} />
        <StatTile label="Open to work" value={totals.open} />
        <StatTile label="Hired via AUF" value={totals.hired} />
        <StatTile label="Actively applying" value={totals.applying} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Filters */}
        <aside className="space-y-5">
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name, role, skill, job…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className={openOnly ? "font-medium" : ""}>
              Open to work only
            </span>
          </label>

          <CheckGroup
            label="Work status"
            options={WORK_STATUSES.map((s) => ({ value: s, label: s }))}
            active={statuses}
            onToggle={(v) => toggle(statuses, v, setStatuses as (a: WorkStatus[]) => void)}
          />

          <CheckGroup
            label="College"
            options={COLLEGES.map((c) => ({ value: c, label: c }))}
            active={colleges}
            onToggle={(v) => toggle(colleges, v, setColleges as (a: College[]) => void)}
          />

          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Applied to company
            </Label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="all">Any company</option>
              {COMPANIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Batch
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {BATCHES.map((b) => {
                const on = batches.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggle(batches, b, setBatches as (a: number[]) => void)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="w-full justify-start text-muted-foreground"
            >
              Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
            </Button>
          )}
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
                      <Th label="EQ" sortKey="eq" align="right" {...{ sort, dir, setSortKey }} />
                      <th className="px-3 py-2 text-center font-medium">CV</th>
                      <Th label="Apps" sortKey="applications" align="right" {...{ sort, dir, setSortKey }} />
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          No alumni match these filters.
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
                            <WorkStatusBadge status={a.workStatus} />
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
                          <td className="px-3 py-3 text-right tabular-nums">
                            {a.eqScore}
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
          <p className="mt-3 text-xs italic text-muted-foreground">
            Showing {rows.length} of {ALUMNAE.length} alumni · sorted by{" "}
            {sort} ({dir}) · demo data for stakeholder review.
          </p>
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

function CheckGroup<T extends string>({
  label,
  options,
  active,
  onToggle,
}: {
  label: string;
  options: { value: T; label: string }[];
  active: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-col gap-1">
        {options.map((o) => {
          const on = active.includes(o.value);
          return (
            <label
              key={o.value}
              className="flex cursor-pointer items-start gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(o.value)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
              />
              <span className={on ? "font-medium" : ""}>{o.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
