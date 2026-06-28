import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ALUMNI, getAlumniBySlug } from "@/lib/mock-alumni";
import {
  Briefcase,
  GraduationCap,
  MapPin,
  ShieldCheck,
  MessageSquare,
  UserPlus,
  Lock,
} from "lucide-react";
import { VerifiedBadge } from "@/components/auf/VerifiedBadge";

export function generateStaticParams() {
  return ALUMNI.map((a) => ({ slug: a.slug }));
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const alumni = getAlumniBySlug(slug);
  if (!alumni) notFound();

  const verifiedDate = new Date(alumni.verifiedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6 text-sm text-muted-foreground">
        <Link href="/connections" className="hover:text-foreground transition-colors">
          ← Back to network
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="h-28 bg-gradient-to-r from-zinc-900 to-zinc-700" />
        <CardContent className="px-6 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <Avatar className="h-24 w-24 border-4 border-background bg-muted">
              <AvatarFallback className="text-2xl font-semibold">
                {alumni.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">{alumni.name}</h1>
                <VerifiedBadge size="md" />
              </div>
              <p className="text-muted-foreground mt-1">
                {alumni.currentRole} · {alumni.company}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4" />
                  {alumni.program} &apos;{String(alumni.batch).slice(-2)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {alumni.city}, {alumni.country}
                </span>
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
          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold mb-3">About</h2>
              <p className="text-sm leading-relaxed text-foreground/90">{alumni.bio}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Experience
              </h2>
              <ol className="space-y-4">
                {alumni.experience.map((e, idx) => (
                  <li key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-foreground mt-1.5" />
                      {idx < alumni.experience.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="font-medium">{e.role}</div>
                      <div className="text-sm text-muted-foreground">{e.company}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{e.years}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Education
              </h2>
              <ul className="space-y-3">
                {alumni.education.map((e, idx) => (
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
        </div>

        <aside className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold mb-3">Open to</h2>
              <div className="flex flex-wrap gap-1.5">
                {alumni.openTo.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold mb-3">Skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {alumni.skills.map((s) => (
                  <Badge key={s} variant="secondary" className="font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Verification
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Confirmed against AUF alumni registry in {verifiedDate}.
              </p>
              <Separator className="my-4" />
              <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Private fields
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Email, phone, and student number are hidden from non-connected alumni. Field-level
                privacy is enforced on every query.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
