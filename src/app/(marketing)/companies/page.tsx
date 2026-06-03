/**
 * Public hiring-partners directory.
 *
 * Server-rendered list of every verified / partner employer. Click-through
 * leads to `/companies/[slug]` (the dedicated company landing page). Filter
 * chips swap the URL between All / Partner / Verified — implemented as plain
 * Links so the page stays a server component.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { MapPin } from "lucide-react";
import { api } from "@/lib/convex-api";

export const metadata: Metadata = {
  title: "Hiring partners — AUF Alumni",
  description:
    "Companies that hire from the verified AUF alumni network — partners, employers and the open roles they're filling now.",
};

type CompanyRow = {
  slug: string;
  name: string;
  tier: string;
  hqCity: string | null;
  logoUrl: string | null;
  jobsCount: number;
  alumniCount: number;
};

type Search = Promise<{ tier?: string | string[] }>;

async function safeFetch<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
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
  if (tier === "verified") return "Verified";
  return "Unverified";
}

export default async function CompaniesIndexPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const sp = await searchParams;
  const tierParam = Array.isArray(sp.tier) ? sp.tier[0] : sp.tier;
  const activeTier =
    tierParam === "partner" || tierParam === "verified" ? tierParam : null;

  const rows = await safeFetch(
    fetchQuery(api.companies.list, activeTier ? { tier: activeTier } : {}),
    [] as CompanyRow[],
  );

  const filters: Array<{ label: string; href: string; active: boolean }> = [
    { label: "All", href: "/companies", active: !activeTier },
    {
      label: "Partner",
      href: "/companies?tier=partner",
      active: activeTier === "partner",
    },
    {
      label: "Verified",
      href: "/companies?tier=verified",
      active: activeTier === "verified",
    },
  ];

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <div className="section-eyebrow brand-fg mb-3">Hiring partners</div>
      <h1 className="font-serif text-[36px] sm:text-[44px] leading-tight font-semibold">
        Companies hiring AUF alumni.
      </h1>
      <p className="ink-2 text-[15px] mt-3 max-w-[60ch] leading-[1.6]">
        Verified and partner employers with a real connection to the AUF
        community — the people who post jobs here also work and refer here.
      </p>

      <div className="flex flex-wrap items-center gap-2 mt-7">
        {filters.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={
              f.active
                ? "auf-chip auf-chip-brand"
                : "auf-chip hover:bg-[var(--surface-2)]"
            }
          >
            {f.label}
          </Link>
        ))}
        <span className="ink-3 text-[12px] ml-auto">
          {rows.length} {rows.length === 1 ? "company" : "companies"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="auf-card mt-8 p-10 text-center">
          <div className="font-serif text-[18px] font-semibold">
            No companies yet
          </div>
          <p className="ink-2 text-[13.5px] mt-2 leading-[1.55] max-w-[40ch] mx-auto">
            Once employers join the network they&apos;ll show up here. Are you
            hiring?{" "}
            <Link href="/for-employers" className="brand-fg hover:underline">
              Get verified
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 mt-8 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Link
              key={c.slug}
              href={`/companies/${c.slug}`}
              className="auf-card p-5 flex flex-col gap-3 hover:border-[var(--brand)] transition"
            >
              <div className="flex items-start gap-3">
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logoUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover bg-[var(--surface-2)]"
                  />
                ) : (
                  <span
                    className={`av-grad-${gradFor(c.name)} w-12 h-12 rounded-lg text-white font-semibold flex items-center justify-center text-[20px]`}
                  >
                    {firstLetter(c.name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-[17px] font-semibold leading-snug truncate">
                    {c.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={tierChipClass(c.tier)}>
                      {tierLabel(c.tier)}
                    </span>
                    {c.hqCity && (
                      <span className="ink-3 text-[12px] inline-flex items-center gap-1 truncate">
                        <MapPin size={11} />
                        {c.hqCity}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="ink-3 text-[12.5px] mt-auto pt-2 border-t auf-hairline">
                {c.jobsCount} {c.jobsCount === 1 ? "job" : "jobs"} ·{" "}
                {c.alumniCount}{" "}
                {c.alumniCount === 1 ? "alum here" : "alumni here"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
