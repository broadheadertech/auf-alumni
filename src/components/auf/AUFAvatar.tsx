/**
 * Initials avatar with a gradient placeholder background.
 * `grad` (1-6) picks one of the av-grad-* utilities in globals.css.
 * Verified-alumni badge optionally overlays the bottom-right corner.
 */

import { cn } from "@/lib/utils";

type Props = {
  name?: string;
  size?: number;
  grad?: 1 | 2 | 3 | 4 | 5 | 6;
  ring?: boolean;
  badge?: boolean;
  className?: string;
};

function initialsFrom(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

export function AUFAvatar({
  name = "",
  size = 36,
  grad = 1,
  ring = false,
  badge = false,
  className,
}: Props) {
  const px = { width: size, height: size, fontSize: size * 0.38 };
  return (
    <span className={cn("relative inline-block", className)}>
      <span
        className={cn(
          `av-grad-${grad}`,
          "text-white rounded-full font-semibold flex items-center justify-center",
          ring && "ring-brand",
        )}
        style={px}
      >
        {initialsFrom(name)}
      </span>
      {badge && (
        <span
          className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-[2px]"
          title="Verified alumni"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="oklch(0.55 0.18 145)">
            <path d="M12 1l3 2.5 4-.5L20 7l3.5 1L22 12l1.5 4L20 17l-1 3.5-4-.5L12 22.5 9 20l-4 .5L4 17l-3.5-1L2 12 .5 8 4 7l1-3.5 4 .5z" />
            <path
              d="M8 12l3 3 5-6"
              stroke="white"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </span>
  );
}
