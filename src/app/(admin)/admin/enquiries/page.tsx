"use client";

/**
 * Admin → Enquiries: everything sent through the public contact forms
 * (convex/enquiries.ts). Standard FilterPanel (status, topic, search, date;
 * URL-backed and persisted) plus bulk status changes, per-enquiry notes, and
 * a one-click reply that opens the sender's email.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Inbox, Loader2, Mail, StickyNote } from "lucide-react";
import { api } from "@/lib/convex-api";
import { useUrlFilters } from "@/lib/use-url-filters";
import { runBulk, useBulkSelection } from "@/lib/use-bulk-selection";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/auf/EmptyState";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";
import { BulkActionBar, SelectCheckbox } from "@/components/auf/BulkActionBar";
import { cn } from "@/lib/utils";
import { AdminPage } from "@/components/auf/admin-ui";

type Enquiry = {
  _id: string;
  topic: string;
  topicLabel: string;
  name: string;
  email: string;
  organisation: string | null;
  message: string;
  sourcePath: string | null;
  status: "new" | "in-progress" | "closed";
  adminNotes: string | null;
  handledByName: string | null;
  handledAt: number | null;
  createdAt: number;
};

const FILTER_KEYS = ["q", "status", "topic", "from", "to"] as const;

const STATUS_STYLE: Record<Enquiry["status"], string> = {
  new: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  "in-progress": "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  closed: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<Enquiry["status"], string> = {
  new: "New",
  "in-progress": "In progress",
  closed: "Closed",
};

function fmt(ms: number): string {
  return new Date(ms).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

export default function AdminEnquiriesPage() {
  const rows = useQuery(api.enquiries.adminList) as Enquiry[] | undefined;
  const setStatus = useMutation(api.enquiries.setStatus);
  const setNotes = useMutation(api.enquiries.setNotes);
  const { values, set, reset, restored } = useUrlFilters("admin-enquiries", FILTER_KEYS);
  const [busy, setBusy] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const all = useMemo(() => rows ?? [], [rows]);
  const counts = useMemo(() => {
    const c = { new: 0, "in-progress": 0, closed: 0 } as Record<string, number>;
    for (const r of all) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [all]);
  const topics = useMemo(
    () => [...new Map(all.map((r) => [r.topic, r.topicLabel])).entries()],
    [all],
  );

  const needle = values.q.trim().toLowerCase();
  const visible = all.filter((r) => {
    if (values.status && r.status !== values.status) return false;
    if (values.topic && r.topic !== values.topic) return false;
    const day = new Date(r.createdAt).toISOString().slice(0, 10);
    if (values.from && day < values.from) return false;
    if (values.to && day > values.to) return false;
    if (
      needle &&
      !`${r.name} ${r.email} ${r.organisation ?? ""} ${r.message}`.toLowerCase().includes(needle)
    ) {
      return false;
    }
    return true;
  });

  const selection = useBulkSelection(visible.map((r) => r._id));

  const fields: FilterField[] = [
    { type: "search", key: "q", label: "Search", placeholder: "Name, email, company, message…" },
    {
      type: "select",
      key: "status",
      label: "Status",
      allLabel: `Any status (${all.length})`,
      options: (["new", "in-progress", "closed"] as const).map((s) => ({
        value: s,
        label: `${STATUS_LABEL[s]} (${counts[s] ?? 0})`,
      })),
    },
    {
      type: "select",
      key: "topic",
      label: "Topic",
      allLabel: "All topics",
      options: topics.map(([value, label]) => ({ value, label })),
    },
    { type: "date", key: "from", label: "Received from", max: values.to },
    { type: "date", key: "to", label: "Received to", min: values.from },
  ];

  const bulkStatus = async (status: Enquiry["status"]) => {
    const ids = selection.selectedIds;
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const { ok, failed } = await runBulk(ids, (id) =>
        setStatus({ enquiryId: id as never, status }),
      );
      const msg = `Marked ${ok.length} ${STATUS_LABEL[status].toLowerCase()}${
        failed.length ? ` · ${failed.length} failed` : ""
      }`;
      if (failed.length) toast.warning(msg, { description: failed[0].message });
      else toast.success(msg);
      selection.deselect(ok);
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async (id: string) => {
    setBusy(true);
    try {
      await setNotes({ enquiryId: id as never, notes: noteDraft });
      toast.success("Note saved");
      setNoteFor(null);
      setNoteDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Enquiries"
      description="Messages from the public contact forms. A copy is emailed to the AUF address for each topic; this is the record you can triage."
      actions={
        rows !== undefined ? (
          <span className="text-[13px] text-muted-foreground">
            {counts.new ?? 0} new
          </span>
        ) : undefined
      }
    >

      {rows === undefined ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </CardContent>
        </Card>
      ) : all.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center">
            <EmptyState
              icon={Inbox}
              message="No enquiries yet"
              description="Messages from the Contact page and the employer “Talk to AUF” button land here."
              cta={{ label: "View the contact page", href: "/contact" }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <FilterPanel
            layout="bar"
            className="mt-5"
            fields={fields}
            values={values}
            onChange={(k, v) => set(k as (typeof FILTER_KEYS)[number], v)}
            onReset={reset}
            restored={restored}
          />

          <BulkActionBar
            className="mt-4"
            noun="enquiry"
            count={selection.count}
            total={selection.total}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            onSelectAll={selection.selectAll}
            onUnselectAll={selection.unselectAll}
          >
            <Button size="sm" variant="outline" disabled={busy} onClick={() => bulkStatus("in-progress")}>
              Mark in progress
            </Button>
            <Button size="sm" disabled={busy} onClick={() => bulkStatus("closed")}>
              Mark closed
            </Button>
          </BulkActionBar>

          <div className="mt-3 space-y-2">
            {visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No enquiries match these filters.
              </p>
            ) : (
              visible.map((r) => {
                const checked = selection.isSelected(r._id);
                return (
                  <Card key={r._id} className={cn(checked && "ring-1 ring-foreground/30")}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <SelectCheckbox
                          checked={checked}
                          onChange={() => selection.toggle(r._id)}
                          label={`Select enquiry from ${r.name}`}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium">{r.name}</span>
                            {r.organisation && (
                              <span className="text-xs text-muted-foreground">· {r.organisation}</span>
                            )}
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {r.topicLabel}
                            </span>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                STATUS_STYLE[r.status],
                              )}
                            >
                              {STATUS_LABEL[r.status]}
                            </span>
                            <span className="ml-auto text-[11px] text-muted-foreground">
                              {fmt(r.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
                            {r.message}
                          </p>
                          {r.adminNotes && (
                            <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                              <StickyNote className="mr-1 inline h-3 w-3" />
                              {r.adminNotes}
                            </p>
                          )}
                          {noteFor === r._id ? (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                rows={2}
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="Internal note (not sent to the sender)"
                                aria-label="Internal note"
                              />
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => setNoteFor(null)} disabled={busy}>
                                  Cancel
                                </Button>
                                <Button size="sm" onClick={() => void saveNote(r._id)} disabled={busy}>
                                  Save note
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              <a
                                href={`mailto:${r.email}?subject=Re: your message to AUF Alumni`}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
                              >
                                <Mail className="h-3.5 w-3.5" /> Reply to {r.email}
                              </a>
                              {r.status !== "closed" && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void setStatus({
                                      enquiryId: r._id as never,
                                      status: r.status === "new" ? "in-progress" : "closed",
                                    })
                                  }
                                  className="rounded-md border border-border px-2 py-1 hover:bg-muted"
                                >
                                  {r.status === "new" ? "Mark in progress" : "Mark closed"}
                                </button>
                              )}
                              {r.topic === "employer" && (
                                <Link
                                  href="/admin/employers"
                                  className="rounded-md border border-border px-2 py-1 hover:bg-muted"
                                >
                                  Onboard employer
                                </Link>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setNoteFor(r._id);
                                  setNoteDraft(r.adminNotes ?? "");
                                }}
                                className="rounded-md border border-border px-2 py-1 hover:bg-muted"
                              >
                                {r.adminNotes ? "Edit note" : "Add note"}
                              </button>
                              {r.handledByName && (
                                <span className="text-muted-foreground">
                                  Last handled by {r.handledByName}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}
    </AdminPage>
  );
}
