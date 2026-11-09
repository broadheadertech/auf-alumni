"use client";

/**
 * Employer reports — exportable hiring summaries for the signed-in employer
 * org (live Convex data).
 *
 * A monthly hiring report table (applications → interviews → offers → hires →
 * rate) plus one-click exports (client-side CSV downloads) for the applicant
 * list, posting performance, and college breakdown. Period-filtered.
 *
 * Reads `api.adminData.myEmployerRecords` (the same application records as
 * employer Analytics and the admin analytics) and `api.jobs.listMyOrgJobs`.
 * Like the employer dashboard, it reports on the first organisation the user
 * manages.
 */

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { api } from "@/lib/convex-api";
import type { ApplicationRecord } from "../../../../../convex/adminData";
import { JOB_STATUS_LABEL, STAGE_LABEL, fmtDate } from "@/lib/employer-format";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/auf/AdminBits";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-03" → "Mar 2026". */
const fmtMonth = (key: string) => {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
};
/** "2026-03-14" → "Mar 14, 2026". */
const fmtIsoDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
};
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "employer";

/** Build a CSV string and trigger a download (client-side, no backend). */
function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EmployerReportsPage() {
  const orgs = useQuery(api.employerOrgs.listMine);
  const org = orgs?.[0];
  const data = useQuery(
    api.adminData.myEmployerRecords,
    org ? { employerOrgId: org._id } : "skip",
  ) as { orgs: { id: string; name: string }[]; records: ApplicationRecord[] } | undefined;
  const allJobs = useQuery(api.jobs.listMyOrgJobs);

  const history = useMemo(() => data?.records ?? [], [data]);
  const jobs = useMemo(
    () => (allJobs ?? []).filter((j) => org && j.employerOrgId === org._id),
    [allJobs, org],
  );

  // Empty bound = open-ended.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () =>
      history.filter(
        (r) => (!from || r.appliedAt >= from) && (!to || r.appliedAt <= to),
      ),
    [history, from, to],
  );

  const monthly = useMemo(() => {
    const keys = Array.from(
      new Set(filtered.map((r) => r.appliedAt.slice(0, 7))),
    ).sort();
    return keys.map((key) => {
      const rows = filtered.filter((r) => r.appliedAt.slice(0, 7) === key);
      const interviews = rows.filter((r) =>
        ["interview", "offered", "hired"].includes(r.stage),
      ).length;
      const offers = rows.filter((r) =>
        ["offered", "hired"].includes(r.stage),
      ).length;
      const hires = rows.filter((r) => r.hired).length;
      return {
        key,
        apps: rows.length,
        interviews,
        offers,
        hires,
        rate: rows.length ? hires / rows.length : 0,
      };
    });
  }, [filtered]);

  const totals = useMemo(() => {
    const apps = filtered.length;
    const hires = filtered.filter((r) => r.hired).length;
    return { apps, hires, rate: apps ? hires / apps : 0 };
  }, [filtered]);

  const minDate = history.length ? history[history.length - 1].appliedAt : undefined;
  const maxDate = history.length ? history[0].appliedAt : undefined;
  const periodFrom = from || minDate;
  const periodTo = to || maxDate;

  if (orgs === undefined || (org && (data === undefined || allJobs === undefined))) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 text-sm text-muted-foreground">
        Loading reports…
      </div>
    );
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <Card>
          <CardContent className="p-10 text-center">
            <h1 className="text-lg font-semibold">No employer organisation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your account isn&apos;t linked to an employer yet. Ask an AUF admin
              to grant your organisation access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const slug = slugify(org.name);

  const exportMonthly = () => {
    if (monthly.length === 0) {
      toast.error("No applications in this period to export");
      return;
    }
    downloadCsv(
      `${slug}-hiring-report.csv`,
      ["Month", "Applications", "Interviews", "Offers", "Hires", "Hire rate %"],
      monthly.map((m) => [
        fmtMonth(m.key),
        m.apps,
        m.interviews,
        m.offers,
        m.hires,
        (m.rate * 100).toFixed(1),
      ]),
    );
    toast.success("Hiring report exported");
  };

  const exportApplicants = () => {
    downloadCsv(
      `${slug}-applicants.csv`,
      ["Name", "Posting", "College", "Program", "Batch", "Applied", "Stage"],
      filtered.map((a) => [
        a.applicantName,
        a.jobTitle,
        a.college,
        a.program,
        a.batch ?? "",
        a.appliedAt,
        STAGE_LABEL[a.stage] ?? a.stage,
      ]),
    );
    toast.success("Applicant list exported");
  };

  const exportPostings = () => {
    const appsByJob = new Map<string, number>();
    const hiresByJob = new Map<string, number>();
    for (const r of filtered) {
      appsByJob.set(r.jobId, (appsByJob.get(r.jobId) ?? 0) + 1);
      if (r.hired) hiresByJob.set(r.jobId, (hiresByJob.get(r.jobId) ?? 0) + 1);
    }
    downloadCsv(
      `${slug}-postings.csv`,
      ["Posting", "Status", "Location", "Posted", "Applicants (period)", "Hires (period)"],
      jobs.map((p) => [
        p.title,
        JOB_STATUS_LABEL[p.status] ?? p.status,
        p.location,
        fmtDate(p.publishedAt ?? p.createdAt),
        appsByJob.get(p._id) ?? 0,
        hiresByJob.get(p._id) ?? 0,
      ]),
    );
    toast.success("Posting performance exported");
  };

  const exportColleges = () => {
    const map = new Map<string, number>();
    for (const a of filtered) map.set(a.college, (map.get(a.college) ?? 0) + 1);
    downloadCsv(
      `${slug}-applicants-by-college.csv`,
      ["College", "Applicants"],
      [...map.entries()].sort((a, b) => b[1] - a[1]),
    );
    toast.success("College breakdown exported");
  };

  const collegeCount = new Set(filtered.map((a) => a.college)).size;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Hiring summaries and exports for {org.name}. Choose a period, then
        download the report you need.
      </p>

      {/* Period */}
      <Card className="mt-5">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
              From
            </Label>
            <input
              type="date"
              value={from}
              min={minDate}
              max={to || maxDate}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
              To
            </Label>
            <input
              type="date"
              value={to}
              min={from || minDate}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          {(from || to) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              Reset
            </Button>
          )}
          <Button
            size="sm"
            className="ml-auto"
            onClick={exportMonthly}
            disabled={monthly.length === 0}
          >
            <Download className="h-4 w-4" />
            Export hiring report
          </Button>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatTile label="Applications" value={totals.apps} />
        <StatTile label="Hires" value={totals.hires} />
        <StatTile label="Hire rate" value={totals.apps ? `${(totals.rate * 100).toFixed(1)}%` : "—"} />
      </div>

      {/* Monthly hiring report */}
      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">Monthly hiring report</h2>
            <span className="text-xs text-muted-foreground">
              {periodFrom && periodTo
                ? `${fmtIsoDate(periodFrom)} – ${fmtIsoDate(periodTo)}`
                : "All time"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Month</th>
                  <th className="px-3 py-2 text-right font-medium">Apps</th>
                  <th className="px-3 py-2 text-right font-medium">Interviews</th>
                  <th className="px-3 py-2 text-right font-medium">Offers</th>
                  <th className="px-3 py-2 text-right font-medium">Hires</th>
                  <th className="px-3 py-2 text-right font-medium">Hire rate</th>
                </tr>
              </thead>
              <tbody>
                {monthly.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      {history.length === 0
                        ? "No applications yet. Reports fill in as alumni apply to your postings."
                        : "No applications in this period."}
                    </td>
                  </tr>
                ) : (
                  monthly.map((m) => (
                    <tr key={m.key} className="border-t border-border">
                      <td className="px-4 py-2">{fmtMonth(m.key)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.apps}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.interviews}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.offers}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.hires}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {(m.rate * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {monthly.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border bg-muted/30 font-medium">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{totals.apps}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {monthly.reduce((s, m) => s + m.interviews, 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {monthly.reduce((s, m) => s + m.offers, 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{totals.hires}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(totals.rate * 100).toFixed(0)}%
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Export cards */}
      <h2 className="mt-8 text-sm font-medium text-muted-foreground">
        Available exports
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ReportCard
          title="Applicant list"
          desc="Applicants in the period with posting, college, program, batch, and stage."
          meta={`${filtered.length} rows · CSV`}
          onExport={exportApplicants}
          disabled={filtered.length === 0}
        />
        <ReportCard
          title="Posting performance"
          desc="Every posting with status, posted date, and applicants / hires in the period."
          meta={`${jobs.length} rows · CSV`}
          onExport={exportPostings}
          disabled={jobs.length === 0}
        />
        <ReportCard
          title="Applicants by college"
          desc="Where your candidates studied — applicant counts per AUF college in the period."
          meta={`${collegeCount} rows · CSV`}
          onExport={exportColleges}
          disabled={filtered.length === 0}
        />
        <ReportCard
          title="Account summary"
          desc={`${org.tier.charAt(0).toUpperCase()}${org.tier.slice(1)} tier${
            org.planTier ? ` · ${org.planTier} plan` : ""
          } · ${jobs.length} posting${jobs.length === 1 ? "" : "s"}${
            org.createdAt ? ` · onboarded ${fmtDate(org.createdAt)}` : ""
          }.`}
          meta="View only"
          onExport={() =>
            toast.message(
              `${org.name} · ${org.tier} tier · ${jobs.filter((j) => j.status === "published").length} published postings`,
            )
          }
        />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Live data. CSV exports are generated in your browser from your
        organisation&apos;s applications and postings.
      </p>
    </div>
  );
}

function ReportCard({
  title,
  desc,
  meta,
  onExport,
  disabled,
}: {
  title: string;
  desc: string;
  meta: string;
  onExport: () => void;
  disabled?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
          <p className="mt-1 text-[11px] text-muted-foreground/80">{meta}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onExport} disabled={disabled}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </CardContent>
    </Card>
  );
}
