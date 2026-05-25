import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Suggestion = {
  label: string;
  onClick: () => void;
};

type CTA = {
  label: string;
  href: string;
};

type EmptyStateProps = {
  message: string;
  description?: string;
  suggestions?: Suggestion[];
  cta?: CTA;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
};

/**
 * Belonging-over-isolation pattern. Every empty state must include a constructive
 * next action — never a "no results, sorry" dead end. See
 * ux-design-specification.md §Desired Emotional Response → Principle 2.
 */
export function EmptyState({
  message,
  description,
  suggestions = [],
  cta,
  icon: Icon = Search,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center rounded-xl border border-border bg-card p-8 text-center",
        className,
      )}
    >
      <Icon className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <h3 className="text-base font-semibold text-foreground">{message}</h3>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}
      {suggestions.length > 0 && (
        <div className="mt-4 flex w-full flex-col gap-2">
          {suggestions.slice(0, 3).map((s) => (
            <Button
              key={s.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={s.onClick}
              className="justify-start"
            >
              {s.label}
            </Button>
          ))}
        </div>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
