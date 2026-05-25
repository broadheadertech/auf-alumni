"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { CheckCircle2, AlertTriangle, Clock, ListChecks } from "lucide-react";
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

export default function AdminDashboardPage() {
  const metrics = useQuery(api.admin.dashboardMetrics);

  if (metrics === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (metrics === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <EmptyState
          message="Admin access required"
          cta={{ label: "Sign in", href: "/login" }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Admin dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Verification queue health at a glance.
          </p>
        </div>
        <Link
          href="/admin/queue"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Open queue →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={ListChecks}
          label="Queue depth"
          value={String(metrics.queueDepth)}
          accent={
            metrics.queueDepth === 0
              ? "success"
              : metrics.queueDepth > 50
                ? "warning"
                : undefined
          }
        />
        <MetricCard
          icon={AlertTriangle}
          label="Flagged"
          value={String(metrics.flaggedCount)}
          accent={metrics.flaggedCount > 0 ? "warning" : undefined}
        />
        <MetricCard
          icon={Clock}
          label="Oldest pending"
          value={formatDuration(metrics.oldestPendingAgeMs)}
          accent={
            metrics.oldestPendingAgeMs > metrics.targetTurnaroundMs
              ? "warning"
              : undefined
          }
        />
        <MetricCard
          icon={CheckCircle2}
          label="Median this week"
          value={formatDuration(metrics.medianTurnaroundMs)}
          accent={metrics.onTrack ? "success" : "warning"}
          sublabel={`vs ${formatDuration(metrics.targetTurnaroundMs)} target · ${metrics.approvedThisWeek} approved`}
        />
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sublabel,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sublabel?: string;
  accent?: "success" | "warning";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Icon
            className={
              accent === "success"
                ? "h-4 w-4 text-[var(--color-success)]"
                : accent === "warning"
                  ? "h-4 w-4 text-[var(--color-warning)]"
                  : "h-4 w-4 text-muted-foreground"
            }
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 text-3xl font-semibold">{value}</div>
        {sublabel && (
          <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
        )}
      </CardContent>
    </Card>
  );
}
