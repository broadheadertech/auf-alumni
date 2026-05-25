"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export type PreviewViewer = "self" | "stranger" | "alumnus" | "connection";

const OPTIONS: { id: PreviewViewer; label: string }[] = [
  { id: "self", label: "You" },
  { id: "stranger", label: "A stranger" },
  { id: "alumnus", label: "Another alumna" },
  { id: "connection", label: "A connection" },
];

type Props = {
  value?: PreviewViewer;
  onChange?: (v: PreviewViewer) => void;
  className?: string;
};

/**
 * Segmented control that flips the profile view between viewer perspectives
 * (Experience Principle 3 — privacy by preview, not config).
 *
 * Persists local state by default; parent can lift the state via value/onChange.
 */
export function ProfilePreviewSwitcher({ value, onChange, className }: Props) {
  const [internal, setInternal] = useState<PreviewViewer>("self");
  const current = value ?? internal;
  const setCurrent = (next: PreviewViewer) => {
    if (onChange) onChange(next);
    else setInternal(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Preview as"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 text-xs",
        className,
      )}
    >
      <Eye className="ml-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {OPTIONS.map((opt) => {
        const active = current === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setCurrent(opt.id)}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
