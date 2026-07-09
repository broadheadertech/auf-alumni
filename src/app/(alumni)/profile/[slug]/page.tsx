"use client";

/**
 * Alumni profile — real Convex profile, field-level privacy applied server-side
 * by `profiles.getBySlug` (the viewer's tier determines which fields return).
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import {
  Briefcase,
  GraduationCap,
  MapPin,
  ShieldCheck,
  MessageSquare,
  UserPlus,
  Lock,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { VerifiedBadge } from "@/components/auf/VerifiedBadge";

type Experience = { role: string; company: string; years: string };
type Education = {
  degree: string;
  program?: string;
  school: string;
  year: number;
};

export default function ProfilePage() {
  const params = useParams<{ slug: string }>();
  const profile = useQuery(api.profiles.getBySlug, { slug: params.slug });

  if (profile === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-sm text-muted-foreground">
        Loading profile…
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">Profile not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This alumni profile doesn&apos;t exist or isn&apos;t visible to you.
        </p>
        <Link
          href="/connections"
          className="mt-3 inline-block text-sm text-primary hover:underline"
        >
          ← Back to network
        </Link>
      </div>
    );
  }

  const p = profile as Record<string, unknown>;
  const displayName = (p.displayName as string) ?? "Alumnus";
  const initials =
    (p.initials as string) ?? displayName.slice(0, 2).toUpperCase();
  const currentRole = p.currentRole as string | undefined;
  const company = p.company as string | undefined;
  const program = p.program as string | undefined;
  const batch = p.batch as number | undefined;
  const city = p.city as string | undefined;
  const country = p.country as string | undefined;
  const bio = p.bio as string | undefined;
  const experience = (p.experience as Experience[] | undefined) ?? [];
  const education = (p.education as Education[] | undefined) ?? [];
  const skills = (p.skills as string[] | undefined) ?? [];
  const openTo = (p.openTo as string[] | undefined) ?? [];
  const verifiedAt = p.verifiedAt as number | undefined;
  const verifiedDate = verifiedAt
    ? new Date(verifiedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6 text-sm text-muted-foreground">
        <Link
          href="/connections"
          className="hover:text-foreground transition-colors"
        >
          ← Back to network
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="h-28 bg-gradient-to-r from-zinc-900 to-zinc-700" />
        <CardContent className="px-6 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <Avatar className="h-24 w-24 border-4 border-background bg-muted">
              <AvatarFallback className="text-2xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">
                  {displayName}
                </h1>
                <VerifiedBadge size="md" />
              </div>
              {(currentRole || company) && (
                <p className="text-muted-foreground mt-1">
                  {[currentRole, company].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {program && (
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4" />
                    {program}
                    {batch ? ` '${String(batch).slice(-2)}` : ""}
                  </span>
                )}
                {(city || country) && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {[city, country].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 sm:flex-col lg:flex-row">
              <Button size="sm" className="gap-1.5">
                <UserPlus className="h-4 w-4" />
                Connect
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Message
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 mt-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {bio && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold mb-3">About</h2>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {bio}
                </p>
              </CardContent>
            </Card>
          )}

          {experience.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Experience
                </h2>
                <ol className="space-y-4">
                  {experience.map((e, idx) => (
                    <li key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-foreground mt-1.5" />
                        {idx < experience.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="font-medium">{e.role}</div>
                        <div className="text-sm text-muted-foreground">
                          {e.company}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {e.years}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {education.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Education
                </h2>
                <ul className="space-y-3">
                  {education.map((e, idx) => (
                    <li key={idx}>
                      <div className="font-medium">{e.degree}</div>
                      <div className="text-sm text-muted-foreground">
                        {e.school} · {e.year}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {openTo.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold mb-3">Open to</h2>
                <div className="flex flex-wrap gap-1.5">
                  {openTo.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {skills.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold mb-3">Skills</h2>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <Badge key={s} variant="secondary" className="font-normal">
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Verification
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {verifiedDate
                  ? `Confirmed against AUF alumni registry in ${verifiedDate}.`
                  : "Confirmed against AUF alumni registry."}
              </p>
              <Separator className="my-4" />
              <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Private fields
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Email, phone, and student number are hidden from non-connected
                alumni. Field-level privacy is enforced on every query.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
