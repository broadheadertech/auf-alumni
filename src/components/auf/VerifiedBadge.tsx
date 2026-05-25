import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

type VerifiedBadgeProps = {
  size?: "sm" | "md" | "lg";
  tone?: "default" | "subtle";
  className?: string;
};

/**
 * The emotional anchor for the verification trust thesis.
 * Distinct from LinkedIn's blue check — school-green with a graduation-cap glyph.
 * Use across directory cards, profile headers, message threads, job applications.
 * See ux-design-specification.md §Component Strategy → VerifiedBadge.
 */
export function VerifiedBadge({
  size = "md",
  tone = "default",
  className,
}: VerifiedBadgeProps) {
  const showLabel = size !== "sm";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" && "px-1.5 py-0.5 text-xs",
        size === "md" && "px-2 py-0.5 text-xs",
        size === "lg" && "px-2.5 py-1 text-sm",
        tone === "default" && "bg-[var(--color-verified)] text-white",
        tone === "subtle" &&
          "bg-[oklch(0.55_0.18_145_/_0.12)] text-[var(--color-verified)] ring-1 ring-[oklch(0.55_0.18_145_/_0.2)]",
        className,
      )}
      aria-label="Verified AUF Alumna"
    >
      <GraduationCap
        className={cn(
          size === "sm" && "h-3 w-3",
          size === "md" && "h-3.5 w-3.5",
          size === "lg" && "h-4 w-4",
        )}
        aria-hidden="true"
      />
      {showLabel && "Verified AUF"}
    </span>
  );
}
