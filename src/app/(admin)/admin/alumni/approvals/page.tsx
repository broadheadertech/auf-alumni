"use client";

/**
 * Alumnus approval queue — live (Convex).
 *
 * Registrations awaiting verification (`api.adminData.pendingApprovals`:
 * pending-review, info-requested and escalated submissions). The admin reviews
 * claimed identity, the registry match, any flags, and uploaded ID / diploma,
 * then Approves, Rejects, or Requests more info. Each decision calls the
 * audited mutation in convex/admin.ts; the query updates live, so a decided
 * item leaves the queue and the review panel advances to the next one.
 *
 * Standard FilterPanel (search, flags, College → Program, batch, submitted
 * date range; URL-backed and persisted) and bulk review: Select all /
 * Unselect all, then approve or reject every selected registration. Bulk runs
 * the same per-submission mutations (one audit entry each) and reports
 * partial failures.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  FileText,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import type { EmployerDocView, PendingApprovalView } from "../../../../../../convex/adminData";
import { APPROVAL_FLAG_LABEL, fmtDate } from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/auf/EmptyState";
import { StatTile } from "@/components/auf/AdminBits";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";
import { BulkActionBar, SelectCheckbox } from "@/components/auf/BulkActionBar";
import { runBulk, useBulkSelection } from "@/lib/use-bulk-selection";
import { useUrlFilters } from "@/lib/use-url-filters";
import { useCollegePrograms } from "@/lib/use-program-options";
import { parseBatchInput } from "@/lib/batch-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const FILTER_KEYS = ["q", "flags", "college", "program", "batch", "from", "to"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

type Dialog =
  | { kind: "none" }
  | { kind: "reject"; id: string }
  | { kind: "info"; id: string }
  | { kind: "bulk-reject"; ids: string[] }
  | { kind: "bulk-approve"; ids: string[]; flagged: number };

const STATUS_CHIP: Record<string, { label: string; cls: string } | undefined> = {
  "info-requested": {
    label: "Info requested",
    cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  escalated: {
    label: "Escalated",
    cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

const flagLabel = (f: string) =>
  (APPROVAL_FLAG_LABEL as Record<string, string>)[f] ?? f;

/** Hours since an ISO datetime, relative to the real clock. */
function waitHours(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}

/** "12m ago" / "5.2h ago" / "3d ago" relative to the real clock. */
function ageSince(iso: string): string {
  const hours = waitHours(iso);
  const mins = Math.round(hours * 60);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function fmtWait(hours: number): string {
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function AlumniApprovalsPage() {
  const rows = useQuery(api.adminData.pendingApprovals) as PendingApprovalView[] | undefined;
  const approve = useMutation(api.admin.approveVerification);
  const reject = useMutation(api.admin.rejectVerification);
  const requestInfo = useMutation(api.admin.requestVerificationInfo);

  const { values, set, setMany, reset, restored } = useUrlFilters(
    "admin-approvals",
    FILTER_KEYS,
  );
  const taxonomy = useCollegePrograms();
  const batch = parseBatchInput(values.batch);
  const [sort, setSort] = useState<"oldest" | "newest">("oldest");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const [dialogText, setDialogText] = useState("");
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => rows ?? [], [rows]);

  const pending = useMemo(() => {
    const q = values.q.trim().toLowerCase();
    return all
      .filter((p) =>
        !values.flags
          ? true
          : values.flags === "flagged"
            ? p.flags.length > 0
            : p.flags.length === 0,
      )
      .filter((p) => !values.college || p.college === values.college)
      .filter((p) => !values.program || p.claimedProgram === values.program)
      .filter((p) => !batch.years || batch.years.includes(p.claimedBatch))
      .filter((p) =>
        q
          ? [p.name, p.email, p.claimedProgram, p.college]
              .join(" ")
              .toLowerCase()
              .includes(q)
          : true,
      )
      .filter((p) => {
        const day = p.submittedAt.slice(0, 10); // YYYY-MM-DD
        if (values.from && day < values.from) return false;
        if (values.to && day > values.to) return false;
        return true;
      })
      .sort((a, b) =>
        sort === "oldest"
          ? a.submittedAt.localeCompare(b.submittedAt)
          : b.submittedAt.localeCompare(a.submittedAt),
      );
  }, [all, values, batch.years, sort]);

  const selection = useBulkSelection(pending.map((p) => p.id));

  const fields: FilterField[] = [
    { type: "search", key: "q", label: "Search", placeholder: "Name, email, program…" },
    {
      type: "select",
      key: "flags",
      label: "Flags",
      allLabel: "All registrations",
      options: [
        { value: "flagged", label: "Flagged only" },
        { value: "clean", label: "No flags" },
      ],
    },
    {
      type: "select",
      key: "college",
      label: "College",
      allLabel: "All colleges",
      options: taxonomy.colleges.map((c) => ({ value: c.name, label: c.name })),
    },
    {
      type: "select",
      key: "program",
      label: "Program / degree",
      allLabel: values.college ? "All programs in this college" : "All programs",
      options: taxonomy.programsFor(values.college).map((pr) => ({
        value: pr.name,
        label: pr.name,
        group: values.college ? undefined : pr.collegeName,
      })),
    },
    {
      type: "text",
      key: "batch",
      label: "Batch (year)",
      placeholder: "e.g. 2021 or 2018-2022",
      maxLength: 9,
      hint: batch.error ?? undefined,
    },
    { type: "date", key: "from", label: "Submitted from", max: values.to },
    { type: "date", key: "to", label: "Submitted to", min: values.from },
  ];

  const onFilterChange = (key: string, value: string) => {
    if (key === "college") {
      const keep =
        values.program && value && taxonomy.collegeOfProgram(values.program) === value;
      setMany({ college: value, program: keep ? values.program : "" });
    } else if (key === "program" && value && !values.college) {
      setMany({ program: value, college: taxonomy.collegeOfProgram(value) ?? "" });
    } else {
      set(key as FilterKey, value);
    }
  };

  const active =
    pending.find((p) => p.id === activeId) ?? pending[0] ?? null;

  const totals = useMemo(() => {
    const oldest = all.reduce((max, p) => Math.max(max, waitHours(p.submittedAt)), 0);
    return {
      pending: all.length,
      flagged: all.filter((p) => p.flags.length > 0).length,
      oldest,
      infoRequested: all.filter((p) => p.status === "info-requested").length,
      escalated: all.filter((p) => p.status === "escalated").length,
    };
  }, [all]);

  const asId = (id: string) => id as Id<"verificationSubmissions">;
  const errMsg = (err: unknown, fallback: string) =>
    err instanceof ConvexError
      ? ((err.data as { message?: string } | undefined)?.message ?? fallback)
      : err instanceof Error
        ? err.message
        : fallback;

  const onApprove = async (p: PendingApprovalView) => {
    setBusy(true);
    try {
      await approve({ submissionId: asId(p.id) });
      toast.success(`${p.name} approved — added to verified alumni`);
      setActiveId(null); // fall through to next in list
    } catch (err) {
      toast.error(errMsg(err, "Approve failed"));
    } finally {
      setBusy(false);
    }
  };

  /** Run one audited mutation per id and toast the (possibly partial) outcome. */
  const bulk = async (
    verb: string,
    ids: string[],
    action: (id: string) => Promise<unknown>,
  ) => {
    setBusy(true);
    try {
      const { ok, failed } = await runBulk(ids, action);
      const parts = [`${verb} ${ok.length} registration${ok.length === 1 ? "" : "s"}`];
      if (failed.length > 0) parts.push(`${failed.length} failed`);
      (failed.length ? toast.warning : toast.success)(parts.join(" · "), {
        description: failed.length ? failed[0].message : undefined,
      });
      selection.deselect(ok);
      setActiveId(null);
    } finally {
      setBusy(false);
    }
  };

  const onBulkApprove = (ids: string[]) =>
    bulk("Approved", ids, (id) => approve({ submissionId: asId(id) }));

  const onConfirmDialog = async () => {
    if (dialog.kind === "none") return;
    if (dialog.kind === "bulk-approve") {
      await onBulkApprove(dialog.ids);
      setDialog({ kind: "none" });
      return;
    }
    const text = dialogText.trim();
    if (!text) {
      toast.error("A message / reason is required");
      return;
    }
    if (dialog.kind === "bulk-reject") {
      await bulk("Rejected", dialog.ids, (id) =>
        reject({ submissionId: asId(id), reason: text }),
      );
      setDialog({ kind: "none" });
      setDialogText("");
      return;
    }
    const p = all.find((x) => x.id === dialog.id);
    setBusy(true);
    try {
      if (dialog.kind === "reject") {
        await reject({ submissionId: asId(dialog.id), reason: text });
        toast.success(`${p?.name ?? "Submission"} rejected`);
        setActiveId(null);
      } else {
        await requestInfo({ submissionId: asId(dialog.id), message: text });
        toast.success("Info request sent to the applicant");
      }
      setDialog({ kind: "none" });
      setDialogText("");
    } catch (err) {
      toast.error(errMsg(err, "Action failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <Link
        href="/admin/alumni"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Alumni
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Alumnus approvals
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Verify and admit new alumni registrations. Review the registry match and
        uploaded documents before approving.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="In queue" value={rows ? totals.pending : "—"} />
        <StatTile label="Flagged" value={rows ? totals.flagged : "—"} />
        <StatTile
          label="Oldest wait"
          value={rows ? (totals.pending ? fmtWait(totals.oldest) : "—") : "—"}
        />
        <StatTile
          label="Info requested"
          value={rows ? totals.infoRequested : "—"}
          hint={rows ? `${totals.escalated} escalated` : undefined}
        />
      </div>

      {/* Filters */}
      <FilterPanel
        layout="bar"
        className="mt-6"
        fields={fields}
        values={values}
        onChange={onFilterChange}
        onReset={reset}
        restored={restored}
      />

      {/* Bulk review */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <BulkActionBar
          className="min-w-0 flex-1"
          noun="registration"
          count={selection.count}
          total={selection.total}
          allSelected={selection.allSelected}
          someSelected={selection.someSelected}
          onSelectAll={selection.selectAll}
          onUnselectAll={selection.unselectAll}
        >
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              const ids = selection.selectedIds;
              const flagged = pending.filter((p) => ids.includes(p.id) && p.flags.length > 0).length;
              if (flagged > 0) setDialog({ kind: "bulk-approve", ids, flagged });
              else void onBulkApprove(ids);
            }}
          >
            <Check className="h-4 w-4" /> Approve {selection.count}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setDialog({ kind: "bulk-reject", ids: selection.selectedIds });
              setDialogText("");
            }}
          >
            <X className="h-4 w-4" /> Reject {selection.count}
          </Button>
        </BulkActionBar>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "oldest" | "newest")}
          aria-label="Sort"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
        </select>
      </div>

      {rows === undefined ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pending.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            message="Queue clear"
            description={
              all.length
                ? "No pending registrations match these filters."
                : "No registrations are waiting for review. Nice work."
            }
            cta={{ label: "Back to alumni roster", href: "/admin/alumni" }}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* List */}
          <aside className="space-y-1.5">
            {pending.map((p) => {
              const on = active?.id === p.id;
              const checked = selection.isSelected(p.id);
              const chip = STATUS_CHIP[p.status];
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-2.5 py-2",
                    on
                      ? "border-foreground bg-muted"
                      : checked
                        ? "border-foreground/40 bg-muted/40"
                        : "border-border hover:bg-muted/50",
                  )}
                >
                <SelectCheckbox
                  checked={checked}
                  onChange={() => selection.toggle(p.id)}
                  label={`Select ${p.name}`}
                  className="mt-0.5"
                />
                <button
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    {p.flags.length > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-500/15 px-1 text-[11px] text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3" />
                        {p.flags.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.claimedProgram} · Batch {p.claimedBatch}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                    <span>
                      {ageSince(p.submittedAt)} · {p.method}
                    </span>
                    {chip && (
                      <span className={cn("rounded px-1", chip.cls)}>{chip.label}</span>
                    )}
                  </div>
                </button>
                </div>
              );
            })}
          </aside>

          {/* Review panel */}
          {active && (
            <section>
              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {active.initials}
                      </span>
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight">
                          {active.name}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {active.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {fmtDate(active.submittedAt.slice(0, 10))} ·{" "}
                          {ageSince(active.submittedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {STATUS_CHIP[active.status] && (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs",
                            STATUS_CHIP[active.status]!.cls,
                          )}
                        >
                          {STATUS_CHIP[active.status]!.label}
                        </span>
                      )}
                      <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">
                        {active.method}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-6 md:grid-cols-2">
                    {/* Claimed identity */}
                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Claimed identity
                      </h3>
                      <dl className="mt-2 space-y-1.5 text-sm">
                        <DL label="Name" value={active.name} />
                        <DL label="Batch" value={String(active.claimedBatch)} />
                        <DL label="Program" value={active.claimedProgram} />
                        <DL label="College" value={active.college} />
                        <DL label="City" value={active.city || "—"} />
                      </dl>
                    </div>

                    {/* Registry */}
                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Registry check
                      </h3>
                      {active.registryMatched && active.registryRecord ? (
                        <div className="mt-2 space-y-1.5 text-sm">
                          <DL
                            label="Match"
                            value={
                              <span className="text-emerald-700 dark:text-emerald-300">
                                Yes
                                {active.registryConfidence != null
                                  ? ` · ${Math.round(active.registryConfidence * 100)}% confidence`
                                  : ""}
                              </span>
                            }
                          />
                          <DL label="Registry name" value={active.registryRecord.name} />
                          <DL
                            label="Registry batch / program"
                            value={`${active.registryRecord.batch} · ${active.registryRecord.program}`}
                          />
                        </div>
                      ) : active.registryMatched ? (
                        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                          Registry matched
                          {active.registryConfidence != null
                            ? ` · ${Math.round(active.registryConfidence * 100)}% confidence`
                            : ""}
                          .
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No registry match. Cross-reference the AUF registry
                          manually before approving.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Flags */}
                  {active.flags.length > 0 && (
                    <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {active.flags.length} flag{active.flags.length === 1 ? "" : "s"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {active.flags.map((f) => (
                          <span
                            key={f}
                            className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300"
                          >
                            {flagLabel(f)}
                          </span>
                        ))}
                      </div>
                      {active.note && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {active.note}
                        </p>
                      )}
                    </div>
                  )}
                  {active.flags.length === 0 && active.note && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {active.note}
                    </p>
                  )}

                  {/* Documents */}
                  <div className="mt-4">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Uploaded documents
                    </h3>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <DocRow label="Alumni ID" doc={active.idDoc} />
                      <DocRow label="Diploma / TOR" doc={active.diplomaDoc} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    <Button size="sm" disabled={busy} onClick={() => void onApprove(active)}>
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setDialog({ kind: "info", id: active.id });
                        setDialogText(
                          "Please upload a clearer photo of your AUF ID so we can verify your record.",
                        );
                      }}
                    >
                      Request info
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => {
                        setDialog({ kind: "reject", id: active.id });
                        setDialogText("");
                      }}
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      )}

      <p className="mt-4 text-xs italic text-muted-foreground">
        Live verification queue — every decision is saved and recorded in the
        audit log. Info-requested items stay here until the applicant resubmits.
      </p>

      {/* Reject / info dialog */}
      <AlertDialog
        open={dialog.kind !== "none"}
        onOpenChange={(open) => !open && !busy && setDialog({ kind: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog.kind === "reject"
                ? "Reject this registration"
                : dialog.kind === "bulk-reject"
                  ? `Reject ${dialog.ids.length} registrations`
                  : dialog.kind === "bulk-approve"
                    ? `Approve ${dialog.ids.length} registrations?`
                    : "Request more information"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.kind === "info"
                ? "Tell the applicant what to update. They'll receive your message by email and on their status page."
                : dialog.kind === "bulk-approve"
                  ? `${dialog.flagged} of the selected registrations have flags (e.g. no registry match). Approve them all anyway?`
                  : dialog.kind === "bulk-reject"
                    ? "The same reason is recorded for each applicant. Be specific."
                    : "This decision is recorded. Be specific about the reason."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dialog.kind !== "bulk-approve" && (
            <Textarea
              rows={4}
              value={dialogText}
              onChange={(e) => setDialogText(e.target.value)}
              placeholder={
                dialog.kind === "info" ? "Message to the applicant" : "Reason (required)"
              }
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onConfirmDialog();
              }}
              disabled={busy || (dialog.kind !== "bulk-approve" && !dialogText.trim())}
            >
              {busy ? "Working…" : dialog.kind === "bulk-approve" ? "Approve all" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DL({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function DocRow({ label, doc }: { label: string; doc: EmployerDocView | null }) {
  if (!doc) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {label}
        </span>
        <span className="text-xs italic">Not provided</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {doc.filename} · {doc.sizeKb} KB
          </span>
        </span>
      </span>
      {doc.url ? (
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Download ${label}`}
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <Download className="h-4 w-4" />
        </a>
      ) : (
        <span className="text-[11px] italic text-muted-foreground">File unavailable</span>
      )}
    </div>
  );
}
