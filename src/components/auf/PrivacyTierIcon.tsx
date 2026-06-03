"use client";

import { useState } from "react";
import { Globe, GraduationCap, Users, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type PrivacyTier = "public" | "alumni" | "connections" | "private";

const TIER_META: Record<
  PrivacyTier,
  { label: string; icon: typeof Globe; description: string; color: string }
> = {
  public: {
    label: "Public",
    icon: Globe,
    description: "Visible to anyone, including search engines",
    color: "text-[var(--color-privacy-public)]",
  },
  alumni: {
    label: "Alumni only",
    icon: GraduationCap,
    description: "Visible only to verified AUF alumni",
    color: "text-[var(--color-privacy-alumni)]",
  },
  connections: {
    label: "Connections only",
    icon: Users,
    description: "Visible only to alumni you are connected to",
    color: "text-[var(--color-privacy-connections)]",
  },
  private: {
    label: "Private",
    icon: Lock,
    description: "Visible only to you",
    color: "text-[var(--color-privacy-private)]",
  },
};

const TIERS: PrivacyTier[] = ["public", "alumni", "connections", "private"];

type PrivacyTierIconProps = {
  tier: PrivacyTier;
  editable?: boolean;
  onChange?: (tier: PrivacyTier) => void;
  className?: string;
};

/**
 * Inline per-field privacy indicator. Read-only by default; editable mode opens
 * a popover with four tier choices. See ux-design-specification.md §Component Strategy.
 */
export function PrivacyTierIcon({
  tier,
  editable = false,
  onChange,
  className,
}: PrivacyTierIconProps) {
  const [open, setOpen] = useState(false);
  // Defensive: stale data in profiles.privacyTiers can produce values outside
  // the union. Fall back to "alumni" rather than crashing on .icon.
  const meta = TIER_META[tier] ?? TIER_META.alumni;
  const Icon = meta.icon;
  const ariaLabel = editable
    ? `Visibility: ${meta.label}. Click to change.`
    : `Visibility: ${meta.label}`;

  if (!editable) {
    return (
      <span title={meta.description} className="inline-flex">
        <Icon
          className={cn("h-4 w-4", meta.color, className)}
          aria-label={ariaLabel}
        />
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        aria-label={ariaLabel}
      >
        <Icon className={cn("h-4 w-4", meta.color)} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <p className="text-xs text-muted-foreground mb-2 px-2">
          Who can see this field?
        </p>
        <div className="flex flex-col gap-0.5">
          {TIERS.map((t) => {
            const m = TIER_META[t];
            const TierIcon = m.icon;
            const selected = t === tier;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onChange?.(t);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "bg-muted",
                )}
                aria-pressed={selected}
              >
                <TierIcon
                  className={cn("h-4 w-4 mt-0.5 shrink-0", m.color)}
                  aria-hidden="true"
                />
                <span className="flex-1">
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {m.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
