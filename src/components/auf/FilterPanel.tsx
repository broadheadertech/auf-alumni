"use client";

/**
 * Standardized filter panel for list pages.
 *
 * Declarative fields (search, select, text) rendered consistently as a
 * sidebar or a horizontal bar, with an active-filter count, removable chips,
 * and a single "Reset filters" action. Pair with `useUrlFilters` so values
 * live in the URL and persist across navigation.
 *
 * Dependent dropdowns (College → Program) are expressed by the page: pass the
 * narrowed `options` for the child and clear it in `onChange` when the parent
 * changes.
 */

import { RotateCcw, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string; group?: string };

export type FilterField =
  | { type: "search"; key: string; label: string; placeholder?: string }
  | {
      type: "select";
      key: string;
      label: string;
      /** Label for the empty ("any") option, e.g. "All colleges". */
      allLabel: string;
      options: FilterOption[];
      disabled?: boolean;
      hint?: string;
    }
  | {
      type: "text";
      key: string;
      label: string;
      placeholder?: string;
      inputMode?: "numeric" | "text";
      maxLength?: number;
      /** Suggestions shown as a native datalist. */
      suggestions?: string[];
      hint?: string;
    }
  | {
      type: "date";
      key: string;
      label: string;
      /** YYYY-MM-DD bounds, e.g. tie "to" to the "from" value. */
      min?: string;
      max?: string;
      hint?: string;
    };

const controlClass =
  "h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60";

export function FilterPanel({
  fields,
  values,
  onChange,
  onReset,
  restored = false,
  layout = "sidebar",
  className,
  "data-tour": dataTour,
}: {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  /** True when filters were restored from an earlier visit this session. */
  restored?: boolean;
  layout?: "sidebar" | "bar";
  className?: string;
  /** Anchor for a spotlight tour step. */
  "data-tour"?: string;
}) {
  const active = fields.filter((f) => values[f.key]);
  const chipText = (f: FilterField) => {
    const v = values[f.key];
    if (f.type === "select") return f.options.find((o) => o.value === v)?.label ?? v;
    return v;
  };

  return (
    <section
      data-tour={dataTour}
      aria-label="Filters"
      className={cn(
        "rounded-lg bg-card ring-1 ring-foreground/10",
        layout === "sidebar" ? "p-4" : "px-3 py-2",
        className,
      )}
    >
      {/*
        In bar mode the controls carry their own names — a select reads
        "All colleges", a text box "e.g. 2021 or 2018-2022" — so the stacked
        label above each one was a second copy of the same word and cost a
        line of height per field. Seven filters became a 250px block above
        the table it was meant to narrow.
      */}
      {layout === "sidebar" && (
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Filters
        </h2>
        {active.length > 0 && (
          <span className="rounded-full bg-foreground px-1.5 text-[10px] font-semibold leading-4 text-background tabular-nums">
            {active.length}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={active.length === 0}
          className="ml-auto h-7 gap-1 px-2 text-xs text-muted-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Reset filters
        </Button>
      </div>
      )}
      {restored && active.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Kept from your last visit.
        </p>
      )}

      <div
        className={cn(
          layout === "sidebar"
            ? "mt-3 flex flex-col gap-3"
            : "flex flex-wrap items-center gap-2",
        )}
      >
        {fields.map((f) => {
          const id = `filter-${f.key}`;
          const value = values[f.key] ?? "";
          return (
            <div
              key={f.key}
              className={cn(
                layout === "bar" &&
                  (f.type === "search"
                    ? "min-w-[200px] flex-1"
                    : "min-w-[140px]"),
              )}
            >
              <Label
                htmlFor={id}
                className={cn(
                  "mb-1 block text-[11px] font-medium text-muted-foreground",
                  layout === "bar" && "sr-only",
                )}
              >
                {f.label}
              </Label>
              {f.type === "search" ? (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id={id}
                    type="search"
                    value={value}
                    placeholder={f.placeholder}
                    onChange={(e) => onChange(f.key, e.target.value)}
                    className={cn(layout === "bar" ? "h-8" : "h-9", "pl-8")}
                  />
                </div>
              ) : f.type === "select" ? (
                <SelectControl id={id} field={f} value={value} onChange={(v) => onChange(f.key, v)} />
              ) : f.type === "date" ? (
                <input
                  id={id}
                  type="date"
                  value={value}
                  min={f.min || undefined}
                  max={f.max || undefined}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  className={controlClass}
                />
              ) : (
                <>
                  <Input
                    id={id}
                    value={value}
                    placeholder={f.placeholder}
                    inputMode={f.inputMode}
                    maxLength={f.maxLength}
                    list={f.suggestions ? `${id}-list` : undefined}
                    onChange={(e) => onChange(f.key, e.target.value)}
                    className={layout === "bar" ? "h-8" : "h-9"}
                  />
                  {f.suggestions && (
                    <datalist id={`${id}-list`}>
                      {f.suggestions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  )}
                </>
              )}
              {"hint" in f && f.hint && layout !== "bar" && (
                <p className="mt-1 text-[11px] text-muted-foreground">{f.hint}</p>
              )}
            </div>
          );
        })}

        {/* The header (with its Reset) is hidden in bar mode, so the action
            lives at the end of the control row instead. */}
        {layout === "bar" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={active.length === 0}
            className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset{active.length > 0 ? ` (${active.length})` : ""}
          </Button>
        )}
      </div>

      {active.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap gap-1.5",
            layout === "bar"
              ? "mt-2"
              : "mt-3 border-t border-border pt-3",
          )}
        >
          {active.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onChange(f.key, "")}
              aria-label={`Remove filter ${f.label}: ${chipText(f)}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/70"
            >
              <span className="text-muted-foreground">{f.label}:</span>
              <span className="truncate font-medium">{chipText(f)}</span>
              <X className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SelectControl({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: Extract<FilterField, { type: "select" }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const known = field.options.some((o) => o.value === value);
  const groups = new Map<string, FilterOption[]>();
  const ungrouped: FilterOption[] = [];
  for (const o of field.options) {
    if (!o.group) ungrouped.push(o);
    else groups.set(o.group, [...(groups.get(o.group) ?? []), o]);
  }
  return (
    <select
      id={id}
      value={value}
      disabled={field.disabled}
      onChange={(e) => onChange(e.target.value)}
      className={controlClass}
    >
      <option value="">{field.allLabel}</option>
      {/* Keep a stale value visible (e.g. archived item) rather than silently dropping it. */}
      {value && !known && <option value={value}>{value}</option>}
      {ungrouped.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {[...groups.entries()].map(([group, opts]) => (
        <optgroup key={group} label={group}>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
