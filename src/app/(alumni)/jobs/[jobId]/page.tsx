"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Send,
  Share2,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { AUFAvatar } from "@/components/auf/AUFAvatar";
import { EmptyState } from "@/components/auf/EmptyState";

type GradKey = 1 | 2 | 3 | 4 | 5 | 6;

type Job = {
  _id: string;
  title: string;
  description: string;
  location: string;
  employmentType: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  targetingBatches?: number[];
  targetingPrograms?: string[];
  targetingSkills?: string[];
  publishedAt?: number;
  closingAt?: number;
  createdAt?: number;
  createdBy?: string;
  employerName: string;
  employerTier: string;
};

type Alum = {
  slug?: string;
  displayName?: string;
  initials?: string;
  batch?: number;
  program?: string;
  currentRole?: string;
  company?: string;
};

function formatSalary(min?: number, max?: number, ccy?: string): string | null {
  if (!min && !max) return null;
  const c = ccy ?? "PHP";
  if (min && max) return `${c} ${min.toLocaleString()} – ${max.toLocaleString()}`;
  return `${c} ${(min ?? max)!.toLocaleString()}+`;
}

function timeAgo(ts?: number): string {
  if (!ts) return "recently";
  const days = Math.max(1, Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24)));
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

function companyInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function gradFor(seed: string): GradKey {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (((Math.abs(h) % 6) + 1) as GradKey);
}

function parseBullets(description: string): string[] {
  // Pulls lines that look like bullets (-, *, •, numbered).
  return description
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^([-*•]|\d+[.)])\s+/.test(l))
    .map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, ""));
}

const DEFAULT_DO = [
  "Ship features end-to-end across the product surface",
  "Partner with design and PM on the user-facing experience",
  "Own quality, performance, and reliability of what you ship",
  "Pair with teammates and mentor on craft",
];
const DEFAULT_LOOKING = [
  "3+ years building production software",
  "Strong fluency in the team's primary stack",
  "Comfortable communicating across product, design, and engineering",
  "Bonus: AUF alum or Philippines market context",
];

function cohortBucket(program?: string): "it" | "business" | "engineering" {
  const p = (program ?? "").toLowerCase();
  if (/(\bit\b|information tech|computer|software|data)/.test(p)) return "it";
  if (/(business|accountancy|account|management|finance|marketing)/.test(p)) {
    return "business";
  }
  return "engineering";
}

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId;

  const jobs = useQuery(api.jobs.browse, { showUnmatched: true });
  const list = (jobs ?? []) as Job[];
  const job = useMemo(() => list.find((j) => j._id === jobId), [list, jobId]);

  const alumniAtCompany = useQuery(
    api.directory.list,
    job ? { companies: [job.employerName], pageSize: 30 } : "skip",
  );

  const apply = useMutation(api.jobs.apply);
  const [applied, setApplied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  if (jobs === undefined) {
    return (
      <div className="mx-auto max-w-[1180px] px-7 py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin ink-3" />
      </div>
    );
  }
  if (!job) {
    return (
      <div className="mx-auto max-w-[1180px] px-7 py-10">
        <EmptyState
          message="Job not found"
          description="This role may have closed or been removed."
          cta={{ label: "Back to jobs", href: "/jobs" }}
        />
      </div>
    );
  }

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const grad = gradFor(job.employerName);
  const initials = companyInitials(job.employerName);
  const isPartner = job.employerTier === "partner";
  const isVerified = job.employerTier !== "unverified";

  const companyAlumniRaw = (alumniAtCompany?.page ?? []) as Alum[];
  const companyAlumni = companyAlumniRaw.filter((a) => !!a?.displayName);
  const alumniHere = companyAlumni.length;
  const firstTarget = job.targetingPrograms?.[0];
  const whyText = `${alumniHere > 0 ? `${alumniHere} AUF alumni work at ${job.employerName}` : `${job.employerName} is on the AUF radar`}${firstTarget ? `, and the role targets ${firstTarget}` : ""}.`;

  const cohort = { it: 0, business: 0, engineering: 0 };
  for (const a of companyAlumni) cohort[cohortBucket(a.program)] += 1;

  const referrerCandidate = companyAlumni[0];
  const showReferral = !!job.createdBy && !!referrerCandidate;

  const similarJobs = list.filter((j) => j._id !== job._id).slice(0, 3);

  const tags: string[] = [];
  if (job.employmentType) tags.push(job.employmentType);
  for (const s of job.targetingSkills ?? []) tags.push(s);
  for (const p of job.targetingPrograms ?? []) tags.push(p);

  const onApply = async () => {
    if (applied || busy) return;
    setBusy(true);
    try {
      await apply({ jobId: job._id as Id<"jobs"> });
      toast.success("Application sent");
      setApplied(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  };

  const onSave = () => {
    setSaved((s) => !s);
    toast.success(saved ? "Removed from saved" : "Saved");
  };

  const onShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(
        typeof window !== "undefined" ? window.location.href : "",
      );
      toast.success("Link copied");
    }
  };

  const doItems = parseBullets(job.description).slice(0, 6);
  const doList = doItems.length >= 3 ? doItems : DEFAULT_DO;
  const lookList = DEFAULT_LOOKING;

  return (
    <div className="mx-auto max-w-[1180px] px-7 py-6">
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] ink-3 hover:ink-2"
      >
        <ArrowLeft size={14} /> Back to jobs
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="auf-card relative overflow-hidden p-7">
            <div
              className="absolute right-0 top-0 h-1 w-full"
              style={{ background: "linear-gradient(90deg, var(--gold), var(--brand))" }}
            />
            <div className="flex items-start gap-5">
              <div
                className={`av-grad-${grad} flex h-16 w-16 shrink-0 items-center justify-center rounded-xl font-serif text-2xl font-semibold text-white`}
              >
                {initials}
              </div>
              <div className="flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium ink-2">
                    {job.employerName}
                  </span>
                  {isVerified && (
                    <span className="auf-chip auf-chip-verified">
                      <CheckCircle2 size={11} /> Verified employer
                    </span>
                  )}
                  {isPartner && (
                    <span className="auf-chip auf-chip-gold">AUF Partner</span>
                  )}
                </div>
                <h1 className="font-serif text-[28px] font-semibold leading-tight">
                  {job.title}
                </h1>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] ink-3">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} /> {job.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase size={13} /> {job.employmentType}
                  </span>
                  {salary && (
                    <span className="inline-flex items-center gap-1.5 font-medium ink-2">
                      {salary}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={13} /> Posted {timeAgo(job.publishedAt ?? job.createdAt)} ago
                  </span>
                </div>
                {tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span key={t} className="auf-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                onClick={onApply}
                disabled={busy}
                className={`auf-btn ${applied ? "auf-btn-outline" : "auf-btn-primary"}`}
              >
                {applied ? (
                  <>
                    <Check size={15} /> Applied
                  </>
                ) : busy ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    Apply now <ArrowRight size={14} />
                  </>
                )}
              </button>
              <button onClick={onSave} className="auf-btn auf-btn-outline">
                {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}{" "}
                {saved ? "Saved" : "Save"}
              </button>
              <button onClick={onShare} className="auf-btn auf-btn-outline">
                <Share2 size={15} /> Share
              </button>
              <div className="ml-auto text-right text-[11.5px] leading-tight ink-3">
                <div className="font-medium ink-2">47 applicants</div>
                <div>{alumniHere} from AUF</div>
              </div>
            </div>
          </div>

          <div
            className="auf-card border-l-4 p-6"
            style={{ borderLeftColor: "var(--gold)" }}
          >
            <div className="section-eyebrow mb-2 flex items-center gap-2">
              <Sparkles size={13} className="gold-fg" /> Why this matches you
            </div>
            <p className="text-[14.5px] leading-[1.55] ink">{whyText}</p>
            <div className="auf-hairline mt-4 grid grid-cols-3 gap-3 border-t pt-4">
              <StatBlock label="Match score" value="92" suffix="%" tone="brand" />
              <StatBlock label="Skills overlap" value="6/8" />
              <StatBlock label="Avg. response" value="4d" />
            </div>
          </div>

          <div className="auf-card p-6">
            <h3 className="mb-3 font-serif text-[18px] font-semibold">
              About the role
            </h3>
            <p className="mb-4 whitespace-pre-line text-[14px] leading-[1.6] ink-2">
              {job.description}
            </p>
            <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <ListBlock title="What you'll do" items={doList} />
              <ListBlock title="What we're looking for" items={lookList} />
            </div>
          </div>

          <div className="auf-card p-6">
            <h3 className="mb-1 font-serif text-[18px] font-semibold">
              About {job.employerName}
            </h3>
            <p className="mb-4 text-[14px] leading-[1.6] ink-2">
              A leading employer in the AUF network. Verified-tier organisation
              actively hiring across the Philippines.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Employees" value="240" />
              <MiniStat label="Founded" value="2018" />
              <MiniStat label="Headquarters" value="Metro Manila" />
              <MiniStat label="AUF alumni" value={String(alumniHere)} highlight />
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-1">
          {showReferral && referrerCandidate && (
            <div
              className="auf-card relative p-5"
              style={{
                background: "var(--gold-50)",
                borderColor: "oklch(0.88 0.06 85)",
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <Sparkles size={14} className="gold-fg" />
                <span className="section-eyebrow gold-fg">
                  Referral opportunity
                </span>
              </div>
              <div className="flex items-center gap-3">
                <AUFAvatar
                  name={referrerCandidate.displayName ?? ""}
                  grad={gradFor(referrerCandidate.displayName ?? "x")}
                  badge
                  size={48}
                />
                <div className="leading-tight">
                  <div className="text-[14px] font-medium">
                    {referrerCandidate.displayName}
                  </div>
                  <div className="text-[12px] ink-3">
                    {referrerCandidate.currentRole ?? "Alum"}
                    {referrerCandidate.batch
                      ? ` · AUF '${String(referrerCandidate.batch).slice(-2)}`
                      : ""}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[13px] italic leading-[1.5] ink-2">
                &ldquo;I&rsquo;m happy to refer fellow AUF alums directly. Drop me a
                quick note before you apply through the portal.&rdquo;
              </p>
              <button
                onClick={() => toast.info("DMs coming soon")}
                className="auf-btn auf-btn-primary mt-3 w-full justify-center"
              >
                <Send size={13} /> Message{" "}
                {referrerCandidate.displayName?.split(" ")[0] ?? "alum"}
              </button>
              <div className="mt-2 text-center text-[11px] ink-3">
                Typically responds within 1 day
              </div>
            </div>
          )}

          <div className="auf-card p-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h4 className="font-serif text-[15px] font-semibold">
                {alumniHere} AUF alumni at {job.employerName}
              </h4>
              <Link
                href={`/directory?company=${encodeURIComponent(job.employerName)}`}
                className="shrink-0 text-[12px] brand-fg hover:underline"
              >
                See all →
              </Link>
            </div>
            {alumniAtCompany === undefined ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin ink-3" />
            ) : alumniHere === 0 ? (
              <p className="text-[13px] ink-3">
                No AUF alumni at this employer yet — be the first.
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  {companyAlumni.slice(0, 4).map((a, i) => (
                    <div
                      key={a.slug ?? `${a.displayName}-${i}`}
                      className="flex items-center gap-3"
                    >
                      <AUFAvatar
                        name={a.displayName ?? ""}
                        grad={gradFor(a.displayName ?? "x")}
                        badge={i === 0}
                        size={36}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium">
                          {a.displayName}
                        </div>
                        <div className="truncate text-[11.5px] ink-3">
                          {a.currentRole ?? "Alum"}
                          {a.batch
                            ? ` · AUF '${String(a.batch).slice(-2)}`
                            : ""}
                        </div>
                      </div>
                      <button className="auf-btn auf-btn-outline auf-btn-sm">
                        Connect
                      </button>
                    </div>
                  ))}
                </div>
                <div className="auf-hairline mt-4 border-t pt-4">
                  <div className="section-eyebrow mb-2">Cohort breakdown</div>
                  <div className="space-y-1.5">
                    <CohortBar
                      label="College of IT"
                      value={cohort.it}
                      total={alumniHere}
                    />
                    <CohortBar
                      label="College of Business"
                      value={cohort.business}
                      total={alumniHere}
                    />
                    <CohortBar
                      label="Engineering"
                      value={cohort.engineering}
                      total={alumniHere}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {similarJobs.length > 0 && (
            <div className="auf-card p-5">
              <div className="section-eyebrow mb-3">Similar from your network</div>
              <div className="space-y-3">
                {similarJobs.map((j) => {
                  const g = gradFor(j.employerName);
                  return (
                    <Link
                      key={j._id}
                      href={`/jobs/${j._id}`}
                      className="-mx-2 flex items-start gap-3 rounded-md p-2 text-left hover:bg-[var(--surface-2)]"
                    >
                      <div
                        className={`av-grad-${g} flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-serif text-[11px] font-semibold text-white`}
                      >
                        {companyInitials(j.employerName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">
                          {j.title}
                        </div>
                        <div className="truncate text-[11.5px] ink-3">
                          {j.employerName}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "brand";
}) {
  return (
    <div>
      <div
        className={`font-serif text-[22px] font-semibold ${tone === "brand" ? "brand-fg" : ""}`}
      >
        {value}
        {suffix && (
          <span className="text-[14px] font-normal ink-3">{suffix}</span>
        )}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider ink-3">
        {label}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-3 ${highlight ? "brand-50" : "bg-[var(--surface-2)]"}`}
    >
      <div
        className={`font-serif text-[18px] font-semibold ${highlight ? "brand-fg" : ""}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] ink-3">{label}</div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="mb-2 text-[13px] font-semibold uppercase tracking-wider ink">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex gap-2 text-[13.5px] leading-[1.5] ink-2"
          >
            <span className="mt-1.5 brand-fg">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CohortBar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11.5px]">
        <span className="ink-2">{label}</span>
        <span className="ink-3">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full brand-bg" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
