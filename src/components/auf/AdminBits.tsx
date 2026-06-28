/**
 * Shared presentational atoms for the admin roster + drill-down surfaces.
 * Pure, prop-driven, no data access — safe to use in server or client trees.
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  STAGE_LABEL,
  POSTING_STATUS_LABEL,
  type ApplicationStage,
  type PostingStatus,
  type EmployerTier,
  type ContractState,
  type WorkStatus,
} from "@/lib/mock-admin";

export function StageBadge({ stage }: { stage: ApplicationStage }) {
  const tone: Record<ApplicationStage, string> = {
    new: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    screening: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    interview: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    offered: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    hired: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    "not-selected": "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        tone[stage],
      )}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function PostingStatusBadge({ status }: { status: PostingStatus }) {
  const tone: Record<PostingStatus, string> = {
    published: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    closed: "bg-muted text-muted-foreground",
    "pending-moderation": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    draft: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        tone[status],
      )}
    >
      {POSTING_STATUS_LABEL[status]}
    </span>
  );
}

export function TierBadge({ tier }: { tier: EmployerTier }) {
  const variant =
    tier === "Partner"
      ? "default"
      : tier === "Verified"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{tier}</Badge>;
}

export function ContractBadge({ state }: { state: ContractState }) {
  const map: Record<ContractState, { label: string; cls: string }> = {
    active: {
      label: "Active",
      cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    expiring: {
      label: "Expiring soon",
      cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    expired: {
      label: "Expired",
      cls: "bg-destructive/10 text-destructive",
    },
  };
  const { label, cls } = map[state];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        cls,
      )}
    >
      {label}
    </span>
  );
}

export function WorkStatusBadge({ status }: { status: WorkStatus }) {
  const tone: Record<WorkStatus, string> = {
    "Open to work": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    "Hired (via AUF)": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    Employed: "bg-muted text-muted-foreground",
    "Not looking": "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        tone[status],
      )}
    >
      {status}
    </span>
  );
}

/** Compact KPI tile used in the roster headers + detail summaries. */
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
    <div className="rounded-lg ring-1 ring-foreground/10 bg-card px-4 py-3">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</div>}
    </div>
  );
}

/** Score meter — used for EQ dimensions and skill levels. */
export function ScoreBar({
  value,
  label,
  suffix,
}: {
  value: number;
  label: string;
  suffix?: string;
}) {
  const tone =
    value >= 85
      ? "bg-emerald-500"
      : value >= 70
        ? "bg-sky-500"
        : value >= 50
          ? "bg-amber-500"
          : "bg-destructive";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {value}
          {suffix ?? ""}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
