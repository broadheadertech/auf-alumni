"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Shield } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { EmptyState } from "@/components/auf/EmptyState";

type DSR = {
  _id: string;
  userId: string;
  type: string;
  requestedAt: number;
  acknowledgedAt?: number;
  fulfilledAt?: number;
  outcome?: string;
  userEmail: string | null;
  overdueAck: boolean;
  overdueFulfil: boolean;
};

type Incident = {
  _id: string;
  title: string;
  severity: string;
  description: string;
  startedAt: number;
  npcNotifiedAt?: number;
  subjectsNotifiedAt?: number;
  closedAt?: number;
  closureNotes?: string;
  hoursElapsed: number;
  hoursLeft: number;
  npcOverdue: boolean;
};

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const hours = ms / (60 * 60 * 1000);
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function CompliancePage() {
  const dsrs = useQuery(api.compliance.listDataSubjectRequests, { limit: 50 });
  const incidents = useQuery(api.compliance.listIncidents);
  const startIncident = useMutation(api.compliance.startIncident);
  const markNotified = useMutation(api.compliance.markIncidentNotified);
  const closeIncident = useMutation(api.compliance.closeIncident);

  const [newOpen, setNewOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("high");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closureNotes, setClosureNotes] = useState("");

  if (dsrs === undefined || incidents === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (dsrs === null || incidents === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <EmptyState
          message="Super-admin access required"
          cta={{ label: "Back to dashboard", href: "/admin/dashboard" }}
        />
      </div>
    );
  }

  const dsrList = dsrs as DSR[];
  const incidentList = incidents as Incident[];

  const handleStart = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description required");
      return;
    }
    setBusy(true);
    try {
      await startIncident({
        title: title.trim(),
        severity,
        description: description.trim(),
      });
      toast.success("Incident started — 72-hour clock running");
      setTitle("");
      setDescription("");
      setSeverity("high");
      setNewOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (!closingId) return;
    if (!closureNotes.trim()) {
      toast.error("Closure notes required");
      return;
    }
    setBusy(true);
    try {
      await closeIncident({
        incidentId: closingId as unknown as never,
        closureNotes: closureNotes.trim(),
      });
      toast.success("Incident closed");
      setClosingId(null);
      setClosureNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not close");
    } finally {
      setBusy(false);
    }
  };

  const handleMark = async (
    id: string,
    kind: "npc" | "subjects",
  ) => {
    setBusy(true);
    try {
      await markNotified({
        incidentId: id as unknown as never,
        kind,
      });
      toast.success(`${kind === "npc" ? "NPC" : "Subjects"} marked notified`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
      <p className="text-sm text-muted-foreground">
        Data subject rights (DPA) + incident response (NFR34 72-hour window).
      </p>

      {/* Incidents */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Incidents</h2>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Shield className="mr-1 h-4 w-4" />
            Start incident response
          </Button>
        </div>
        {incidentList.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No incidents recorded. (Good.)
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {incidentList.map((i) => {
              const closed = i.closedAt != null;
              return (
                <Card
                  key={i._id}
                  className={
                    !closed && i.npcOverdue
                      ? "border-destructive/40 bg-destructive/5"
                      : !closed && i.severity === "critical"
                        ? "border-[var(--color-warning)]/40 bg-[oklch(0.70_0.15_60_/_0.05)]"
                        : ""
                  }
                >
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{i.title}</h3>
                          <span
                            className={
                              "rounded px-1.5 py-0.5 text-[11px] font-mono uppercase " +
                              (i.severity === "critical"
                                ? "bg-destructive/10 text-destructive"
                                : i.severity === "high"
                                  ? "bg-[oklch(0.70_0.15_60_/_0.15)] text-[var(--color-warning)]"
                                  : "bg-muted text-muted-foreground")
                            }
                          >
                            {i.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {i.description}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Started {new Date(i.startedAt).toLocaleString()} ·{" "}
                          {formatDuration(i.hoursElapsed * 60 * 60 * 1000)} ago
                        </p>
                      </div>
                      {!closed && (
                        <div className="text-right text-xs">
                          {i.npcOverdue ? (
                            <span className="font-medium text-destructive">
                              NPC overdue
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {i.hoursLeft.toFixed(1)}h left
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {i.npcNotifiedAt ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-success)]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          NPC notified
                        </span>
                      ) : !closed ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleMark(i._id, "npc")}
                        >
                          Mark NPC notified
                        </Button>
                      ) : null}
                      {i.subjectsNotifiedAt ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-success)]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Subjects notified
                        </span>
                      ) : !closed ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleMark(i._id, "subjects")}
                        >
                          Mark subjects notified
                        </Button>
                      ) : null}
                      {!closed ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setClosingId(i._id);
                            setClosureNotes("");
                          }}
                        >
                          Close…
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Closed {new Date(i.closedAt!).toLocaleDateString()}
                          {i.closureNotes && (
                            <span className="ml-1 italic">
                              — {i.closureNotes}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* DSR tracking */}
      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">
          Data subject rights (DSR) log
        </h2>
        <Card>
          <CardContent className="p-0">
            {dsrList.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No DSR requests yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Subject</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Requested</th>
                    <th className="px-3 py-2 text-left">Acknowledged</th>
                    <th className="px-3 py-2 text-left">Fulfilled</th>
                    <th className="px-3 py-2 text-left">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {dsrList.map((r) => (
                    <tr
                      key={r._id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2">{r.userEmail ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.type}</td>
                      <td className="px-3 py-2 text-xs">
                        {new Date(r.requestedAt).toLocaleDateString()}
                      </td>
                      <td
                        className={
                          "px-3 py-2 text-xs " +
                          (r.overdueAck ? "text-destructive" : "")
                        }
                      >
                        {r.acknowledgedAt
                          ? new Date(r.acknowledgedAt).toLocaleDateString()
                          : r.overdueAck
                            ? "OVERDUE"
                            : "—"}
                      </td>
                      <td
                        className={
                          "px-3 py-2 text-xs " +
                          (r.overdueFulfil ? "text-destructive" : "")
                        }
                      >
                        {r.fulfilledAt
                          ? new Date(r.fulfilledAt).toLocaleDateString()
                          : r.overdueFulfil
                            ? "OVERDUE"
                            : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.outcome ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* New-incident dialog */}
      <AlertDialog open={newOpen} onOpenChange={setNewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start incident response</AlertDialogTitle>
            <AlertDialogDescription>
              This starts the NFR34 72-hour notification clock. Be specific.
              See <code>docs/runbooks/incident-response.md</code>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="severity">Severity</Label>
              <select
                id="severity"
                value={severity}
                onChange={(e) =>
                  setSeverity(
                    e.target.value as "low" | "medium" | "high" | "critical",
                  )
                }
                className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleStart();
              }}
              disabled={busy || !title.trim() || !description.trim()}
            >
              {busy ? "Starting…" : "Start"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close-incident dialog */}
      <AlertDialog
        open={closingId != null}
        onOpenChange={(open) => !open && setClosingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close incident</AlertDialogTitle>
            <AlertDialogDescription>
              Closure is permanent in the audit log. Include the post-incident
              review summary.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={4}
            value={closureNotes}
            onChange={(e) => setClosureNotes(e.target.value)}
            placeholder="What happened, what we changed, what we learned"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleClose();
              }}
              disabled={busy || !closureNotes.trim()}
            >
              {busy ? "Closing…" : "Close incident"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cosmetic — keep this card off-screen for AlertTriangle/Clock visual reference */}
      <span className="hidden">
        <AlertTriangle />
        <Clock />
      </span>
    </div>
  );
}
