/**
 * Public openings board — where "Browse all openings" on the landing page goes.
 *
 * That CTA used to point at /jobs, which lives in the alumni shell behind auth,
 * so a signed-out visitor saw "0 jobs — No jobs published yet" while roles were
 * live. This page lists every published role to anyone; applying still requires
 * a verified alumni account, which is the whole funnel.
 *
 * Server component. Filter chips are plain Links so it stays one.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { ArrowRight, Briefcase, MapPin, Sparkles } from "lucide-react";
import { api } from "@/lib/convex-api";

export const metadata: Metadata = {
  title: "Open roles — AUF Alumni",
  description:
    "Every role employers are hiring for through the verified AUF alumni network. Browse openings by type and location, then join to apply.",
};

type Opening = {
  _id: string;
  title: string;
  employerName: string;
  employerSlug: string;
  employerTier: string;
  location: string;
  workMode: string | null;
  employmentType: string;
  experienceLevel: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  skills: string[];
  publishedAt: number;
};

type Search = Promise<{ type?: string | string[]; mode?: string | string[] }>;

const TYPE_CHIPS = [
  { value: "", label: "All roles" },
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const EXP_LABEL: Record<string, string> = {
  entry: "Entry level",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead / manager",
};

async function safeFetch<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
): string | null {
  if (min == null && max == null) return null;
  const symbol = currency === "PHP" || currency == null ? "₱" : `${currency} `;
  const fmt = (n: number) =>
    n >= 1000 ? `${symbol}${Math.round(n / 1000)}k` : `${symbol}${n}`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  return fmt((min ?? max) as number);
}

/** Work mode is optional on older postings; infer it from the location text. */
function modeOf(job: Opening): string {
  if (job.workMode) return job.workMode.toLowerCase();
  const l = job.location.toLowerCase();
  if (l.includes("remote")) return "remote";
  if (l.includes("hybrid")) return "hybrid";
  return "onsite";
}

function sinceLabel(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 30) return `Posted ${days} days ago`;
  const months = Math.round(days / 30);
  return `Posted ${months} month${months === 1 ? "" : "s"} ago`;
}

export default async function CareersPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { type: rawType, mode: rawMode } = await searchParams;
  const type = one(rawType);
  const mode = one(rawMode);

  const all = await safeFetch<Opening[]>(
    fetchQuery(api.jobs.publicOpenings) as Promise<Opening[]>,
    [],
  );

  const jobs = all.filter((j) => {
    if (type && j.employmentType !== type) return false;
    if (mode && modeOf(j) !== mode) return false;
    return true;
  });

  const employers = new Set(all.map((j) => j.employerSlug)).size;
  const href = (next: { type?: string; mode?: string }) => {
    const q = new URLSearchParams();
    const t = next.type ?? type;
    const m = next.mode ?? mode;
    if (t) q.set("type", t);
    if (m) q.set("mode", m);
    const s = q.toString();
    return s ? `/careers?${s}` : "/careers";
  };

  return (
    <div>
      <section className="border-b auf-hairline">
        <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-7 sm:py-16">
          <div className="section-eyebrow brand-fg">Careers</div>
          <h1 className="mt-2 max-w-[760px] font-serif text-[30px] font-semibold leading-tight md:text-[42px]">
            Roles hiring from the AUF alumni network
          </h1>
          <p className="mt-3 max-w-[620px] text-[15px] ink-2">
            {all.length === 0
              ? "No roles are open right now — new postings appear here as soon as the school approves them."
              : `${all.length} open ${all.length === 1 ? "role" : "roles"} from ${employers} ${
                  employers === 1 ? "employer" : "employers"
                }. Every posting is reviewed by AUF before it goes live. Browsing is open to everyone; applying takes a verified alumni account.`}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/signup" className="auf-btn auf-btn-primary">
              Join to apply <ArrowRight size={14} />
            </Link>
            <Link href="/companies" className="auf-btn auf-btn-outline">
              Browse hiring partners
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-7 sm:py-10">
        {all.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-1.5">
            {TYPE_CHIPS.map((c) => (
              <Link
                key={c.value || "all"}
                href={href({ type: c.value })}
                className={
                  (c.value === type ? "auf-chip auf-chip-brand" : "auf-chip") +
                  " text-[12px]"
                }
              >
                {c.label}
              </Link>
            ))}
            <span className="mx-1 h-4 w-px bg-[var(--border-soft)]" aria-hidden />
            {[
              { value: "", label: "Anywhere" },
              { value: "remote", label: "Remote" },
              { value: "hybrid", label: "Hybrid" },
              { value: "onsite", label: "Onsite" },
            ].map((c) => (
              <Link
                key={c.value || "any"}
                href={href({ mode: c.value })}
                className={
                  (c.value === mode ? "auf-chip auf-chip-brand" : "auf-chip") +
                  " text-[12px]"
                }
              >
                {c.label}
              </Link>
            ))}
            {(type || mode) && (
              <Link
                href="/careers"
                className="ml-1 text-[12px] ink-3 underline-offset-2 hover:underline"
              >
                Clear
              </Link>
            )}
          </div>
        )}

        {jobs.length === 0 ? (
          <div className="auf-card p-10 text-center">
            <div className="mb-2 font-serif text-[20px] font-semibold">
              {all.length === 0
                ? "No openings published yet"
                : "No roles match these filters"}
            </div>
            <p className="mb-5 text-[14px] ink-2">
              {all.length === 0
                ? "Employers post through the school, and every listing is reviewed before it appears. Check back soon."
                : "Try a different role type or location."}
            </p>
            <Link
              href={all.length === 0 ? "/for-employers" : "/careers"}
              className="auf-btn auf-btn-outline"
            >
              {all.length === 0 ? "Hiring? Post a role" : "Show every role"}
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-3 text-[13px] ink-3">
              Showing {jobs.length} of {all.length} open{" "}
              {all.length === 1 ? "role" : "roles"}
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {jobs.map((j) => {
                const salary = formatSalary(j.salaryMin, j.salaryMax, j.salaryCurrency);
                return (
                  <li key={j._id}>
                    <Link
                      href={`/companies/${j.employerSlug}`}
                      className="auf-card flex h-full flex-col p-5 transition-colors hover:border-[var(--brand)]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[13px] font-bold">
                          {initials(j.employerName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-[15px] font-semibold leading-snug">
                            {j.title}
                          </h2>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] ink-3">
                            {j.employerName}
                            {j.employerTier === "partner" && (
                              <span className="auf-chip auf-chip-brand text-[10px]">
                                <Sparkles size={9} /> Partner
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
                        <span className="auf-chip">
                          <MapPin size={10} /> {j.location}
                        </span>
                        <span className="auf-chip">
                          <Briefcase size={10} /> {j.employmentType}
                        </span>
                        {j.experienceLevel && (
                          <span className="auf-chip">
                            {EXP_LABEL[j.experienceLevel] ?? j.experienceLevel}
                          </span>
                        )}
                        {salary && (
                          <span className="auf-chip font-medium brand-fg">{salary}</span>
                        )}
                      </div>

                      {j.skills.length > 0 && (
                        <div className="mt-3">
                          <div className="section-eyebrow mb-1.5">Needs</div>
                          <div className="flex flex-wrap gap-1">
                            {j.skills.slice(0, 5).map((s) => (
                              <span
                                key={s}
                                className="rounded-full border border-[var(--border-soft)] px-2 py-0.5 text-[10.5px] ink-2"
                              >
                                {s}
                              </span>
                            ))}
                            {j.skills.length > 5 && (
                              <span className="text-[10.5px] ink-3">
                                +{j.skills.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[11.5px] ink-3">
                        <span>{sinceLabel(j.publishedAt)}</span>
                        <span className="inline-flex items-center gap-1 brand-fg">
                          View employer <ArrowRight size={11} />
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="auf-card mt-8 flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <div className="font-serif text-[18px] font-semibold">
                  Applying takes a verified account
                </div>
                <p className="mt-1 max-w-[520px] text-[13.5px] ink-2">
                  AUF verifies every alumnus before they can apply, so employers
                  know exactly who they are hearing from.
                </p>
              </div>
              <Link href="/signup" className="auf-btn auf-btn-primary shrink-0">
                Verify and apply <ArrowRight size={14} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
