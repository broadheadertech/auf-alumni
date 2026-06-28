"use client";

/**
 * Alumna drill-down — the full admin view of one graduate:
 *   • Basic info (contact, batch, college, location, employment)
 *   • EQ composite + 5-dimension breakdown
 *   • Skillset (level + peer endorsements)
 *   • Certifications
 *   • CV (download)
 *   • Application history (which roles, which company, stage)
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  Briefcase,
  Download,
  FileText,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import {
  fmtDate,
  getAlumnaById,
  getEmployerById,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/auf/EmptyState";
import {
  ScoreBar,
  StageBadge,
  StatTile,
  WorkStatusBadge,
} from "@/components/auf/AdminBits";

export default function AlumnaDetailPage() {
  const params = useParams<{ alumniId: string }>();
  const a = getAlumnaById(params.alumniId);

  if (!a) {
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
            <WorkStatusBadge status={a.workStatus} />
            {a.openToWork && (
              <Badge variant="secondary">Open to work</Badge>
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
          {a.cv && (
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4" />
              CV
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <StatTile label="EQ composite" value={a.eqScore} hint="out of 100" />
        <StatTile label="Skills" value={a.skills.length} />
        <StatTile label="Certifications" value={a.certifications.length} />
        <StatTile label="Applications" value={a.applications.length} />
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
                <InfoRow icon={Phone} label="Phone" value={a.phone} />
                <InfoRow
                  icon={MapPin}
                  label="Location"
                  value={`${a.city}, ${a.country}`}
                />
                <InfoRow
                  icon={Briefcase}
                  label="College"
                  value={a.college}
                />
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
                  <div className="text-foreground">Last active</div>
                  {fmtDate(a.lastActiveAt)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* EQ */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">
                  Emotional quotient (EQ)
                </h2>
                <span className="text-lg font-semibold tabular-nums">
                  {a.eqScore}
                </span>
              </div>
              <div className="mt-3 space-y-2.5">
                {a.eq.map((d) => (
                  <ScoreBar
                    key={d.dimension}
                    label={d.dimension}
                    value={d.score}
                  />
                ))}
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
                        {a.cv.sizeKb} KB · uploaded {fmtDate(a.cv.uploadedAt)}
                      </span>
                    </span>
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label="Download CV">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-sm italic text-muted-foreground">
                  No CV uploaded.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Skillset */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-medium">Skillset</h2>
              <div className="mt-3 space-y-3">
                {a.skills.map((s) => (
                  <div key={s.name}>
                    <ScoreBar
                      label={`${s.name}  ·  ${s.endorsements} endorsement${s.endorsements === 1 ? "" : "s"}`}
                      value={s.level}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Certifications */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-medium">Certifications</h2>
              {a.certifications.length === 0 ? (
                <p className="mt-2 text-sm italic text-muted-foreground">
                  No certifications on file.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {a.certifications.map((c) => (
                    <li
                      key={c.name}
                      className="flex items-start gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <Award className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.issuer} · {c.year}
                          {c.credentialId ? ` · ${c.credentialId}` : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
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
                  {a.applications.map((ap) => {
                    const employer = getEmployerById(ap.employerId);
                    return (
                      <div
                        key={ap.applicationId}
                        className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {ap.jobTitle}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {employer ? (
                              <Link
                                href={`/admin/employers/${ap.employerId}`}
                                className="hover:underline"
                              >
                                {ap.company}
                              </Link>
                            ) : (
                              ap.company
                            )}{" "}
                            · applied {fmtDate(ap.appliedAt)}
                          </div>
                        </div>
                        <StageBadge stage={ap.stage} />
                      </div>
                    );
                  })}
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
