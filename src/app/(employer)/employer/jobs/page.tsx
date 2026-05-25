"use client";

/**
 * Employer jobs management (Epic 13).
 *
 * Lists the jobs the signed-in employer has posted across their orgs, and
 * provides a Post-a-job dialog that calls `jobs.createJob`. New jobs land
 * in the admin moderation queue (status: "pending-moderation") and only
 * become visible to alumni after admin approval.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { EmptyState } from "@/components/auf/EmptyState";

type EmployerOrg = { _id: string; name: string; tier: string };

type Job = {
  _id: string;
  title: string;
  location: string;
  employmentType: string;
  status: string;
  statusReason?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  createdAt: number;
  publishedAt?: number;
  employerName: string;
  employerOrgId: string;
};

const EMPLOYMENT_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

export default function EmployerJobsPage() {
  const employersRaw = useQuery(api.employerOrgs.listMine);
  const employers = (employersRaw ?? null) as EmployerOrg[] | null;
  const allJobs = useQuery(api.jobs.browse, { showUnmatched: true });
  const createJob = useMutation(api.jobs.createJob);

  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    employmentType: "full-time",
    salaryMin: "",
    salaryMax: "",
  });
  const [submitting, setSubmitting] = useState(false);

  /* eslint-disable */
  useEffect(() => {
    if (!selectedOrg && employers && employers.length > 0) {
      setSelectedOrg(employers[0]._id);
    }
  }, [selectedOrg, employers]);
  /* eslint-enable */

  const orgIdSet = new Set((employers ?? []).map((e) => e._id));
  const myJobs = ((allJobs ?? []) as Job[]).filter((j) =>
    orgIdSet.has(j.employerOrgId),
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    if (!form.title.trim() || !form.description.trim() || !form.location.trim()) {
      toast.error("Title, description, and location are required");
      return;
    }
    setSubmitting(true);
    try {
      await createJob({
        employerOrgId: selectedOrg as unknown as never,
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        employmentType: form.employmentType,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        salaryCurrency: "PHP",
      });
      toast.success("Job submitted — awaiting admin moderation");
      setForm({
        title: "",
        description: "",
        location: "",
        employmentType: "full-time",
        salaryMin: "",
        salaryMax: "",
      });
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  };

  if (employersRaw === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        <Loader2 className="mx-auto h-6 w-6 animate-spin ink-3" />
      </div>
    );
  }
  if (!employers || employers.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        <EmptyState
          message="No employer organisation yet"
          description="Once an admin grants you Partner access or you complete Verified-tier onboarding, you'll be able to post jobs here."
          cta={{ label: "Back to dashboard", href: "/employer/dashboard" }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-[28px] font-semibold leading-tight">
            Jobs
          </h1>
          <p className="text-[13px] ink-3 mt-1">
            Post roles to verified AUF alumni. Every post is reviewed by the
            school before publication.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="auf-btn auf-btn-primary"
        >
          <Plus size={14} /> Post a job
        </button>
      </div>

      {myJobs.length === 0 ? (
        <EmptyState
          message="No jobs yet"
          description="Use Post a job to create your first listing."
        />
      ) : (
        <div className="space-y-3">
          {myJobs.map((j) => (
            <JobRow key={j._id} job={j} />
          ))}
        </div>
      )}

      {dialogOpen && (
        <PostJobDialog
          employers={employers}
          selectedOrg={selectedOrg}
          setSelectedOrg={setSelectedOrg}
          form={form}
          setForm={setForm}
          onSubmit={onSubmit}
          submitting={submitting}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  const StatusIcon =
    job.status === "published"
      ? CheckCircle2
      : job.status === "suspended"
        ? XCircle
        : Clock;
  const statusTone =
    job.status === "published"
      ? "text-(--color-success)"
      : job.status === "suspended"
        ? "text-destructive"
        : "ink-3";
  return (
    <div className="auf-card p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg brand-50 brand-fg flex items-center justify-center shrink-0">
        <Briefcase size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-medium text-[15px]">{job.title}</h2>
          <span className={`auf-chip text-[10.5px] ${statusTone}`}>
            <StatusIcon size={11} /> {job.status}
          </span>
        </div>
        <div className="text-[12.5px] ink-3 mt-1">
          {job.employerName} · {job.location} · {job.employmentType}
        </div>
        {job.statusReason && (
          <div className="text-[12px] mt-1 text-destructive">
            Reason: {job.statusReason}
          </div>
        )}
      </div>
      <Link
        href="/employer/applicants"
        className="auf-btn auf-btn-outline auf-btn-sm shrink-0"
      >
        View applicants →
      </Link>
    </div>
  );
}

function PostJobDialog({
  employers,
  selectedOrg,
  setSelectedOrg,
  form,
  setForm,
  onSubmit,
  submitting,
  onClose,
}: {
  employers: EmployerOrg[];
  selectedOrg: string | null;
  setSelectedOrg: (id: string) => void;
  form: {
    title: string;
    description: string;
    location: string;
    employmentType: string;
    salaryMin: string;
    salaryMax: string;
  };
  setForm: (
    f: (prev: typeof form) => typeof form,
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="auf-card w-full max-w-[560px] max-h-[90vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-[20px] font-semibold">Post a new job</h2>
        <p className="text-[13px] ink-3 mt-1">
          After you submit, an AUF admin reviews the listing before it goes live
          to alumni.
        </p>
        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          {employers.length > 1 && (
            <Field label="Employer organisation">
              <select
                value={selectedOrg ?? ""}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="auf-input"
              >
                {employers.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.name} ({e.tier})
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Job title">
            <input
              required
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
              placeholder="Frontend Engineer"
              className="auf-input"
            />
          </Field>
          <Field label="Description">
            <textarea
              required
              rows={5}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="What the role does, who you're looking for, what stage you're at."
              className="auf-input resize-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location">
              <input
                required
                value={form.location}
                onChange={(e) =>
                  setForm((p) => ({ ...p, location: e.target.value }))
                }
                placeholder="Taguig, NCR · Hybrid"
                className="auf-input"
              />
            </Field>
            <Field label="Employment type">
              <select
                value={form.employmentType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, employmentType: e.target.value }))
                }
                className="auf-input"
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Salary min (PHP)">
              <input
                type="number"
                min={0}
                value={form.salaryMin}
                onChange={(e) =>
                  setForm((p) => ({ ...p, salaryMin: e.target.value }))
                }
                placeholder="70000"
                className="auf-input"
              />
            </Field>
            <Field label="Salary max (PHP)">
              <input
                type="number"
                min={0}
                value={form.salaryMax}
                onChange={(e) =>
                  setForm((p) => ({ ...p, salaryMax: e.target.value }))
                }
                placeholder="95000"
                className="auf-input"
              />
            </Field>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="auf-btn auf-btn-outline justify-center"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="auf-btn auf-btn-primary justify-center"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <Plus size={14} /> Submit for review
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium ink-2 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
