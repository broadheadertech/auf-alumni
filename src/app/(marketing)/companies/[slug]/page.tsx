/**
 * Public company landing page (Epic 12).
 *
 * Server-rendered. Pulls the employer org via slug, then surfaces:
 *   • brand band (logo / name / tier / hqCity / alumni count)
 *   • action row (follow-coming-soon, website, post-a-job upsell)
 *   • "open to hire" banner if any alumna at this org is open-to-hire
 *   • open jobs list (left column)
 *   • "AUF alumni here" rail (right column)
 *
 * All public-tier data only. Loose company-name join lives in
 * convex/companies.ts::getBySlug.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { Briefcase, ExternalLink, MapPin, Sparkles, Users } from "lucide-react";
import { AUFAvatar } from "@/components/auf/AUFAvatar";
import { api } from "@/lib/convex-api";

type Params = Promise<{ slug: string }>;

type Company = {
  _id: string;
  slug: string;
  name: string;
  tier: string;
  websiteUrl: string | null;
  hqCity: string | null;
  planTier: string;
  jobPostsUsed: number;
  logoUrl: string | null;
  isOpenToHire: boolean;
  openToHireNote: string | null;
  jobs: Array<{
    _id: string;
    title: string;
    location: string;
    employmentType: string;
    salaryMin?: number;
    salaryMax?: number;
    salaryCurrency?: string;
    publishedAt: number | null;
  }>;
  alumniHere: Array<{
    slug: string;
    displayName: string;
    currentRole: string | null;
    batch: number;
    program: string;
  }>;
  alumniCount: number;
  followerCount: number;
};

async function loadCompany(slug: string): Promise<Company | null> {
  try {
    const result = await fetchQuery(api.companies.getBySlug, { slug });
    return (result ?? null) as Company | null;
  } catch {
    return null;
  }
}

function firstLetter(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}

function gradFor(name: string): 1 | 2 | 3 | 4 | 5 | 6 {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ((h % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}

function tierChipClass(tier: string): string {
  if (tier === "partner") return "auf-chip auf-chip-gold";
  if (tier === "verified") return "auf-chip auf-chip-brand";
  return "auf-chip";
}

function tierLabel(tier: string): string {
  if (tier === "partner") return "Partner";
  if (tier === "verified") return "Verified employer";
  return "Unverified";
}

function formatSalary(
  min?: number,
  max?: number,
  ccy?: string,
): string | null {
  if (!min && !max) return null;
  const c = ccy ?? "PHP";
  if (min && max) return `${c} ${min.toLocaleString()}–${max.toLocaleString()}`;
  return `${c} ${(min ?? max)!.toLocaleString()}+`;
}

function formatEmploymentType(t: string): string {
  if (t === "full-time") return "Full-time";
  if (t === "part-time") return "Part-time";
  if (t === "contract") return "Contract";
  if (t === "internship") return "Internship";
  return t;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await loadCompany(slug);
  if (!company) return { title: "Company not found — AUF Alumni" };
  const description = company.hqCity
    ? `${company.name} (${company.hqCity}) on the AUF Alumni Network — open jobs and alumni working here.`
    : `${company.name} on the AUF Alumni Network — a ${tierLabel(company.tier).toLowerCase()} hiring AUF graduates.`;
  return {
    title: `${company.name} on AUF Alumni`,
    description,
  };
}

export default async function CompanyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const company = await loadCompany(slug);

  if (!company) {
    return (
      <div className="max-w-[640px] mx-auto px-4 sm:px-7 py-20">
        <div className="auf-card p-8 text-center">
          <div className="font-serif text-[22px] font-semibold">
            Company not found
          </div>
          <p className="ink-2 text-[14px] mt-2 leading-[1.55]">
            We couldn&apos;t find an employer with that link. The company may
            have been removed or never existed.
          </p>
          <Link
            href="/companies"
            className="auf-btn auf-btn-outline auf-btn-sm mt-5 inline-flex"
          >
            Browse all hiring partners
          </Link>
        </div>
      </div>
    );
  }

  const showJobs = company.jobs.length > 0;
  const grad = gradFor(company.name);

  return (
    <div>
      {/* Brand hero band */}
      <section
        className="relative"
        style={{ background: "var(--brand-deep)", color: "white" }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.18]"
          style={{
            background:
              "radial-gradient(circle at 12% 0%, var(--brand) 0%, transparent 55%), radial-gradient(circle at 90% 110%, var(--gold) 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-[1240px] mx-auto px-4 sm:px-7 py-10 sm:py-14 min-h-[200px] sm:min-h-[240px] flex items-center">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 w-full">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl}
                alt=""
                width={84}
                height={84}
                className="w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] rounded-xl object-cover bg-white"
              />
            ) : (
              <span
                className={`av-grad-${grad} w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] rounded-xl text-white font-semibold flex items-center justify-center text-[34px] sm:text-[40px] shadow-md`}
              >
                {firstLetter(company.name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={tierChipClass(company.tier)}>
                  {tierLabel(company.tier)}
                </span>
                {company.hqCity && (
                  <span
                    className="text-[12.5px] inline-flex items-center gap-1"
                    style={{ color: "rgba(255,255,255,0.75)" }}
                  >
                    <MapPin size={12} /> {company.hqCity}
                  </span>
                )}
              </div>
              <h1 className="font-serif text-[34px] sm:text-[44px] leading-tight font-semibold">
                {company.name}
              </h1>
              <div
                className="flex flex-wrap items-center gap-4 mt-3 text-[13px]"
                style={{ color: "rgba(255,255,255,0.78)" }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Users size={13} />
                  {company.alumniCount}{" "}
                  {company.alumniCount === 1
                    ? "AUF alum here"
                    : "AUF alumni here"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase size={13} />
                  {company.jobs.length}{" "}
                  {company.jobs.length === 1 ? "open role" : "open roles"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Action row */}
      <section className="border-b auf-hairline">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-7 py-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            title="Company follows coming soon"
            className="auf-btn auf-btn-outline auf-btn-sm cursor-not-allowed opacity-70"
          >
            Following coming soon
          </button>
          {company.websiteUrl && (
            <a
              href={company.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="auf-btn auf-btn-ghost auf-btn-sm"
            >
              Visit website <ExternalLink size={13} />
            </a>
          )}
          {!showJobs && (
            <Link
              href="/for-employers"
              className="auf-btn auf-btn-primary auf-btn-sm ml-auto"
            >
              Hiring? Post a job
            </Link>
          )}
        </div>
      </section>

      <div className="max-w-[1240px] mx-auto px-4 sm:px-7 py-8 sm:py-10">
        {/* Open-to-hire banner */}
        {company.isOpenToHire && (
          <div className="auf-chip auf-chip-gold mb-6 w-full !rounded-xl !py-3 !px-4 flex-col items-start gap-1">
            <div className="inline-flex items-center gap-2 font-semibold text-[13.5px]">
              <Sparkles size={14} /> {company.name} is actively hiring.
            </div>
            {company.openToHireNote && (
              <div className="text-[12.5px] opacity-90">
                {company.openToHireNote}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-12 gap-6 sm:gap-8">
          {/* Main column */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <section>
              <h2 className="font-serif text-[22px] font-semibold mb-4">
                Open jobs
              </h2>
              {showJobs ? (
                <ul className="space-y-3">
                  {company.jobs.map((j) => {
                    const salary = formatSalary(
                      j.salaryMin,
                      j.salaryMax,
                      j.salaryCurrency,
                    );
                    return (
                      <li key={j._id}>
                        <Link
                          href={`/jobs/${j._id}`}
                          className="auf-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-[var(--brand)] transition"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-serif text-[17px] font-semibold leading-snug">
                              {j.title}
                            </div>
                            <div className="ink-3 text-[12.5px] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} />
                                {j.location}
                              </span>
                              <span>{formatEmploymentType(j.employmentType)}</span>
                              {salary && <span>{salary}</span>}
                            </div>
                          </div>
                          <span className="auf-chip auf-chip-brand self-start sm:self-auto">
                            View role
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="auf-card p-6 text-center">
                  <div className="ink-2 text-[14px]">
                    No open roles right now.
                  </div>
                  <p className="ink-3 text-[12.5px] mt-1">
                    Follow {company.name} to know when something opens up.
                  </p>
                </div>
              )}
            </section>

            <section className="auf-card p-5 sm:p-6">
              <h2 className="font-serif text-[20px] font-semibold mb-3">
                About this company
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-[13px] ink-2">
                {company.hqCity && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} />
                    {company.hqCity}
                  </span>
                )}
                {company.websiteUrl && (
                  <a
                    href={company.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="brand-fg hover:underline inline-flex items-center gap-1"
                  >
                    {company.websiteUrl.replace(/^https?:\/\//, "")}
                    <ExternalLink size={11} />
                  </a>
                )}
                {company.planTier && company.planTier !== "free" && (
                  <span className="auf-chip">{company.planTier}</span>
                )}
              </div>
              <p className="ink-3 text-[13px] mt-4 leading-[1.55]">
                Company description coming soon.
              </p>
            </section>
          </div>

          {/* Right rail */}
          <aside className="col-span-12 lg:col-span-4">
            <div className="auf-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-[18px] font-semibold">
                  AUF alumni here
                </h2>
                {company.alumniCount > 0 && (
                  <span className="ink-3 text-[12px]">
                    {company.alumniCount}
                  </span>
                )}
              </div>
              {company.alumniHere.length === 0 ? (
                <p className="ink-3 text-[13px] leading-[1.55]">
                  No verified alumni list this company yet. Be the first —{" "}
                  <Link
                    href="/signup"
                    className="brand-fg hover:underline"
                  >
                    join the network
                  </Link>
                  .
                </p>
              ) : (
                <ul className="space-y-3">
                  {company.alumniHere.map((a, i) => (
                    <li key={a.slug}>
                      <Link
                        href={`/u/${a.slug}`}
                        className="flex items-start gap-3 group"
                      >
                        <AUFAvatar
                          name={a.displayName}
                          size={36}
                          grad={((i % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-medium truncate group-hover:brand-fg transition">
                            {a.displayName}
                          </div>
                          {a.currentRole && (
                            <div className="ink-3 text-[12px] truncate">
                              {a.currentRole}
                            </div>
                          )}
                          <div className="ink-3 text-[11.5px] mt-0.5">
                            {a.program} &apos;
                            {String(a.batch).slice(-2)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {company.alumniCount > company.alumniHere.length && (
                <Link
                  href={`/directory?company=${encodeURIComponent(company.name)}`}
                  className="brand-fg text-[13px] mt-4 inline-block hover:underline"
                >
                  See all {company.alumniCount} →
                </Link>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
