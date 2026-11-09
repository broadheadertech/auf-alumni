"use client";

/**
 * Admin job postings — every posting across all employers in one place.
 * Standard FilterPanel (search, status, company, employment type, location,
 * posted date range; URL-backed and persisted — the Analytics "Open postings"
 * quick link lands here pre-filtered with `employer=<employerOrgId>`); sort by
 * applicants or recency. Pending posts can be approved or rejected inline.
 *
 * Live data: convex/adminData.ts `employers` flattened to postings, so the
 * counts here match the Employers roster, Dashboard and Analytics. Approve /
 * reject call the audited convex/jobs.ts approveJob / rejectJob mutations.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { ArrowUpDown, Check, ChevronRight, Loader2, X } from "lucide-react";
import { api } from "@/lib/convex-api";
import { useAsOf } from "@/lib/use-as-of";
import { fmtDate, type PostingStatus } from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostingStatusBadge, StatTile } from "@/components/auf/AdminBits";
import { FilterPanel, type FilterField } from "@/components/auf/FilterPanel";
import { useUrlFilters } from "@/lib/use-url-filters";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/auf/Pagination";
import { usePagination } from "@/lib/use-pagination";

type EmployerView = FunctionReturnType<typeof api.adminData.employers>[number];
type PostingView = EmployerView["postings"][number];

type JobRow = {
  posting: PostingView;
  employerId: string;
  employerName: string;
  applicants: number;
};

type SortKey = "applicants" | "posted";

const FILTER_KEYS = ["q", "status", "employer", "type", "location", "from", "to"] as const;

const STATUS_FILTERS: { value: PostingStatus; label: string }[] = [
  { value: "published", label: "Published" },
  { value: "pending-moderation", label: "Pending" },
  { value: "closed", label: "Closed" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
];

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const data = err.data as { message?: string } | string;
    return typeof data === "string" ? data : data?.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

export default function AdminJobsPage() {
  const asOf = useAsOf();
  const employers = useQuery(api.adminData.employers, { asOf });
  const loading = employers === undefined;
  const approveJob = useMutation(api.jobs.approveJob);
  const rejectJob = useMutation(api.jobs.rejectJob);
  const { values, set, reset, restored } = useUrlFilters("admin-jobs", FILTER_KEYS);
  const [sort, setSort] = useState<SortKey>("applicants");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<JobRow | null>(null);
  const [reason, setReason] = useState("");

  const allRows = useMemo<JobRow[]>(
    () =>
      (employers ?? []).flatMap((e) =>
        e.postings.map((p) => ({
          posting: p,
          employerId: e.id,
          employerName: e.name,
          applicants: p.applicants.length,
        })),
      ),
    [employers],
  );

  const employerOptions = useMemo(
    () => (employers ?? []).map((e) => ({ value: e.id, label: e.name })),
    [employers],
  );
  const typeOptions = useMemo(
    () => [...new Set(allRows.map((r) => r.posting.employmentType))].sort(),
    [allRows],
  );
  const locationOptions = useMemo(
    () => [...new Set(allRows.map((r) => r.posting.location))].filter(Boolean).sort(),
    [allRows],
  );

  const rows = useMemo(() => {
    const q = values.q.trim().toLowerCase();
    return allRows
      .filter((r) => {
        if (values.status && r.posting.status !== values.status) return false;
        if (values.employer && r.employerId !== values.employer) return false;
        if (values.type && r.posting.employmentType !== values.type) return false;
        if (values.location && r.posting.location !== values.location) return false;
        if (values.from && r.posting.postedAt.slice(0, 10) < values.from) return false;
        if (values.to && r.posting.postedAt.slice(0, 10) > values.to) return false;
        if (q && !(r.posting.title + " " + r.employerName).toLowerCase().includes(q))
          return false;
        return true;
      })
      .sort((a, b) =>
        sort === "applicants"
          ? b.applicants - a.applicants
          : b.posting.postedAt.localeCompare(a.posting.postedAt),
      );
  }, [allRows, values, sort]);

  const paged = usePagination(rows, {
    resetKey: Object.values(values).join("|"),
  });

  const totals = useMemo(
    () => ({
      total: allRows.length,
      published: allRows.filter((r) => r.posting.status === "published").length,
      pending: allRows.filter((r) => r.posting.status === "pending-moderation").length,
      applicants: allRows.reduce((s, r) => s + r.applicants, 0),
    }),
    [allRows],
  );

  const fields: FilterField[] = [
    { type: "search", key: "q", label: "Search", placeholder: "Title or company…" },
    {
      type: "select",
      key: "status",
      label: "Status",
      allLabel: "Any status",
      options: STATUS_FILTERS.map((o) => ({ value: o.value, label: o.label })),
    },
    {
      type: "select",
      key: "employer",
      label: "Company",
      allLabel: "All companies",
      options: employerOptions,
    },
    {
      type: "select",
      key: "type",
      label: "Employment type",
      allLabel: "Any type",
      options: typeOptions.map((t) => ({ value: t, label: t })),
    },
    {
      type: "select",
      key: "location",
      label: "Location",
      allLabel: "Any location",
      options: locationOptions.map((l) => ({ value: l, label: l })),
    },
    { type: "date", key: "from", label: "Posted from", max: values.to },
    { type: "date", key: "to", label: "Posted to", min: values.from },
  ];

  const approve = async (r: JobRow) => {
    setBusyId(r.posting.id);
    try {
      await approveJob({ jobId: r.posting.id as never });
      toast.success(`“${r.posting.title}” approved — now published`);
    } catch (err) {
      toast.error(errorMessage(err, "Approve failed"));
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    const why = reason.trim();
    if (!why) {
      toast.error("A rejection reason is required");
      return;
    }
    setBusyId(rejecting.posting.id);
    try {
      await rejectJob({ jobId: rejecting.posting.id as never, reason: why });
      toast.success(`“${rejecting.posting.title}” rejected`);
      setRejecting(null);
      setReason("");
    } catch (err) {
      toast.error(errorMessage(err, "Reject failed"));
    } finally {
      setBusyId(null);
    }
  };

  const tile = (n: number) => (loading ? "—" : n);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Job postings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every posting across all employers. For a full read of each pending
        submission, use{" "}
        <Link href="/admin/moderation/jobs" className="underline">
          Job moderation
        </Link>
        .
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Postings" value={tile(totals.total)} />
        <StatTile label="Published" value={tile(totals.published)} />
        <StatTile label="Pending review" value={tile(totals.pending)} />
        <StatTile label="Total applicants" value={tile(totals.applicants)} />
      </div>

      {/* Filters */}
      <FilterPanel
        layout="bar"
        className="mt-6"
        values={values}
        onChange={(k, v) => set(k as (typeof FILTER_KEYS)[number], v)}
        onReset={reset}
        restored={restored}
        fields={fields}
      />
      <div className="mt-3 flex items-center justify-end">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort postings"
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
        >
          <option value="applicants">Sort: applicants</option>
          <option value="posted">Sort: most recent</option>
        </select>
      </div>

      {/* Table */}
      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Posting</th>
                  <th className="px-3 py-2 text-left font-medium">Company</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <SortableTh
                    label="Applicants"
                    active={sort === "applicants"}
                    onClick={() => setSort("applicants")}
                  />
                  <SortableTh
                    label="Posted"
                    active={sort === "posted"}
                    onClick={() => setSort("posted")}
                  />
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Loading postings…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      {allRows.length === 0 ? (
                        "No job postings yet."
                      ) : (
                        <>
                          No postings match these filters.{" "}
                          <button
                            type="button"
                            onClick={reset}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            Reset filters
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  paged.pageItems.map((r) => {
                    const pending = r.posting.status === "pending-moderation";
                    const busy = busyId === r.posting.id;
                    return (
                      <tr
                        key={r.posting.id}
                        className="border-b border-border align-top last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-3 py-3">
                          <Link
                            href={`/admin/jobs/${r.posting.id}`}
                            className="font-medium hover:underline"
                          >
                            {r.posting.title}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {r.posting.location} · {r.posting.employmentType} ·{" "}
                            {r.posting.salaryLabel}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/admin/employers/${r.employerId}`}
                            className="text-sm hover:underline"
                          >
                            {r.employerName}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <PostingStatusBadge status={r.posting.status} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {r.applicants}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {fmtDate(r.posting.postedAt)}
                          {r.posting.closesAt && (
                            <div className="text-[11px]">
                              closes {fmtDate(r.posting.closesAt)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {pending ? (
                              <>
                                <Button size="xs" disabled={busy} onClick={() => approve(r)}>
                                  {busy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  Approve
                                </Button>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => {
                                    setReason("");
                                    setRejecting(r);
                                  }}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <Link
                                href={`/admin/jobs/${r.posting.id}`}
                                className="inline-flex text-muted-foreground hover:text-foreground"
                                aria-label={`Open ${r.posting.title}`}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {!loading && (
        <Pagination
          state={paged}
          noun={
            paged.total === allRows.length
              ? "posting"
              : `matching posting (of ${allRows.length})`
          }
        />
      )}

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && busyId === null && setRejecting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject “{rejecting?.posting.title}”?</DialogTitle>
            <DialogDescription>
              The reason is sent to {rejecting?.employerName ?? "the employer"}.
              The posting is taken out of the review queue.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (sent to the employer)"
            aria-label="Rejection reason"
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busyId !== null}
              onClick={() => setRejecting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busyId !== null || !reason.trim()}
              onClick={confirmReject}
            >
              {busyId !== null ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableTh({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2 text-right font-medium">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex flex-row-reverse items-center gap-1 hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
      </button>
    </th>
  );
}
