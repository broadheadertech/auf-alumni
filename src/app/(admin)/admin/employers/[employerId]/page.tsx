"use client";

/**
 * Employer drill-down — contract + documents header, then every posting with
 * its applicant pipeline. Each posting expands to a per-posting applicant
 * table; each applicant links to the alumna drill-down. Applicants here are
 * filterable by stage + posting and sortable by recency / match score.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Search,
} from "lucide-react";
import {
  APPLICATION_STAGES,
  applicantCount,
  contractState,
  daysUntil,
  fmtDate,
  getEmployerById,
  hiredCount,
  type ApplicationStage,
  type EmployerPosting,
  type PostingApplicant,
  type UploadedDoc,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/auf/EmptyState";
import {
  ContractBadge,
  PostingStatusBadge,
  StageBadge,
  StatTile,
  TierBadge,
} from "@/components/auf/AdminBits";
import { cn } from "@/lib/utils";

export default function EmployerDetailPage() {
  const params = useParams<{ employerId: string }>();
  const employer = getEmployerById(params.employerId);

  const [stages, setStages] = useState<ApplicationStage[]>([]);
  const [postingId, setPostingId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "match">("recent");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const visiblePostings = useMemo(() => {
    if (!employer) return [];
    const q = search.trim().toLowerCase();
    return employer.postings
      .filter((p) => postingId === "all" || p.id === postingId)
      .map((p) => {
        const applicants = p.applicants
          .filter((a) => (stages.length ? stages.includes(a.stage) : true))
          .filter((a) => (q ? a.name.toLowerCase().includes(q) : true))
          .sort((a, b) =>
            sort === "match"
              ? b.matchScore - a.matchScore
              : b.appliedAt.localeCompare(a.appliedAt),
          );
        return { posting: p, applicants };
      });
  }, [employer, postingId, stages, search, sort]);

  if (!employer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          message="Employer not found"
          cta={{ label: "Back to roster", href: "/admin/employers" }}
        />
      </div>
    );
  }

  const toggleStage = (s: ApplicationStage) =>
    setStages((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const left = daysUntil(employer.contractEnd);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <Link
        href="/admin/employers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Employers
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-foreground text-lg font-bold text-background">
          {employer.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {employer.name}
            </h1>
            <TierBadge tier={employer.tier} />
            <ContractBadge state={contractState(employer)} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {employer.description}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{employer.industry}</span>
            <span>{employer.hqCity}</span>
            <a
              href={employer.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              Website <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Postings" value={employer.postings.length} />
        <StatTile label="Applicants" value={applicantCount(employer)} />
        <StatTile label="Hired" value={hiredCount(employer)} />
        <StatTile
          label="Contract"
          value={left < 0 ? "Expired" : `${left}d`}
          hint={left < 0 ? `ended ${fmtDate(employer.contractEnd)}` : "until renewal"}
        />
      </div>

      {/* Contract + documents */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium">Contract window</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <Row label="Start" value={fmtDate(employer.contractStart)} />
              <Row label="End" value={fmtDate(employer.contractEnd)} />
              <Row label="Onboarded" value={fmtDate(employer.onboardedAt)} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium">Documents</h2>
            <div className="mt-2 space-y-2">
              <DocRow label="MOA" doc={employer.moa} />
              <DocRow label="NDA" doc={employer.nda} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Postings + applicants */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Postings &amp; applicants
        </h2>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search applicant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          value={postingId}
          onChange={(e) => setPostingId(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
        >
          <option value="all">All postings</option>
          {employer.postings.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "recent" | "match")}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
        >
          <option value="recent">Sort: most recent</option>
          <option value="match">Sort: match score</option>
        </select>
        <div className="flex flex-wrap gap-1.5">
          {APPLICATION_STAGES.map((s) => {
            const on = stages.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStage(s)}
                aria-pressed={on}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors",
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s.replace("-", " ")}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {visiblePostings.map(({ posting, applicants }) => (
          <PostingBlock
            key={posting.id}
            posting={posting}
            applicants={applicants}
            open={expanded[posting.id] ?? true}
            onToggle={() =>
              setExpanded((m) => ({
                ...m,
                [posting.id]: !(m[posting.id] ?? true),
              }))
            }
          />
        ))}
      </div>
    </div>
  );
}

function PostingBlock({
  posting,
  applicants,
  open,
  onToggle,
}: {
  posting: EmployerPosting;
  applicants: PostingApplicant[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{posting.title}</span>
              <PostingStatusBadge status={posting.status} />
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {posting.location} · {posting.employmentType} ·{" "}
              {posting.salaryLabel} · posted {fmtDate(posting.postedAt)} ·
              closes {fmtDate(posting.closesAt)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm tabular-nums text-muted-foreground">
              {posting.applicants.length} applicant
              {posting.applicants.length === 1 ? "" : "s"}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </div>
        </button>

        {open &&
          (applicants.length === 0 ? (
            <div className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No applicants match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Applicant</th>
                    <th className="px-3 py-2 text-left font-medium">College</th>
                    <th className="px-3 py-2 text-left font-medium">Applied</th>
                    <th className="px-3 py-2 text-right font-medium">Match</th>
                    <th className="px-3 py-2 text-left font-medium">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((a) => (
                    <tr
                      key={a.applicationId}
                      className="border-t border-border first:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/alumni/${a.alumnaId}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                            {a.initials}
                          </span>
                          <span className="font-medium">{a.name}</span>
                          <span className="text-xs text-muted-foreground">
                            · Batch {a.batch}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {a.college}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {fmtDate(a.appliedAt)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {a.matchScore}%
                      </td>
                      <td className="px-3 py-2">
                        <StageBadge stage={a.stage} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function DocRow({ label, doc }: { label: string; doc: UploadedDoc | null }) {
  if (!doc) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {label}
        </span>
        <span className="text-xs italic">Not uploaded</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {label} · {doc.filename}
          </span>
          <span className="text-xs text-muted-foreground">
            {doc.sizeKb} KB · uploaded {fmtDate(doc.uploadedAt)}
          </span>
        </span>
      </span>
      <Button variant="ghost" size="icon-sm" aria-label={`Download ${label}`}>
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
