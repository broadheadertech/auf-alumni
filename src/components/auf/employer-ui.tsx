/**
 * Small presentational bits for the Convex-backed employer console.
 * Self-contained (no mock-data imports).
 */

import { cn } from "@/lib/utils";
import { STAGE_LABEL, JOB_STATUS_LABEL } from "@/lib/employer-format";

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {hint ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

const STAGE_TONE: Record<string, string> = {
  new: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  screening: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  interview: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  offered: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  hired: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "not-selected": "bg-muted text-muted-foreground",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        STAGE_TONE[stage] ?? "bg-muted text-muted-foreground",
      )}
    >
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  published: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "pending-moderation": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  suspended: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  closed: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
};

export function JobStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_TONE[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {JOB_STATUS_LABEL[status] ?? status}
    </span>
  );
}
