import { Sparkles, Briefcase, Handshake, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export type OpenToKind = "mentorship" | "hiring" | "referrals" | "speaking";

const KIND_META: Record<OpenToKind, { label: string; icon: typeof Sparkles }> = {
  mentorship: { label: "Open to mentorship", icon: Sparkles },
  hiring: { label: "Open to hiring", icon: Briefcase },
  referrals: { label: "Open to referrals", icon: Handshake },
  speaking: { label: "Open to speaking", icon: Mic },
};

type OpenToTagProps = {
  kind: OpenToKind;
  variant?: "outline" | "subtle";
  className?: string;
};

/**
 * Receptivity tag visible on profiles and directory cards.
 * See ux-design-specification.md §Component Strategy → OpenToTag.
 */
export function OpenToTag({
  kind,
  variant = "outline",
  className,
}: OpenToTagProps) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "outline" && "border border-border bg-background text-foreground",
        variant === "subtle" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
