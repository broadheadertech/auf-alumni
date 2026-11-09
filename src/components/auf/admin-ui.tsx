"use client";

/**
 * The admin console's shared template.
 *
 * Every admin page used to build its own version of the same four things —
 * a page header, a row of stat tiles, a filter block and a table — so the
 * console had three different stat-tile designs, two different status-pill
 * treatments, and a KPI grid whose two rows used different column counts and
 * therefore did not line up. The result read as unfinished regardless of how
 * correct the data behind it was.
 *
 * These are the primitives. An admin page should be able to say what it is
 * about and hand over its rows; everything to do with density, alignment,
 * numerals and colour belongs here.
 *
 * Principles, for whoever extends this:
 *
 *   - Density is the point. This is a tool people work in for hours, not a
 *     landing page. Rows are compact and the type scale is small so that
 *     twenty records fit on a screen instead of seven.
 *   - Colour means something. A coloured row or chip signals a state that
 *     needs a decision. Decorative pastel panels spend the one signal the
 *     interface has, and then nothing stands out.
 *   - Numbers are tabular and right-aligned, so a column of them can be
 *     compared by eye without reading each one.
 *   - Destructive actions live behind a menu, never as a button repeated on
 *     every row of a 95-row table.
 */

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ page */

/**
 * Standard page header: what this screen is, one line on why, and the
 * actions that belong to the whole page.
 */
export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** A labelled band between major blocks of a page. */
export function SectionHeading({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-2 flex items-baseline justify-between gap-3 border-b border-border pb-1.5",
        className,
      )}
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- stats */

export type StatTone = "default" | "good" | "warn" | "bad";

const STAT_VALUE_TONE: Record<StatTone, string> = {
  default: "",
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-destructive",
};

/**
 * One metric. Deliberately flat — no card, no icon, no background.
 *
 * Twelve equally-weighted cards on a dashboard means nothing is weighted at
 * all, so the grid below separates them with rules instead and lets the
 * numbers themselves carry the hierarchy. Tone colours the number only,
 * which is where the meaning is.
 */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  href,
  delta,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: StatTone;
  href?: string;
  /** e.g. "+12%" — rendered small next to the value. */
  delta?: string;
}) {
  const inner = (
    <>
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-[26px] font-semibold leading-none tracking-tight tabular-nums",
            STAT_VALUE_TONE[tone],
          )}
        >
          {value}
        </span>
        {delta && (
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
            {delta}
          </span>
        )}
      </div>
      {hint && (
        <div className="mt-1 text-[11.5px] leading-tight text-muted-foreground">
          {hint}
        </div>
      )}
    </>
  );

  const base = "min-w-0 px-4 py-3 first:pl-0";
  if (!href) return <div className={base}>{inner}</div>;
  return (
    <Link
      href={href}
      className={cn(base, "block transition-colors hover:bg-muted/40")}
    >
      {inner}
    </Link>
  );
}

/**
 * A row of metrics separated by hairlines rather than boxed individually.
 *
 * One grid definition, so rows of three and rows of four can never disagree
 * about their column widths the way the analytics page's two stacked grids
 * did.
 */
export function StatStrip({
  children,
  className,
  "data-tour": dataTour,
}: {
  children: React.ReactNode;
  className?: string;
  /** Anchor for a spotlight tour step. */
  "data-tour"?: string;
}) {
  return (
    <div
      data-tour={dataTour}
      className={cn(
        "grid grid-cols-2 divide-x divide-border rounded-lg border border-border bg-card sm:grid-cols-3 lg:grid-cols-4",
        "[&>*]:border-t [&>*]:border-border [&>*:nth-child(-n+2)]:border-t-0",
        "sm:[&>*:nth-child(-n+3)]:border-t-0 lg:[&>*:nth-child(-n+4)]:border-t-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- status */

export type PillTone =
  | "neutral"
  | "good"
  | "warn"
  | "bad"
  | "info"
  | "muted";

const PILL_TONE: Record<PillTone, string> = {
  neutral: "text-foreground/80 before:bg-foreground/40",
  good: "text-emerald-700 dark:text-emerald-400 before:bg-emerald-500",
  warn: "text-amber-700 dark:text-amber-400 before:bg-amber-500",
  bad: "text-destructive before:bg-destructive",
  info: "text-[var(--brand)] before:bg-[var(--brand)]",
  muted: "text-muted-foreground before:bg-muted-foreground/40",
};

/**
 * A status label: a coloured dot and a word.
 *
 * Replaces the filled pill, which wrapped onto two lines for anything longer
 * than one word and clipped its own background when it did. A dot cannot
 * clip, stays legible at this size, and does not shout — which matters when
 * a table shows forty of them at once.
 */
export function Status({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap text-[12px] font-medium",
        "before:mr-1.5 before:inline-block before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:content-['']",
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A bordered chip, for counts and categories rather than states. */
export function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- table */

/**
 * Table shell. Scrolls horizontally rather than letting columns collapse —
 * a squashed admin table is harder to read than one you nudge sideways.
 */
export function DataTable({
  children,
  className,
  "data-tour": dataTour,
}: {
  children: React.ReactNode;
  className?: string;
  /** Anchor for a spotlight tour step. */
  "data-tour"?: string;
}) {
  return (
    <div
      data-tour={dataTour}
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-card",
        className,
      )}
    >
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
      {children}
    </thead>
  );
}

export function Th({
  children,
  align = "left",
  className,
  width,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  width?: string;
}) {
  return (
    <th
      style={width ? { width } : undefined}
      className={cn(
        "border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-border last:border-b-0 hover:bg-muted/40",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align = "left",
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-3 py-2 align-middle",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Name + secondary line, the commonest first column in this console. */
export function CellStack({
  primary,
  secondary,
  href,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="min-w-0">
      {href ? (
        <Link href={href} className="font-medium hover:underline">
          {primary}
        </Link>
      ) : (
        <div className="font-medium">{primary}</div>
      )}
      {secondary && (
        <div className="truncate text-[11.5px] text-muted-foreground">
          {secondary}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- actions */

export type RowAction = {
  label: string;
  onSelect?: () => void;
  href?: string;
  /** Renders in the destructive colour and below a separator. */
  destructive?: boolean;
  disabled?: boolean;
};

/**
 * The per-row overflow menu.
 *
 * User management used to put a role dropdown, a reason box and a red
 * Suspend button on every one of ninety-five rows. That is a wall of red,
 * and it puts an irreversible action one stray click from every row in the
 * table. Actions live in here now, with destructive ones separated at the
 * bottom.
 */
export function RowActions({
  actions,
  label = "Row actions",
}: {
  actions: RowAction[];
  label?: string;
}) {
  const safe = actions.filter((a) => !a.destructive);
  const danger = actions.filter((a) => a.destructive);
  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {safe.map((a) => (
          <DropdownMenuItem
            key={a.label}
            disabled={a.disabled}
            {...(a.href
              ? { render: <Link href={a.href}>{a.label}</Link> }
              : {
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    a.onSelect?.();
                  },
                  children: a.label,
                })}
          />
        ))}
        {danger.length > 0 && safe.length > 0 && <DropdownMenuSeparator />}
        {danger.map((a) => (
          <DropdownMenuItem
            key={a.label}
            disabled={a.disabled}
            className="text-destructive"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              a.onSelect?.();
            }}
          >
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------------------------------------------- layout */

/** A horizontal strip for filters and table-scoped controls. */
export function Toolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card px-3 py-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Count or summary line sitting between the toolbar and the table. */
export function ResultBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 py-2 text-[12px] text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** An inline banner for something that needs a decision. */
export function Callout({
  tone = "warn",
  children,
  action,
}: {
  tone?: "warn" | "bad" | "info";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[13px]",
        tone === "warn" &&
          "border-amber-500/30 bg-amber-500/[0.07] text-amber-900 dark:text-amber-200",
        tone === "bad" &&
          "border-destructive/30 bg-destructive/[0.06] text-destructive",
        tone === "info" && "border-border bg-muted/50",
      )}
    >
      <span className="min-w-0">{children}</span>
      {action}
    </div>
  );
}

/** Empty state for a table that has no rows. */
export function NoRows({
  children = "Nothing to show.",
  colSpan,
}: {
  children?: React.ReactNode;
  colSpan: number;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-3 py-10 text-center text-[13px] text-muted-foreground"
      >
        {children}
      </td>
    </tr>
  );
}
