import Link from "next/link";
import { Briefcase, GraduationCap, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { VerifiedBadge } from "@/components/auf/VerifiedBadge";
import { OpenToTag, type OpenToKind } from "@/components/auf/OpenToTag";

export type DirectoryCardData = {
  slug: string;
  displayName: string;
  initials: string;
  batch: number;
  program: string;
  currentRole?: string;
  company?: string;
  city?: string;
  country?: string;
  openTo: OpenToKind[];
  photoUrl?: string | null;
};

/**
 * Compact alumna card surfaced in the directory grid + search results.
 * Mobile-first 360px-friendly. Trust signal (VerifiedBadge) is the visual
 * anchor next to the name (UX spec §Component Strategy).
 */
export function DirectoryCard({ data }: { data: DirectoryCardData }) {
  return (
    <Link
      href={`/profile/${data.slug}`}
      className="group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-colors group-hover:border-foreground/40">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 shrink-0 bg-muted">
              {data.photoUrl && <AvatarImage src={data.photoUrl} alt="" />}
              <AvatarFallback className="font-semibold">
                {data.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate font-semibold group-hover:underline">
                  {data.displayName}
                </h3>
                <VerifiedBadge size="sm" />
              </div>
              {(data.currentRole || data.company) && (
                <div className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground/90">
                  <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {[data.currentRole, data.company]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              )}
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {data.program} &apos;{String(data.batch).slice(-2)}
                </span>
              </div>
              {(data.city || data.country) && (
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {[data.city, data.country].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              {data.openTo.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {data.openTo.map((kind) => (
                    <OpenToTag key={kind} kind={kind} variant="subtle" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
