import {
  Sparkles,
  Briefcase,
  Handshake,
  Mic,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type OpenToKind =
  | "mentorship"
  | "hiring"
  | "referrals"
  | "speaking"
  | string;

type Meta = { label: string; icon: LucideIcon };

const KIND_META: Record<string, Meta> = {
  mentorship: { label: "Open to mentorship", icon: Sparkles },
  hiring: { label: "Open to hiring", icon: Briefcase },
  referrals: { label: "Open to referrals", icon: Handshake },
  speaking: { label: "Open to speaking", icon: Mic },
};

/**
 * Tolerant lookup — older profile data and the demo seed use capitalised
 * or verbose strings ("Mentorship", "Job referrals", "Refer", "Freelance"…).
 * Normalise to a canonical key, falling back to a "Open to {raw}" generic
 * label so unknown values render rather than crashing.
 */
function metaFor(raw: string): Meta {
  const k = raw.trim().toLowerCase();
  if (KIND_META[k]) return KIND_META[k];
  if (k.includes("mentor")) return KIND_META.mentorship;
  if (k.includes("hire") || k.includes("hiring") || k.includes("job"))
    return KIND_META.hiring;
  if (k.includes("refer")) return KIND_META.referrals;
  if (k.includes("speak") || k.includes("talk") || k.includes("panel"))
    return KIND_META.speaking;
  // Generic fallback for anything else (e.g. "Freelance", "Coffee chat").
  const pretty = raw.trim().replace(/^./, (c) => c.toUpperCase());
  return { label: pretty, icon: Tag };
}

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
  const meta = metaFor(kind);
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
