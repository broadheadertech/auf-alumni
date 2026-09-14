"use client";

/**
 * Alumna drill-down — the full admin view of one graduate, on live Convex data
 * (api.adminAlumni.getAlumna):
 *   • Basic info (contact, batch, college, location, employment)
 *   • Alumni ID card management (RFID bind + PIN activation) — see AlumniIdCard
 *   • Skillset, downloadable CV, and real application history
 *
 * Fields the mock invented with no backing store (EQ composite + dimensions,
 * certifications, skill endorsement weights, phone, last-active) are dropped.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  Briefcase,
  Download,
  FileText,
  Loader2,
  Mail,
  MapPin,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/auf/EmptyState";
import { AccountStatusCard } from "@/components/auf/AccountStatusCard";
import { AlumniIdCard } from "@/components/auf/AlumniIdCard";
import { StageBadge, StatTile, WorkStatusBadge } from "@/components/auf/AdminBits";
import type { ApplicationStage, WorkStatus } from "@/lib/mock-admin";

function fmtDate(ms?: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AlumnaDetailPage() {
  const params = useParams<{ alumniId: string }>();
  const a = useQuery(api.adminAlumni.getAlumna, { id: params.alumniId });

  if (a === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (a === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          message="Alumna not found"
          cta={{ label: "Back to roster", href: "/admin/alumni" }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <Link
        href="/admin/alumni"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Alumni
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-semibold">
          {a.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{a.name}</h1>
            <WorkStatusBadge status={a.workStatus as WorkStatus} />
            {a.openToWork && <Badge variant="secondary">Open to work</Badge>}
            {a.verifiedAt == null && (
              <Badge variant="outline">Verification pending</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {a.currentRole
              ? `${a.currentRole}${a.currentCompany ? " at " + a.currentCompany : ""}`
              : "Seeking first role"}{" "}
            · {a.program} · Batch {a.batch}
          </p>
          <Link
            href={`/profile/${a.slug}`}
            className="mt-1 inline-block text-xs text-primary hover:underline"
          >
            View public profile →
          </Link>
        </div>
        <div className="flex gap-2">
          {a.cv?.url && (
            <a
              href={a.cv.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              CV
            </a>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="Skills" value={a.skills.length} />
        <StatTile label="Applications" value={a.applications.length} />
        <StatTile
          label="Alumni ID"
          value={a.alumniId ? "Issued" : "Not issued"}
          hint={a.alumniId ?? undefined}
        />
      </div>

      <div className="mt-4">
        <AlumniIdCard
          alumna={{
            id: a.id,
            name: a.name,
            batch: a.batch,
            program: a.program,
            initials: a.initials,
            email: a.email,
            alumniId: a.alumniId,
          }}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Basic info */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-medium">Basic information</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <InfoRow icon={Mail} label="Email" value={a.email} />
                <InfoRow
                  icon={MapPin}
                  label="Location"
                  value={
                    [a.city, a.country].filter(Boolean).join(", ") || "—"
                  }
                />
                <InfoRow icon={Briefcase} label="College" value={a.college} />
                <InfoRow
                  icon={FileText}
                  label="Degree"
                  value={`${a.degree} · ${a.program}`}
                />
              </dl>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <div>
                  <div className="text-foreground">Registered</div>
                  {fmtDate(a.registeredAt)}
                </div>
                <div>
                  <div className="text-foreground">Verified</div>
                  {a.verifiedAt ? fmtDate(a.verifiedAt) : "Pending"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CV */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-medium">CV / Resume</h2>
              {a.cv ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {a.cv.filename}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        uploaded {fmtDate(a.cv.uploadedAt)}
                      </span>
                    </span>
                  </span>
                  {a.cv.url && (
                    <a
                      href={a.cv.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                      aria-label="Download CV"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm italic text-muted-foreground">
                  No CV uploaded.
                </p>
              )}
            </CardContent>
          </Card>

          <AccountStatusCard id={a.id} name={a.name} kind="alumnus" status={a.accountStatus ?? null} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Skillset */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-medium">Skillset</h2>
              {a.skills.length === 0 ? (
                <p className="mt-2 text-sm italic text-muted-foreground">
                  No skills listed.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.skills.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Applications */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-medium">Job applications</h2>
              {a.applications.length === 0 ? (
                <p className="mt-2 text-sm italic text-muted-foreground">
                  No applications submitted.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {a.applications.map((ap) => (
                    <div
                      key={ap.applicationId}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{ap.jobTitle}</div>
                        <div className="text-xs text-muted-foreground">
                          {ap.company} · applied {fmtDate(ap.appliedAt)}
                        </div>
                      </div>
                      <StageBadge stage={ap.stage as ApplicationStage} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  );
}
