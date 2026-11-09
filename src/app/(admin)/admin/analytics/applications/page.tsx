"use client";

/**
 * Analytics drill-down — the application records behind the hiring KPIs.
 *
 * Opened from the "View list" quick links on /admin/analytics, carrying the
 * company / college / date filters in the URL. `view` picks the lens:
 *   applications  — every application in the slice
 *   hires         — hired applications only
 *   hire-rate     — every application, with hired / not-hired outcome filter
 *   time-to-hire  — hired applications, slowest first, flagged against target
 *
 * Live data: the same `api.adminData.applicationRecords` rows the Analytics
 * page aggregates, so every list total matches its KPI tile.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { Download, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/convex-api";
import { APPLICATION_STAGES, STAGE_LABEL, type ApplicationStage } from "@/lib/mock-admin";
import {
  TARGET_HIRE_RATE,
  TARGET_TIME_TO_HIRE,
  applyFilters,
  isDefaultFilters,
  parseAnalyticsFilters,
  toAnalyticsValues,
  type AnalyticsRecord,
} from "@/lib/analytics-filters";
import { quickLink } from "@/lib/use-url-filters";
import { StageBadge } from "@/components/auf/AdminBits";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DetailPage } from "@/components/auf/admin-ui";

type View = "applications" | "hires" | "hire-rate" | "time-to-hire";

const VIEWS: { value: View; label: string; description: string }[] = [
  { value: "applications", label: "Applications", description: "Every application in the selected period." },
  { value: "hires", label: "Hires", description: "Applications that ended in a hire." },
  { value: "hire-rate", label: "Hire rate", description: "Hired vs not hired across all applications." },
  { value: "time-to-hire", label: "Time to hire", description: "Hires ranked by days from application to hire — slowest first." },
];

type Outcome = "all" | "hired" | "not-hired";
const PAGE_SIZE = 50;

function fmtDay(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const NO_RECORDS: AnalyticsRecord[] = [];

export default function AnalyticsApplicationsPage() {
  const recordsQ = useQuery(api.adminData.applicationRecords);
  const loading = recordsQ === undefined;
  const records = recordsQ ?? NO_RECORDS;
  const router = useRouter();
  const sp = useSearchParams();
  const filters = useMemo(() => parseAnalyticsFilters(sp), [sp]);
  const rawView = sp.get("view");
  const view: View = VIEWS.some((v) => v.value === rawView) ? (rawView as View) : "applications";
  const viewMeta = VIEWS.find((v) => v.value === view)!;

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<"all" | ApplicationStage>("all");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const inSlice = useMemo(() => applyFilters(records, filters), [records, filters]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list: AnalyticsRecord[] = inSlice;
    if (view === "hires" || view === "time-to-hire") list = list.filter((r) => r.hired);
    if (view === "hire-rate" && outcome !== "all") {
      list = list.filter((r) => (outcome === "hired" ? r.hired : !r.hired));
    }
    if (stage !== "all") list = list.filter((r) => r.stage === stage);
    if (q) {
      list = list.filter((r) =>
        `${r.jobTitle} ${r.company} ${r.college} ${r.applicantName} ${r.program}`
          .toLowerCase()
          .includes(q),
      );
    }
    return [...list].sort((a, b) =>
      view === "time-to-hire"
        ? (b.timeToHireDays ?? 0) - (a.timeToHireDays ?? 0)
        : b.appliedAt.localeCompare(a.appliedAt),
    );
  }, [inSlice, view, outcome, stage, search]);

  const summary = useMemo(() => {
    const hires = inSlice.filter((r) => r.hired);
    const days = hires.map((r) => r.timeToHireDays).filter((d): d is number => d != null);
    const avg = days.length ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : null;
    return {
      total: inSlice.length,
      hires: hires.length,
      rate: inSlice.length ? hires.length / inSlice.length : 0,
      avg,
      overTarget: days.filter((d) => d > TARGET_TIME_TO_HIRE).length,
    };
  }, [inSlice]);

  const setView = (v: View) => {
    setLimit(PAGE_SIZE);
    setStage("all");
    setOutcome("all");
    router.replace(
      quickLink("/admin/analytics/applications", { ...toAnalyticsValues(filters), view: v }),
      { scroll: false },
    );
  };

  // Back to Analytics with exactly this slice (not whatever was saved before).
  const backHref = quickLink("/admin/analytics", toAnalyticsValues(filters));

  const onExport = () => {
    downloadCsv(
      `auf-${view}.csv`,
      ["Applied", "Applicant", "Program", "Batch", "Job title", "Company", "College", "Stage", "Hired", "Days to hire"],
      rows.map((r) => [
        r.appliedAt,
        r.applicantName,
        r.program,
        r.batch ?? "",
        r.jobTitle,
        r.company,
        r.college,
        STAGE_LABEL[r.stage],
        r.hired ? "Yes" : "No",
        r.timeToHireDays ?? "",
      ]),
    );
    toast.success(`Exported ${rows.length} records`);
  };

  const filterChips = [
    filters.company !== "all" ? filters.company : "All companies",
    filters.colleges.length
      ? filters.colleges.map((c) => c.replace("College of ", "")).join(", ")
      : "All colleges",
    `${fmtDay(filters.from)} – ${fmtDay(filters.to)}`,
  ];

  return (
    <DetailPage
      backHref={backHref}
      backLabel="Analytics"
      title={viewMeta.label}
      subtitle={viewMeta.description}
      actions={
        <Button variant="outline" size="sm" onClick={onExport} disabled={rows.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      }
    >

      {/* Active analytics filters */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        {filterChips.map((c) => (
          <span key={c} className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            {c}
          </span>
        ))}
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 px-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <SlidersHorizontal className="h-3 w-3" />
          {isDefaultFilters(filters) ? "Filter" : "Change filters"}
        </Link>
      </div>

      {/* View tabs */}
      <div className="mt-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Record view">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={view === v.value}
            onClick={() => setView(v.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              view === v.value
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Lens summary */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Applications" value={loading ? "…" : summary.total.toLocaleString()} />
        <Summary label="Hires" value={loading ? "…" : summary.hires.toLocaleString()} />
        <Summary
          label="Hire rate"
          value={loading ? "…" : `${(summary.rate * 100).toFixed(1)}%`}
          hint={`target ${(TARGET_HIRE_RATE * 100).toFixed(0)}%`}
          good={!loading && summary.total > 0 && summary.rate >= TARGET_HIRE_RATE}
        />
        <Summary
          label="Avg time to hire"
          value={loading ? "…" : summary.avg != null ? `${summary.avg}d` : "—"}
          hint={loading ? `target ${TARGET_TIME_TO_HIRE}d` : `${summary.overTarget} over ${TARGET_TIME_TO_HIRE}d target`}
          good={!loading && summary.avg != null && summary.avg <= TARGET_TIME_TO_HIRE}
        />
      </div>

      {/* Controls */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          placeholder="Search applicant, job title, company, college…"
          aria-label="Search records"
          className="w-full sm:w-72"
        />
        {view === "hire-rate" && (
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as Outcome)}
            aria-label="Outcome"
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          >
            <option value="all">All outcomes</option>
            <option value="hired">Hired</option>
            <option value="not-hired">Not hired</option>
          </select>
        )}
        {(view === "applications" || view === "hire-rate") && (
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as "all" | ApplicationStage)}
            aria-label="Stage"
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          >
            <option value="all">All stages</option>
            {APPLICATION_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length.toLocaleString()} record{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Records */}
      <Card className="mt-3">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground" aria-busy="true">
              Loading application records…
            </div>
          ) : records.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No applications yet — records appear here once alumni apply to
              published job postings.
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No records match. Try clearing the search or widening the filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Applied</th>
                    <th className="px-4 py-2.5 font-medium">Applicant</th>
                    <th className="px-4 py-2.5 font-medium">Job title</th>
                    <th className="px-4 py-2.5 font-medium">Company</th>
                    <th className="px-4 py-2.5 font-medium">College</th>
                    <th className="px-4 py-2.5 font-medium">Stage</th>
                    <th className="px-4 py-2.5 text-right font-medium">Days to hire</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map((r) => {
                    const slow = r.timeToHireDays != null && r.timeToHireDays > TARGET_TIME_TO_HIRE;
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                          {fmtDay(r.appliedAt)}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.applicantProfileId ? (
                            <Link
                              href={`/admin/alumni/${r.applicantProfileId}`}
                              className="font-medium underline-offset-2 hover:underline"
                            >
                              {r.applicantName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{r.applicantName}</span>
                          )}
                          {(r.program || r.batch != null) && (
                            <div className="text-[11px] text-muted-foreground">
                              {[r.program, r.batch != null ? `Batch ${r.batch}` : ""]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{r.jobTitle}</td>
                        <td className="px-4 py-2.5">
                          {r.employerOrgId ? (
                            <Link
                              href={`/admin/employers/${r.employerOrgId}`}
                              className="underline-offset-2 hover:underline"
                            >
                              {r.company}
                            </Link>
                          ) : (
                            r.company
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {r.college.replace("College of ", "")}
                        </td>
                        <td className="px-4 py-2.5">
                          <StageBadge stage={r.stage} />
                        </td>
                        <td
                          className={cn(
                            "px-4 py-2.5 text-right tabular-nums",
                            slow ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                          )}
                        >
                          {r.timeToHireDays != null ? `${r.timeToHireDays}d` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {rows.length > limit && (
        <div className="mt-3 text-center">
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, rows.length - limit)} more
          </Button>
        </div>
      )}
    </DetailPage>
  );
}

function Summary({
  label,
  value,
  hint,
  good,
}: {
  label: string;
  value: string;
  hint?: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-lg bg-card px-4 py-3 ring-1 ring-foreground/10">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
      {hint && (
        <div
          className={cn(
            "mt-0.5 text-[11px]",
            good ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          {good ? "✓ " : ""}
          {hint}
        </div>
      )}
    </div>
  );
}
