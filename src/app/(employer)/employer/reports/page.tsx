"use client";

/**
 * Employer reports — exportable hiring summaries for the signed-in employer.
 *
 * A monthly hiring report table (applications → interviews → offers → hires →
 * rate) plus one-click exports (real client-side CSV downloads) for the
 * applicant list, posting performance, and college breakdown. Period-filtered.
 *
 * Mock-data prototype for stakeholder review — see lib/mock-admin.ts.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  ANALYTICS_DATE_MAX,
  ANALYTICS_DATE_MIN,
  EMPLOYER_APPLICANTS,
  STAGE_LABEL,
  contractState,
  currentEmployer,
  currentEmployerHistory,
  employerApplicantsForJob,
  fmtDate,
  fmtMonth,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/auf/AdminBits";

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
  const employer = currentEmployer();
  const history = useMemo(() => currentEmployerHistory(), []);
  const [from, setFrom] = useState(ANALYTICS_DATE_MIN);
  const [to, setTo] = useState(ANALYTICS_DATE_MAX);

  const filtered = useMemo(
    () => history.filter((r) => r.appliedAt >= from && r.appliedAt <= to),
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

  const exportMonthly = () => {
    downloadCsv(
      "kollab-ai-hiring-report.csv",
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
      "kollab-ai-applicants.csv",
      ["Name", "Posting", "College", "Batch", "Applied", "Stage", "Match %", "Years exp"],
      EMPLOYER_APPLICANTS.map((a) => [
        a.name,
        a.jobTitle,
        a.college,
        a.batch,
        a.appliedAt,
        STAGE_LABEL[a.stage],
        a.matchScore,
        a.yearsExperience,
      ]),
    );
    toast.success("Applicant list exported");
  };

  const exportPostings = () => {
    downloadCsv(
      "kollab-ai-postings.csv",
      ["Posting", "Status", "Location", "Posted", "Closes", "Applicants"],
      employer.postings.map((p) => [
        p.title,
        p.status,
        p.location,
        p.postedAt,
        p.closesAt,
        employerApplicantsForJob(p.id).length,
      ]),
    );
    toast.success("Posting performance exported");
  };

  const exportColleges = () => {
    const map = new Map<string, number>();
    for (const a of EMPLOYER_APPLICANTS)
      map.set(a.college, (map.get(a.college) ?? 0) + 1);
    downloadCsv(
      "kollab-ai-applicants-by-college.csv",
      ["College", "Applicants"],
      [...map.entries()].sort((a, b) => b[1] - a[1]),
    );
    toast.success("College breakdown exported");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Hiring summaries and exports for {employer.name}. Choose a period, then
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
              min={ANALYTICS_DATE_MIN}
              max={to}
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
              min={from}
              max={ANALYTICS_DATE_MAX}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <Button size="sm" className="ml-auto" onClick={exportMonthly}>
            <Download className="h-4 w-4" />
            Export hiring report
          </Button>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatTile label="Applications" value={totals.apps} />
        <StatTile label="Hires" value={totals.hires} />
        <StatTile label="Hire rate" value={`${(totals.rate * 100).toFixed(1)}%`} />
      </div>

      {/* Monthly hiring report */}
      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">Monthly hiring report</h2>
            <span className="text-xs text-muted-foreground">
              {fmtDate(from)} – {fmtDate(to)}
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
                      No data in this period.
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
          desc="All current applicants with posting, college, stage, and match score."
          meta={`${EMPLOYER_APPLICANTS.length} rows · CSV`}
          onExport={exportApplicants}
        />
        <ReportCard
          title="Posting performance"
          desc="Every posting with status, dates, and applicant counts."
          meta={`${employer.postings.length} rows · CSV`}
          onExport={exportPostings}
        />
        <ReportCard
          title="Applicants by college"
          desc="Where your candidates studied — applicant counts per AUF college."
          meta="CSV"
          onExport={exportColleges}
        />
        <ReportCard
          title="Compliance summary"
          desc={`MOA ${employer.moa ? "on file" : "missing"} · contract ${contractState(employer)} · ends ${fmtDate(employer.contractEnd)}.`}
          meta="View only"
          onExport={() =>
            toast.message(
              `Contract ${contractState(employer)} · ${employer.moa ? "MOA on file" : "MOA missing"}`,
            )
          }
        />
      </div>

      <p className="mt-4 text-xs italic text-muted-foreground">
        Demo data. CSV exports are generated in your browser from the prototype
        dataset.
      </p>
    </div>
  );
}

function ReportCard({
  title,
  desc,
  meta,
  onExport,
}: {
  title: string;
  desc: string;
  meta: string;
  onExport: () => void;
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
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </CardContent>
    </Card>
  );
}
