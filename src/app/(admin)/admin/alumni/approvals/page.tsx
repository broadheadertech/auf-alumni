"use client";

/**
 * Alumnus approval queue (mock).
 *
 * Pending registrations awaiting verification. The admin reviews claimed
 * identity, the registry match, any flags, and uploaded ID / diploma, then
 * Approves, Rejects, or Requests more info. Decisions are local to this demo
 * (no backend) — they remove the item from the queue and advance to the next.
 *
 * Mirrors the live Convex flow at /admin/queue; populated for stakeholder
 * review. See lib/mock-admin.ts → PENDING_ALUMNI.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  FileText,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  APPROVAL_FLAG_LABEL,
  PENDING_ALUMNI,
  ageSince,
  fmtDate,
  waitHours,
  type PendingAlumnus,
  type UploadedDoc,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/auf/EmptyState";
import { StatTile } from "@/components/auf/AdminBits";
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

type Filter = "all" | "flagged" | "clean";
type Dialog =
  | { kind: "none" }
  | { kind: "reject"; id: string }
  | { kind: "info"; id: string };

export default function AlumniApprovalsPage() {
  // Decisions live in local state for the prototype.
  const [decided, setDecided] = useState<Record<string, "approved" | "rejected" | "info">>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"oldest" | "newest">("oldest");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const [dialogText, setDialogText] = useState("");

  const pending = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PENDING_ALUMNI.filter((p) => !decided[p.id])
      .filter((p) =>
        filter === "all"
          ? true
          : filter === "flagged"
            ? p.flags.length > 0
            : p.flags.length === 0,
      )
      .filter((p) =>
        q
          ? [p.name, p.email, p.claimedProgram, p.college]
              .join(" ")
              .toLowerCase()
              .includes(q)
          : true,
      )
      .sort((a, b) =>
        sort === "oldest"
          ? a.submittedAt.localeCompare(b.submittedAt)
          : b.submittedAt.localeCompare(a.submittedAt),
      );
  }, [decided, filter, search, sort]);

  const active =
    pending.find((p) => p.id === activeId) ?? pending[0] ?? null;

  const totals = useMemo(() => {
    const live = PENDING_ALUMNI.filter((p) => !decided[p.id]);
    const decidedCount = Object.keys(decided).length;
    const approved = Object.values(decided).filter((d) => d === "approved").length;
    const oldest = live.reduce((max, p) => Math.max(max, waitHours(p.submittedAt)), 0);
    return {
      pending: live.length,
      flagged: live.filter((p) => p.flags.length > 0).length,
      oldest: Math.round(oldest),
      reviewedToday: decidedCount,
      approved,
    };
  }, [decided]);

  const decide = (id: string, outcome: "approved" | "rejected" | "info") => {
    setDecided((m) => ({ ...m, [id]: outcome }));
    setActiveId(null); // fall through to next in list
  };

  const onApprove = (p: PendingAlumnus) => {
    decide(p.id, "approved");
    toast.success(`${p.name} approved — added to verified alumni`);
  };

  const onConfirmDialog = () => {
    if (dialog.kind === "none") return;
    if (!dialogText.trim()) {
      toast.error("A message / reason is required");
      return;
    }
    const p = PENDING_ALUMNI.find((x) => x.id === dialog.id);
    if (dialog.kind === "reject") {
      decide(dialog.id, "rejected");
      toast.success(`${p?.name ?? "Submission"} rejected`);
    } else {
      decide(dialog.id, "info");
      toast.success("Info request sent to the applicant");
    }
    setDialog({ kind: "none" });
    setDialogText("");
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
        <StatTile label="Pending" value={totals.pending} />
        <StatTile label="Flagged" value={totals.flagged} />
        <StatTile label="Oldest wait" value={`${totals.oldest}h`} />
        <StatTile
          label="Reviewed (session)"
          value={totals.reviewedToday}
          hint={`${totals.approved} approved`}
        />
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "flagged", "clean"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
                filter === f
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "oldest" | "newest")}
            className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, program…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            message="Queue clear"
            description="No pending registrations match. Nice work."
            cta={{ label: "Back to alumni roster", href: "/admin/alumni" }}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* List */}
          <aside className="space-y-1.5">
            {pending.map((p) => {
              const on = active?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left",
                    on
                      ? "border-foreground bg-muted"
                      : "border-border hover:bg-muted/50",
                  )}
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
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {ageSince(p.submittedAt)} · {p.method}
                  </div>
                </button>
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
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">
                      {active.method}
                    </span>
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
                        <DL label="City" value={active.city} />
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
                                Yes · {Math.round((active.registryConfidence ?? 0) * 100)}% confidence
                              </span>
                            }
                          />
                          <DL label="Registry name" value={active.registryRecord.name} />
                          <DL
                            label="Registry batch / program"
                            value={`${active.registryRecord.batch} · ${active.registryRecord.program}`}
                          />
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No registry match (stub mode). Cross-reference the AUF
                          registry manually before approving.
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
                            {APPROVAL_FLAG_LABEL[f]}
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
                    <Button size="sm" onClick={() => onApprove(active)}>
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
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
        Demo queue — approvals are not persisted. Mirrors the live verification
        flow at{" "}
        <Link href="/admin/queue" className="underline">
          /admin/queue
        </Link>
        .
      </p>

      {/* Reject / info dialog */}
      <AlertDialog
        open={dialog.kind !== "none"}
        onOpenChange={(open) => !open && setDialog({ kind: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog.kind === "reject"
                ? "Reject this registration"
                : "Request more information"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.kind === "info"
                ? "Tell the applicant what to update. They'll receive your message by email and on their status page."
                : "This decision is recorded. Be specific about the reason."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={4}
            value={dialogText}
            onChange={(e) => setDialogText(e.target.value)}
            placeholder={
              dialog.kind === "info" ? "Message to the applicant" : "Reason (required)"
            }
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onConfirmDialog();
              }}
              disabled={!dialogText.trim()}
            >
              Confirm
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

function DocRow({ label, doc }: { label: string; doc: UploadedDoc | null }) {
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
      <Button variant="ghost" size="icon-sm" aria-label={`Download ${label}`}>
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
