"use client";

/**
 * Employer drill-down — contract + documents header, then every posting with
 * its applicant pipeline. Each posting expands to a per-posting applicant
 * table; each applicant links to the alumna drill-down. Applicants here are
 * filterable by stage + posting and sortable by recency / match score.
 *
 * Live data: convex/adminData.ts `employer`. Tier, contract dates and MOA /
 * NDA files are edited through the audited convex/adminEmployers.ts mutations
 * (documents stored in Convex file storage).
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { useAsOf } from "@/lib/use-as-of";
import {
  APPLICATION_STAGES,
  EMPLOYER_TIERS,
  fmtDate,
  type ApplicationStage,
  type EmployerTier,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/auf/EmptyState";
import { AccountStatusCard } from "@/components/auf/AccountStatusCard";
import {
  ContractBadge,
  PostingStatusBadge,
  StageBadge,
  StatTile,
  TierBadge,
} from "@/components/auf/AdminBits";
import { cn } from "@/lib/utils";

type EmployerView = NonNullable<FunctionReturnType<typeof api.adminData.employer>>;
type PostingView = EmployerView["postings"][number];
type ApplicantView = PostingView["applicants"][number];
type DocView = NonNullable<EmployerView["moa"]>;
type DocKind = "moa" | "nda";

const DAY = 86_400_000;

const TIER_VALUE: Record<EmployerTier, "partner" | "verified" | "unverified"> = {
  Partner: "partner",
  Verified: "verified",
  Unverified: "unverified",
};

/** Whole days from today (UTC midnight) to an ISO date; negative = past. */
function daysFromToday(iso: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((new Date(iso + "T00:00:00Z").getTime() - today) / DAY);
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const data = err.data as { message?: string } | string;
    return typeof data === "string" ? data : data?.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

export default function EmployerDetailPage() {
  const params = useParams<{ employerId: string }>();
  const asOf = useAsOf();
  const employer = useQuery(api.adminData.employer, { id: params.employerId, asOf });

  const [stages, setStages] = useState<ApplicationStage[]>([]);
  const [postingId, setPostingId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "match">("recent");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editOpen, setEditOpen] = useState(false);

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

  if (employer === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 text-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading employer…
      </div>
    );
  }

  if (employer === null) {
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

  const applicantTotal = employer.postings.reduce((s, p) => s + p.applicants.length, 0);
  const hiredTotal = employer.postings.reduce(
    (s, p) => s + p.applicants.filter((a) => a.stage === "hired").length,
    0,
  );
  const left = employer.contractEnd ? daysFromToday(employer.contractEnd) : null;

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
            <ContractBadge state={employer.contractState} />
            {employer.suspended && (
              <span className="inline-flex h-5 items-center rounded-full bg-destructive/10 px-2 text-xs font-medium text-destructive">
                Suspended
              </span>
            )}
          </div>
          {employer.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {employer.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {employer.industry && <span>{employer.industry}</span>}
            {employer.hqCity && <span>{employer.hqCity}</span>}
            {employer.websiteUrl && (
              <a
                href={employer.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Website <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Postings" value={employer.postings.length} />
        <StatTile label="Applicants" value={applicantTotal} />
        <StatTile label="Hired" value={hiredTotal} />
        <StatTile
          label="Contract"
          value={left === null ? "—" : left < 0 ? "Expired" : `${left}d`}
          hint={
            left === null || !employer.contractEnd
              ? "no contract on file"
              : left < 0
                ? `ended ${fmtDate(employer.contractEnd)}`
                : "until renewal"
          }
        />
      </div>

      {/* Contract + documents */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Tier &amp; contract</h2>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
            <dl className="mt-2 space-y-1 text-sm">
              <Row label="Tier" value={employer.tier} />
              <Row
                label="Start"
                value={employer.contractStart ? fmtDate(employer.contractStart) : "—"}
              />
              <Row
                label="End"
                value={employer.contractEnd ? fmtDate(employer.contractEnd) : "—"}
              />
              <Row label="Onboarded" value={fmtDate(employer.onboardedAt)} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-medium">Documents</h2>
            <div className="mt-2 space-y-2">
              <DocSlot employerId={employer.id} kind="moa" label="MOA" doc={employer.moa} />
              <DocSlot employerId={employer.id} kind="nda" label="NDA" doc={employer.nda} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <AccountStatusCard id={employer.id} name={employer.name} kind="employer" status={employer.accountStatus} />
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
          aria-label="Filter by posting"
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
          aria-label="Sort applicants"
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
        {employer.postings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No postings from this employer yet.
            </CardContent>
          </Card>
        ) : (
          visiblePostings.map(({ posting, applicants }) => (
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
          ))
        )}
      </div>

      {editOpen && (
        <EditContractDialog employer={employer} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}

function EditContractDialog({
  employer,
  onClose,
}: {
  employer: EmployerView;
  onClose: () => void;
}) {
  const update = useMutation(api.adminEmployers.updateEmployerAdmin);
  const [tier, setTier] = useState<EmployerTier>(employer.tier);
  const [start, setStart] = useState(employer.contractStart ?? "");
  const [end, setEnd] = useState(employer.contractEnd ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (start && end && end < start) {
      toast.error("Contract end must be after the start");
      return;
    }
    setBusy(true);
    try {
      // Empty strings clear a date on the server.
      await update({
        employerOrgId: employer.id as never,
        tier: TIER_VALUE[tier],
        contractStart: start,
        contractEnd: end,
      });
      toast.success(`${employer.name} updated`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Could not update employer"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit tier &amp; contract</DialogTitle>
          <DialogDescription>
            Changes apply everywhere this employer appears and are recorded in
            the audit log. Leave both dates blank if no contract is on file.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ec-tier" className="text-xs">Tier</Label>
            <select
              id="ec-tier"
              value={tier}
              onChange={(e) => setTier(e.target.value as EmployerTier)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              {EMPLOYER_TIERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ec-start" className="text-xs">Contract start</Label>
              <input
                id="ec-start"
                type="date"
                value={start}
                max={end || undefined}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="ec-end" className="text-xs">Contract end</Label>
              <input
                id="ec-end"
                type="date"
                value={end}
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={save}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostingBlock({
  posting,
  applicants,
  open,
  onToggle,
}: {
  posting: PostingView;
  applicants: ApplicantView[];
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
              {posting.salaryLabel} · posted {fmtDate(posting.postedAt)}
              {posting.closesAt ? ` · closes ${fmtDate(posting.closesAt)}` : ""}
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
              {posting.applicants.length === 0
                ? "No applicants for this posting yet."
                : "No applicants match the current filters."}
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
                  {applicants.map((a) => {
                    const nameEl = (
                      <>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                          {a.initials}
                        </span>
                        <span className="font-medium">{a.name}</span>
                        {a.batch != null && (
                          <span className="text-xs text-muted-foreground">
                            · Batch {a.batch}
                          </span>
                        )}
                      </>
                    );
                    return (
                      <tr
                        key={a.applicationId}
                        className="border-t border-border first:border-0 hover:bg-muted/20"
                      >
                        <td className="px-4 py-2">
                          {a.alumnaId ? (
                            <Link
                              href={`/admin/alumni/${a.alumnaId}`}
                              className="flex items-center gap-2 hover:underline"
                            >
                              {nameEl}
                            </Link>
                          ) : (
                            <span className="flex items-center gap-2">{nameEl}</span>
                          )}
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
                    );
                  })}
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

function DocSlot({
  employerId,
  kind,
  label,
  doc,
}: {
  employerId: string;
  kind: DocKind;
  label: string;
  doc: DocView | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadUrl = useMutation(api.adminEmployers.generateDocumentUploadUrl);
  const setDocument = useMutation(api.adminEmployers.setEmployerDocument);
  const removeDocument = useMutation(api.adminEmployers.removeEmployerDocument);
  const [busy, setBusy] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(pdf|doc|docx)$/i.test(f.name)) {
      toast.error("MOA / NDA must be a PDF, DOC, or DOCX");
      e.target.value = "";
      return;
    }
    setBusy(true);
    try {
      const url = await uploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": f.type || "application/octet-stream" },
        body: f,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };
      await setDocument({
        employerOrgId: employerId as never,
        kind,
        filename: f.name,
        sizeKb: Math.max(1, Math.round(f.size / 1024)),
        storageId: storageId as never,
      });
      toast.success(`${label} uploaded`);
    } catch (err) {
      toast.error(errorMessage(err, "Upload failed"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onRemove = async () => {
    if (!window.confirm(`Remove the ${label} on file? The stored file is deleted.`)) return;
    setBusy(true);
    try {
      await removeDocument({ employerOrgId: employerId as never, kind });
      toast.success(`${label} removed`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not remove"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        doc ? "border-border" : "border-dashed border-border",
      )}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={onFile}
      />
      {doc ? (
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {label} · {doc.filename}
              </span>
              <span className="text-xs text-muted-foreground">
                {doc.sizeKb} KB · uploaded {fmtDate(doc.uploadedAt)}
                {doc.url ? "" : " · no file stored"}
              </span>
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {doc.url && (
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                download={doc.filename}
                aria-label={`Download ${label}`}
                title={`Download ${label}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Download className="h-4 w-4" />
              </a>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Replace ${label}`}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${label}`}
              disabled={busy}
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {label} · not on file
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{" "}
            Upload
          </Button>
        </div>
      )}
    </div>
  );
}
