"use client";

import { useQuery } from "convex/react";
import { Loader2, Mail } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/auf/EmptyState";

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return `${Math.round(ms / 60000)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function AdminReportsPage() {
  const metrics = useQuery(api.admin.dashboardMetrics);

  if (metrics === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (metrics === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10">
        <EmptyState message="Admin access required" cta={{ label: "Sign in", href: "/login" }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <p className="text-sm text-muted-foreground">
        Weekly and monthly operational summaries.
      </p>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            This week
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Approved" value={String(metrics.approvedThisWeek)} />
            <Stat
              label="Median turnaround"
              value={formatDuration(metrics.medianTurnaroundMs)}
            />
            <Stat
              label="Target"
              value={formatDuration(metrics.targetTurnaroundMs)}
            />
            <Stat
              label="Status"
              value={metrics.onTrack ? "On track" : "Behind"}
              tone={metrics.onTrack ? "success" : "warning"}
            />
          </dl>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="space-y-3 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Scheduled summaries
          </h2>
          <p className="text-sm text-muted-foreground">
            Weekly and monthly digest emails are dispatched by Convex crons.
            Recipients are configured via the{" "}
            <code>ADMIN_NOTIFICATION_EMAIL</code> env var. The first weekly
            summary will land the following Sunday after this surface is
            enabled.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Reports are read-only here; emailing is automated.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          "mt-0.5 text-xl font-semibold " +
          (tone === "success"
            ? "text-[var(--color-success)]"
            : tone === "warning"
              ? "text-[var(--color-warning)]"
              : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}
