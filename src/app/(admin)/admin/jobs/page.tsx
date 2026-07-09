"use client";

/**
 * Admin job postings — every posting across all employers in one place
 * (replaces the pending-only moderation queue). Filter by status, employer,
 * and search; sort by applicants or recency. Pending posts can be approved or
 * rejected inline (folds in what the old moderation queue did).
 *
 * Mock-data prototype for stakeholder review — see lib/mock-admin.ts.
 * Approve/reject decisions are local to the session.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpDown, Check, ChevronRight, Search, X } from "lucide-react";
import {
  EMPLOYERS,
  fmtDate,
  jobApplicants,
  type EmployerPosting,
  type PostingStatus,
} from "@/lib/mock-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PostingStatusBadge, StatTile } from "@/components/auf/AdminBits";
import { cn } from "@/lib/utils";

type JobRow = {
  posting: EmployerPosting;
  employerId: string;
  employerName: string;
  applicants: number;
};

type StatusFilter = "all" | PostingStatus;
type SortKey = "applicants" | "posted";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "pending-moderation", label: "Pending" },
  { value: "closed", label: "Closed" },
  { value: "draft", label: "Draft" },
];

const ALL_ROWS: JobRow[] = EMPLOYERS.flatMap((e) =>
  e.postings.map((p) => ({
    posting: p,
    employerId: e.id,
    employerName: e.name,
    applicants: jobApplicants(p).length,
  })),
);

const EMPLOYER_OPTIONS = EMPLOYERS.map((e) => ({ id: e.id, name: e.name }));

export default function AdminJobsPage() {
  // Local status overrides from approve/reject actions.
  const [override, setOverride] = useState<Record<string, PostingStatus>>({});
  const [status, setStatus] = useState<StatusFilter>("all");
  const [employer, setEmployer] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("applicants");

  const statusOf = (r: JobRow): PostingStatus => override[r.posting.id] ?? r.posting.status;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_ROWS.filter((r) => {
      if (status !== "all" && statusOf(r) !== status) return false;
      if (employer !== "all" && r.employerId !== employer) return false;
      if (q && !(r.posting.title + " " + r.employerName).toLowerCase().includes(q))
        return false;
      return true;
    }).sort((a, b) =>
      sort === "applicants"
        ? b.applicants - a.applicants
        : b.posting.postedAt.localeCompare(a.posting.postedAt),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, employer, search, sort, override]);

  const totals = useMemo(() => {
    const eff = (r: JobRow) => override[r.posting.id] ?? r.posting.status;
    return {
      total: ALL_ROWS.length,
      published: ALL_ROWS.filter((r) => eff(r) === "published").length,
      pending: ALL_ROWS.filter((r) => eff(r) === "pending-moderation").length,
      applicants: ALL_ROWS.reduce((s, r) => s + r.applicants, 0),
    };
  }, [override]);

  const approve = (r: JobRow) => {
    setOverride((m) => ({ ...m, [r.posting.id]: "published" }));
    toast.success(`“${r.posting.title}” approved — now published`);
  };
  const reject = (r: JobRow) => {
    setOverride((m) => ({ ...m, [r.posting.id]: "closed" }));
    toast.success(`“${r.posting.title}” rejected`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Job postings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every posting across all employers. Review pending posts, or filter by
        status and company.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Postings" value={totals.total} />
        <StatTile label="Published" value={totals.published} />
        <StatTile label="Pending review" value={totals.pending} />
        <StatTile label="Total applicants" value={totals.applicants} />
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                status === s.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={employer}
            onChange={(e) => setEmployer(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          >
            <option value="all">All companies</option>
            {EMPLOYER_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          >
            <option value="applicants">Sort: applicants</option>
            <option value="posted">Sort: most recent</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search title, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 sm:w-56"
            />
          </div>
        </div>
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
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No postings match these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const st = statusOf(r);
                    const pending = st === "pending-moderation";
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
                          <PostingStatusBadge status={st} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {r.applicants}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {fmtDate(r.posting.postedAt)}
                          <div className="text-[11px]">
                            closes {fmtDate(r.posting.closesAt)}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {pending ? (
                              <>
                                <Button size="xs" onClick={() => approve(r)}>
                                  <Check className="h-3.5 w-3.5" />
                                  Approve
                                </Button>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => reject(r)}
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

      <p className="mt-3 text-xs italic text-muted-foreground">
        Showing {rows.length} of {ALL_ROWS.length} postings · demo data.
        Approve/reject decisions are not persisted.
      </p>
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
