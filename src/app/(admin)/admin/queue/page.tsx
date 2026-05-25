"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/auf/EmptyState";
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

type QueueItem = {
  submissionId: string;
  userId: string;
  userEmail?: string;
  claimedName: string;
  claimedBatch: number;
  claimedProgram: string;
  flags: string[];
  registryMatched: boolean;
  registryConfidence?: number;
  registryRecordSnapshot?: unknown;
  createdAt: number;
  ageMs: number;
};

type DialogState =
  | { kind: "none" }
  | { kind: "reject"; submissionId: string }
  | { kind: "info"; submissionId: string }
  | { kind: "escalate"; submissionId: string };

function formatAge(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return `${Math.round(ms / 60000)}m old`;
  if (hours < 48) return `${hours.toFixed(1)}h old`;
  return `${Math.round(hours / 24)}d old`;
}

export default function AdminQueuePage() {
  const queue = useQuery(api.admin.verificationQueue);
  const approve = useMutation(api.admin.approveVerification);
  const reject = useMutation(api.admin.rejectVerification);
  const requestInfo = useMutation(api.admin.requestVerificationInfo);
  const escalate = useMutation(api.admin.escalateVerification);

  const [activeIdx, setActiveIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [dialogText, setDialogText] = useState("");

  const items = (queue ?? []) as QueueItem[];
  const active = useMemo<QueueItem | undefined>(
    () => items[Math.min(activeIdx, items.length - 1)],
    [items, activeIdx],
  );

  const advanceToNext = useCallback(() => {
    setActiveIdx((i) => Math.min(i, items.length - 2));
  }, [items.length]);

  const onApprove = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    try {
      await approve({ submissionId: active.submissionId as unknown as never });
      toast.success("Approved");
      advanceToNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }, [active, approve, advanceToNext]);

  // Keyboard shortcuts (Story 6.2 + UX spec)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!active || busy) return;
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = e.key.toLowerCase();
      if (k === "a") {
        e.preventDefault();
        void onApprove();
      } else if (k === "r") {
        e.preventDefault();
        setDialog({ kind: "reject", submissionId: active.submissionId });
        setDialogText("");
      } else if (k === "i") {
        e.preventDefault();
        setDialog({ kind: "info", submissionId: active.submissionId });
        setDialogText("Please upload a clearer copy of your diploma photo.");
      } else if (k === "e") {
        e.preventDefault();
        setDialog({ kind: "escalate", submissionId: active.submissionId });
        setDialogText("");
      } else if (k === "j") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, items.length - 1));
      } else if (k === "k") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, busy, onApprove, items.length]);

  const onConfirmDialog = async () => {
    if (dialog.kind === "none") return;
    if (!dialogText.trim()) {
      toast.error("Reason / message is required");
      return;
    }
    setBusy(true);
    try {
      if (dialog.kind === "reject") {
        await reject({
          submissionId: dialog.submissionId as unknown as never,
          reason: dialogText.trim(),
        });
        toast.success("Rejected");
      } else if (dialog.kind === "info") {
        await requestInfo({
          submissionId: dialog.submissionId as unknown as never,
          message: dialogText.trim(),
        });
        toast.success("Info request sent");
      } else if (dialog.kind === "escalate") {
        await escalate({
          submissionId: dialog.submissionId as unknown as never,
          reason: dialogText.trim(),
        });
        toast.success("Escalated");
      }
      setDialog({ kind: "none" });
      setDialogText("");
      advanceToNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (queue === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (queue === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <EmptyState
          message="Admin access required"
          cta={{ label: "Sign in", href: "/login" }}
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <EmptyState
          message="Queue empty"
          description="No pending verification submissions. Nice work."
          cta={{ label: "Back to dashboard", href: "/admin/dashboard" }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Verification queue
        </h1>
        <span className="text-xs text-muted-foreground">
          {items.length} pending · keyboard:{" "}
          <kbd className="rounded bg-muted px-1">A</kbd> approve ·{" "}
          <kbd className="rounded bg-muted px-1">R</kbd> reject ·{" "}
          <kbd className="rounded bg-muted px-1">I</kbd> info ·{" "}
          <kbd className="rounded bg-muted px-1">E</kbd> escalate ·{" "}
          <kbd className="rounded bg-muted px-1">J</kbd>/
          <kbd className="rounded bg-muted px-1">K</kbd> next/prev
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sidebar list */}
        <aside className="space-y-1">
          {items.map((item, i) => (
            <button
              key={item.submissionId}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={
                "w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted " +
                (i === activeIdx
                  ? "bg-muted font-medium"
                  : "")
              }
            >
              <div className="truncate">{item.claimedName}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{item.claimedProgram}</span>
                <span>·</span>
                <span>{item.claimedBatch}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {formatAge(item.ageMs)}
                </span>
                {item.flags.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-[oklch(0.70_0.15_60_/_0.15)] px-1 text-[var(--color-warning)]">
                    <AlertTriangle className="h-3 w-3" />
                    {item.flags.length}
                  </span>
                )}
              </div>
            </button>
          ))}
        </aside>

        {/* Side-by-side review */}
        {active && (
          <section className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Submission
                    </h2>
                    <dl className="mt-3 space-y-2 text-sm">
                      <DL label="Name" value={active.claimedName} />
                      <DL
                        label="Batch / Program"
                        value={`${active.claimedBatch} · ${active.claimedProgram}`}
                      />
                      <DL label="Email" value={active.userEmail ?? "—"} />
                      <DL
                        label="Submitted"
                        value={`${formatAge(active.ageMs)} (${new Date(
                          active.createdAt,
                        ).toLocaleString()})`}
                      />
                    </dl>
                  </div>
                  <div>
                    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Registry
                    </h2>
                    {active.registryMatched ? (
                      <dl className="mt-3 space-y-2 text-sm">
                        <DL
                          label="Match"
                          value={`Yes (${Math.round((active.registryConfidence ?? 0) * 100)}% confidence)`}
                        />
                        <DL
                          label="Record"
                          value={
                            <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                              {JSON.stringify(
                                active.registryRecordSnapshot,
                                null,
                                2,
                              )}
                            </pre>
                          }
                        />
                      </dl>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No registry match. v1 runs in stub mode — admin must
                        cross-reference the AUF registry manually.
                      </p>
                    )}
                    {active.flags.length > 0 && (
                      <div className="mt-3 rounded-md border border-[var(--color-warning)]/30 bg-[oklch(0.70_0.15_60_/_0.05)] px-3 py-2 text-xs">
                        <strong>Flags:</strong>{" "}
                        {active.flags.map((f) => f.replaceAll("-", " ")).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={onApprove}
                disabled={busy}
                title="Keyboard: A"
              >
                {busy ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1 h-4 w-4" />
                )}
                Approve <kbd className="ml-1 rounded bg-background/80 px-1 text-[10px]">A</kbd>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDialog({ kind: "reject", submissionId: active.submissionId });
                  setDialogText("");
                }}
                disabled={busy}
                title="Keyboard: R"
              >
                <X className="mr-1 h-4 w-4" />
                Reject <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">R</kbd>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDialog({ kind: "info", submissionId: active.submissionId });
                  setDialogText(
                    "Please upload a clearer copy of your diploma photo.",
                  );
                }}
                disabled={busy}
                title="Keyboard: I"
              >
                Info <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">I</kbd>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDialog({ kind: "escalate", submissionId: active.submissionId });
                  setDialogText("");
                }}
                disabled={busy}
                title="Keyboard: E"
              >
                Escalate <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">E</kbd>
              </Button>
            </div>
          </section>
        )}
      </div>

      {/* Action dialog */}
      <AlertDialog
        open={dialog.kind !== "none"}
        onOpenChange={(open) => !open && setDialog({ kind: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog.kind === "reject"
                ? "Reject this submission"
                : dialog.kind === "info"
                  ? "Request more info"
                  : "Escalate to supervisor"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.kind === "info"
                ? "Tell the alumna what to update. They'll receive your message by email and on their status page."
                : "This action is audit-logged. Be specific about the reason."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={4}
            value={dialogText}
            onChange={(e) => setDialogText(e.target.value)}
            placeholder={
              dialog.kind === "info"
                ? "Message to the alumna"
                : "Reason (required)"
            }
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onConfirmDialog();
              }}
              disabled={busy || !dialogText.trim()}
            >
              {busy ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DL({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
