/**
 * Public profile route (Epic 15).
 *
 * Server-rendered, privacy-enforced. Only public-tier fields reach the HTML
 * response. Unauthenticated viewers see the "stranger" perspective.
 *
 * Respects `excludeFromSearchEngines` (sets noindex meta).
 * Embeds schema.org/Person structured data for public-tier fields only.
 *
 * The deterministic header / bio / open-to banners are rendered on the
 * server so search engines + first paint stay snappy. Interactive social
 * graph features (follow, endorsements, recommendations) mount in a
 * `"use client"` `<ProfileSocial />` below the header.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { VerifiedBadge } from "@/components/auf/VerifiedBadge";
import {
  FollowControl,
  ProfileSocial,
} from "@/components/auf/ProfileSocial";
import { Briefcase, GraduationCap, MapPin, Sparkles } from "lucide-react";

type Params = Promise<{ slug: string }>;

type PublicProfile = {
  _id: string;
  slug: string;
  displayName: string;
  batch?: number;
  program?: string;
  currentRole?: string;
  company?: string;
  city?: string;
  country?: string;
  bio?: string;
  skills?: string[];
  excludeFromSearchEngines?: boolean;
  verifiedAt?: number;
  openToWork?: boolean;
  openToWorkNote?: string;
  openToHire?: boolean;
  openToHireNote?: string;
};

async function loadProfile(slug: string): Promise<PublicProfile | null> {
  try {
    const result = await fetchQuery(api.profiles.getBySlug, {
      slug,
    });
    if (!result) return null;
    return result as PublicProfile;
  } catch {
    return null;
  }
}

async function loadMeId(): Promise<string | null> {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return null;
    const me = await fetchQuery(api.users.getMe, {}, { token });
    return (me as { _id?: string } | null)?._id ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  if (!profile) return { title: "Profile not found" };

  const title = `${profile.displayName} — AUF Alumni`;
  const description = profile.bio
    ? profile.bio.slice(0, 160)
    : `${profile.displayName}, verified AUF graduate.`;
  return {
    title,
    description,
    robots: profile.excludeFromSearchEngines ? "noindex" : undefined,
    openGraph: { title, description, type: "profile" },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const [profile, meId] = await Promise.all([loadProfile(slug), loadMeId()]);
  if (!profile) notFound();

  const isMe = meId != null && meId === profile._id;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.displayName,
    alumniOf: {
      "@type": "EducationalOrganization",
      name: "Angeles University Foundation",
    },
    ...(profile.currentRole && { jobTitle: profile.currentRole }),
    ...(profile.company && {
      worksFor: { "@type": "Organization", name: profile.company },
    }),
    ...(profile.city && {
      address: { "@type": "PostalAddress", addressLocality: profile.city },
    }),
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Open-to banners — read-only, toggled from /settings */}
      {profile.openToWork && (
        <Card className="brand-50 mb-4 border-amber-200/70">
          <CardContent className="flex items-start gap-3 p-4">
            <Sparkles className="mt-0.5 h-5 w-5 gold-fg" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold gold-fg">Open to work</div>
              {profile.openToWorkNote && (
                <p className="mt-0.5 text-sm ink-2">{profile.openToWorkNote}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {profile.openToHire && (
        <Card className="mb-4 border-emerald-200/70 bg-emerald-50/50">
          <CardContent className="flex items-start gap-3 p-4">
            <Briefcase
              className="mt-0.5 h-5 w-5 text-emerald-700"
              aria-hidden="true"
            />
            <div>
              <div className="text-sm font-semibold text-emerald-800">
                Open to hire
              </div>
              {profile.openToHireNote && (
                <p className="mt-0.5 text-sm ink-2">{profile.openToHireNote}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="h-20 bg-linear-to-r from-zinc-900 to-zinc-700" />
        <CardContent className="-mt-10 space-y-3 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-muted text-2xl font-semibold">
              {profile.displayName
                .split(" ")
                .slice(0, 2)
                .map((s) => s.charAt(0).toUpperCase())
                .join("")}
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {profile.displayName}
                </h1>
                {profile.verifiedAt && <VerifiedBadge size="md" />}
              </div>
              {(profile.currentRole || profile.company) && (
                <p className="mt-1 text-muted-foreground">
                  {[profile.currentRole, profile.company]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {profile.batch && profile.program && (
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap className="h-4 w-4" />
                    {profile.program} &apos;{String(profile.batch).slice(-2)}
                  </span>
                )}
                {(profile.city || profile.country) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {[profile.city, profile.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <FollowControl profileUserId={profile._id} isMe={isMe} />
              </div>
            </div>
          </div>

          {profile.bio && (
            <div>
              <h2 className="mt-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                About
              </h2>
              <p className="mt-1 whitespace-pre-wrap text-sm">{profile.bio}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ProfileSocial
        profileUserId={profile._id}
        skills={profile.skills ?? []}
        isMe={isMe}
      />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        This page shows only fields {profile.displayName} has set to public.{" "}
        <Link
          href="/login"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>{" "}
        as an alumna to see the full profile.
      </p>
    </div>
  );
}
