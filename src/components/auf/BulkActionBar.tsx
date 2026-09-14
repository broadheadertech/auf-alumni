"use client";

/**
 * Bulk-selection toolbar + checkbox for list pages (pair with useBulkSelection).
 *
 * The bar always shows the master checkbox with "Select all" / "Unselect all";
 * when rows are selected it shows the count and the page's bulk actions.
 */

import { useEffect, useRef } from "react";
import { CheckSquare, XSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Native checkbox with indeterminate support (matches existing list styling). */
export function SelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={label}
      aria-checked={indeterminate ? "mixed" : checked}
      className={cn("h-4 w-4 cursor-pointer rounded border-border accent-foreground", className)}
    />
  );
}

export function BulkActionBar({
  count,
  total,
  allSelected,
  someSelected,
  onSelectAll,
  onUnselectAll,
  noun = "item",
  children,
  className,
}: {
  count: number;
  total: number;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  onUnselectAll: () => void;
  /** Singular noun for the count, e.g. "user". */
  noun?: string;
  /** Bulk action buttons, shown when something is selected. */
  children?: React.ReactNode;
  className?: string;
}) {
  const plural = (n: number) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ring-1 transition-colors",
        count > 0 ? "bg-foreground/4 ring-foreground/20" : "bg-card ring-foreground/10",
        className,
      )}
    >
      <SelectCheckbox
        checked={allSelected}
        indeterminate={someSelected}
        onChange={allSelected ? onUnselectAll : onSelectAll}
        label={allSelected ? "Unselect all" : "Select all"}
        disabled={total === 0}
      />
      <span className="text-sm tabular-nums" aria-live="polite">
        {count > 0 ? (
          <>
            <span className="font-medium">{count}</span> of {plural(total)} selected
          </>
        ) : (
          <span className="text-muted-foreground">{plural(total)}</span>
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onSelectAll}
        disabled={total === 0 || allSelected}
        className="h-7 gap-1 px-2 text-xs"
      >
        <CheckSquare className="h-3.5 w-3.5" /> Select all
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onUnselectAll}
        disabled={count === 0}
        className="h-7 gap-1 px-2 text-xs"
      >
        <XSquare className="h-3.5 w-3.5" /> Unselect all
      </Button>
      {count > 0 && children && (
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">{children}</div>
      )}
    </div>
  );
}
