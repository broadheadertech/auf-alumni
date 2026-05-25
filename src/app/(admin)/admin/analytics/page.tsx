"use client";

/**
 * School analytics dashboard (Epic 16 Stories 16.4 + 16.5).
 *
 * Aggregate counts only — the underlying `analytics.dashboard` query
 * enforces super-admin/moderator RBAC. CSV export route hits
 * `analytics.anonymisedExport` which collapses sub-5 buckets per
 * k-anonymity policy.
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import {
  CheckCircle2,
  GraduationCap,
  Briefcase,
  Building2,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/auf/EmptyState";

export default function AdminAnalyticsPage() {
  const data = useQuery(api.analytics.dashboard);
  const exportRows = useQuery(api.analytics.anonymisedExport);
  const [exporting, setExporting] = useState(false);

  if (data === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <EmptyState
          message="Admin access required"
          cta={{ label: "Sign in", href: "/login" }}
        />
      </div>
    );
  }

  const onDownloadCsv = () => {
    if (!Array.isArray(exportRows)) return;
    setExporting(true);
    try {
      const header = "program,batch,count\n";
      const body = exportRows
        .map(
          (r) =>
            `"${String(r.program).replace(/"/g, '""')}",${r.batch},${r.count}`,
        )
        .join("\n");
      const blob = new Blob([header + body], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auf-alumni-export-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            School analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate-only. Per-alumna data is never surfaced here; CSV export
            collapses any bucket with fewer than 5 individuals per k-anonymity
            policy.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadCsv}
          disabled={exporting || !Array.isArray(exportRows)}
        >
          {exporting ? "Exporting…" : "Download CSV"}
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={CheckCircle2}
          label="Verified alumni"
          value={String(data.verifiedTotal)}
          sublabel={`+${data.verifiedNewThisMonth} this month`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Monthly active"
          value={String(data.mauMonthly)}
        />
        <MetricCard
          icon={Building2}
          label="Active employers"
          value={`${data.employersPartner} P · ${data.employersVerified} V`}
          sublabel="Partner / Verified"
        />
        <MetricCard
          icon={Briefcase}
          label="Open jobs"
          value={String(data.openJobs)}
          sublabel={`${data.applicationsThisMonth} apps this mo.`}
        />
        <MetricCard
          icon={GraduationCap}
          label="Avg. connections / alumna"
          value={data.avgConnectionsPerAlumna.toFixed(1)}
        />
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h2 className="text-sm font-medium">Anonymised cohort preview</h2>
          {!Array.isArray(exportRows) ? (
            <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />
          ) : exportRows.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No verified profiles yet.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 font-medium">Program</th>
                    <th className="py-1 font-medium">Batch</th>
                    <th className="py-1 font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {exportRows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1">{r.program}</td>
                      <td className="py-1">{r.batch}</td>
                      <td className="py-1">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        {sublabel && (
          <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
        )}
      </CardContent>
    </Card>
  );
}
