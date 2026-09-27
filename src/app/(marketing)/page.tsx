/**
 * Marketing landing (ported from Claude Design prototype).
 * Hero → StatsStrip → HowItWorks → FeaturedJobs → MentorSpotlight →
 * Testimonial → FinalCTA. AUF royal-blue + gold throughout.
 *
 * Server component — hydrates StatsStrip / FeaturedJobs / MentorSpotlight
 * from Convex via `fetchQuery`. Public, unauthenticated queries only.
 *
 * Section copy is admin-editable (Admin → Content management → Main page) and
 * read from convex/siteContent.ts; the registry defaults are the fallback.
 */

import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  Bookmark,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { fetchQuery } from "convex/nextjs";
import { AUFAvatar } from "@/components/auf/AUFAvatar";
import { api } from "@/lib/convex-api";
import { PAGES, defaultsFor } from "../../../convex/helpers/siteContentPages";

export const metadata = {
  title: "AUF Alumni Network — where AUF alumni hire AUF alumni",
  description:
    "The official career and mentorship network for Angeles University Foundation alumni. Verified by the registrar, trusted by 1,400+ employers.",
};

type Grad = 1 | 2 | 3 | 4 | 5 | 6;

type PublicStats = {
  verifiedAlumni: number;
  openJobs: number;
  countries: number;
  introsPct: number;
};

type PublicJob = {
  _id: string;
  title: string;
  employerName: string;
  employerSlug: string;
  location: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
};

type PublicMentor = {
  _id: string;
  displayName: string;
  slug: string;
  program?: string;
  batch?: number;
  currentRole?: string;
  company?: string;
};

type Copy = Record<string, string>;

const DEFAULT_COPY: Copy = defaultsFor(PAGES.home);

/** Render text with admin-entered line breaks preserved. */
function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </>
  );
}

const EMPTY_STATS: PublicStats = {
  verifiedAlumni: 0,
  openJobs: 0,
  countries: 0,
  introsPct: 0,
};

async function safeFetch<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const [copy, stats, jobs, mentors] = await Promise.all([
    safeFetch(
      fetchQuery(api.siteContent.get, { key: "home" }) as Promise<Copy>,
      DEFAULT_COPY,
    ),
    safeFetch(fetchQuery(api.analytics.publicStats, {}), EMPTY_STATS),
    safeFetch(fetchQuery(api.jobs.publicFeatured, {}), [] as PublicJob[]),
    safeFetch(
      fetchQuery(api.directory.publicMentors, {}),
      [] as PublicMentor[],
    ),
  ]);

  const c: Copy = { ...DEFAULT_COPY, ...copy };

  return (
    <div>
      <Hero copy={c} />
      <StatsStrip stats={stats} />
      <HowItWorks copy={c} />
      <FeaturedJobs jobs={jobs} copy={c} />
      <MentorSpotlight mentors={mentors} copy={c} />
      <Testimonial copy={c} />
      <FinalCTA copy={c} />
    </div>
  );
}

function Hero({ copy }: { copy: Copy }) {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          background:
            "radial-gradient(circle at 15% 0%, var(--brand) 0%, transparent 45%), radial-gradient(circle at 90% 110%, var(--gold) 0%, transparent 40%)",
        }}
      />
      <div className="max-w-[1240px] mx-auto px-4 sm:px-7 pt-12 pb-16 sm:pt-20 sm:pb-24 grid grid-cols-12 gap-10 relative">
        <div className="col-span-12 lg:col-span-7">
          <div className="auf-chip auf-chip-brand mb-5">
            <span className="live-dot" /> {copy.heroBadge}
          </div>
          <h1 className="font-serif text-[44px] sm:text-[56px] lg:text-[64px] leading-[1.05] font-semibold tracking-tight">
            {copy.heroTitleLead}{" "}
            <span className="italic" style={{ color: "var(--brand)" }}>
              {copy.heroTitleAccent}
            </span>
            <br />
            {copy.heroTitleMiddle}{" "}
            <span
              style={{
                background:
                  "linear-gradient(0deg, var(--gold-50) 35%, transparent 35%)",
                paddingInline: 4,
              }}
            >
              {copy.heroTitleHighlight}
            </span>
          </h1>
          <p className="text-[16px] sm:text-[18px] ink-2 leading-[1.55] mt-6 max-w-[52ch]">
            {copy.heroSubtitle}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link
              href="/signup"
              className="auf-btn auf-btn-primary !px-5 !py-3 !text-[15px]"
            >
              {copy.heroPrimaryCta} <ArrowRight size={15} />
            </Link>
            <Link
              href="/for-employers"
              className="auf-btn auf-btn-outline !px-5 !py-3 !text-[15px]"
            >
              <Building2 size={15} /> {copy.heroSecondaryCta}
            </Link>
            <Link
              href="/login"
              className="auf-btn auf-btn-ghost !px-3 !py-3 !text-[14px] underline-offset-4 hover:underline"
            >
              I already have an account →
            </Link>
          </div>
          <div className="flex items-center gap-4 mt-10 text-[12.5px] ink-3">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5, 6].map((g) => (
                <div
                  key={g}
                  className={`w-8 h-8 rounded-full av-grad-${g} ring-2 ring-white text-white text-[11px] font-semibold flex items-center justify-center`}
                >
                  {String.fromCharCode(64 + g)}
                </div>
              ))}
            </div>
            <span>
              <span className="font-semibold ink-2">{copy.heroSocialProofNumber}</span>{" "}
              {copy.heroSocialProofText}
            </span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 relative">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative h-[480px] hidden lg:block">
      <div
        className="absolute right-0 top-0 w-[400px] auf-card p-5 shadow-xl"
        style={{ transform: "rotate(2deg)" }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-lg av-grad-3 text-white font-serif font-semibold flex items-center justify-center">
            K
          </div>
          <div className="flex-1">
            <div className="text-[12px] ink-3">Kumu · Verified employer ✓</div>
            <div className="font-medium text-[15px]">Frontend Engineer</div>
          </div>
          <Bookmark size={16} className="ink-3" />
        </div>
        <div className="text-[12.5px] ink-3 mb-2">
          Taguig, NCR · Hybrid · ₱70K – ₱95K
        </div>
        <div className="brand-50 rounded-lg p-3 flex items-center gap-3 mt-3">
          <div className="flex -space-x-1.5">
            {([2, 4, 5, 6] as const).map((g) => (
              <div
                key={g}
                className={`w-7 h-7 rounded-full av-grad-${g} ring-2 ring-[var(--brand-50)] text-white text-[10px] font-semibold flex items-center justify-center`}
              >
                A
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium" style={{ color: "var(--brand-ink)" }}>
              4 AUF alumni work here
            </div>
            <div className="text-[11px] ink-2">Anjelica P. is open to referring</div>
          </div>
        </div>
      </div>

      <div
        className="absolute left-0 top-[180px] w-[280px] auf-card p-4 shadow-xl"
        style={{ transform: "rotate(-3deg)" }}
      >
        <div className="flex items-center gap-3">
          <AUFAvatar name="Anjelica Pineda" grad={2} size={48} />
          <div className="leading-tight flex-1">
            <div className="font-medium text-[14px]">Anjelica Pineda</div>
            <div className="text-[11.5px] ink-3">BS IT &apos;21 · Sr. Frontend Eng.</div>
          </div>
          <span className="auf-chip auf-chip-verified !text-[9px] !px-1">
            <ShieldCheck size={10} />
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          <span className="auf-chip auf-chip-gold !text-[10px]">Open to refer</span>
          <span className="auf-chip !text-[10px]">Mentor</span>
        </div>
      </div>

      <div
        className="absolute right-[40px] bottom-[10px] w-[300px] auf-card p-4 shadow-xl"
        style={{ transform: "rotate(-1.5deg)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="gold-fg" />
          <div className="text-[11px] font-semibold uppercase tracking-wider gold-fg">
            Referral request
          </div>
          <div className="ml-auto text-[10px] ink-3">2 min ago</div>
        </div>
        <div className="text-[13px] ink-2 leading-[1.5]">
          &ldquo;Hi Anjelica! Saw your post about the Kumu frontend role — would
          love to chat about it. I&apos;m BS IT &apos;23, currently at HealthLink…&rdquo;
        </div>
        <div className="mt-3 flex gap-2 pt-2 border-t auf-hairline">
          <button className="auf-btn auf-btn-primary auf-btn-sm flex-1 justify-center">
            Refer Lara
          </button>
          <button className="auf-btn auf-btn-outline auf-btn-sm">Reply</button>
        </div>
      </div>
    </div>
  );
}

function StatsStrip({ stats }: { stats: PublicStats }) {
  const fmt = (n: number) => (n > 0 ? n.toLocaleString() : "—");
  const pct = (n: number) => (n > 0 ? `${n}%` : "—");
  const rows: Array<[string, string]> = [
    [fmt(stats.verifiedAlumni), "Verified alumni"],
    [fmt(stats.openJobs), "Jobs published"],
    [stats.countries > 0 ? String(stats.countries) : "—", "Countries"],
    [pct(stats.introsPct), "Jobs with insider intro"],
  ];
  return (
    <section className="border-y auf-hairline" style={{ background: "var(--surface)" }}>
      <div className="max-w-[1240px] mx-auto px-4 sm:px-7 py-8 sm:py-10 grid grid-cols-2 md:grid-cols-4">
        {rows.map(([v, l], i) => (
          <div key={l} className={`text-center ${i > 0 ? "md:border-l auf-hairline" : ""}`}>
            <div className="font-serif text-[32px] md:text-[40px] font-semibold leading-none">
              {v}
            </div>
            <div className="text-[12px] uppercase tracking-wider ink-3 mt-2">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks({ copy }: { copy: Copy }) {
  const steps = [
    {
      n: "01",
      t: copy.howStep1Title,
      d: copy.howStep1Body,
      Icon: ShieldCheck,
    },
    {
      n: "02",
      t: copy.howStep2Title,
      d: copy.howStep2Body,
      Icon: Users,
    },
    {
      n: "03",
      t: copy.howStep3Title,
      d: copy.howStep3Body,
      Icon: Briefcase,
    },
  ];
  return (
    <section className="max-w-[1240px] mx-auto px-4 sm:px-7 py-12 sm:py-20">
      <div className="text-center mb-12">
        <div className="section-eyebrow brand-fg">{copy.howEyebrow}</div>
        <h2 className="font-serif text-[32px] md:text-[40px] font-semibold mt-3 leading-tight">
          <Lines text={copy.howTitle} />
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="auf-card p-7 relative">
            <div className="font-serif text-[14px] font-semibold gold-fg">{s.n}</div>
            <div className="w-11 h-11 rounded-xl brand-50 brand-fg flex items-center justify-center mt-4 mb-5">
              <s.Icon size={22} />
            </div>
            <h3 className="font-serif text-[22px] font-semibold leading-tight">{s.t}</h3>
            <p className="text-[14.5px] ink-2 mt-2 leading-[1.55]">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatPay(job: PublicJob): string | null {
  const { salaryMin, salaryMax, salaryCurrency } = job;
  if (salaryMin == null && salaryMax == null) return null;
  const cur = salaryCurrency ?? "PHP";
  const sym = cur === "PHP" ? "₱" : `${cur} `;
  const fmt = (n: number) =>
    n >= 1000 ? `${sym}${(n / 1000).toFixed(0)}K` : `${sym}${n}`;
  if (salaryMin != null && salaryMax != null) {
    return `${fmt(salaryMin)} – ${fmt(salaryMax)}`;
  }
  return fmt((salaryMin ?? salaryMax) as number);
}

function FeaturedJobs({ jobs, copy }: { jobs: PublicJob[]; copy: Copy }) {
  return (
    <section className="border-y auf-hairline" style={{ background: "var(--surface-2)" }}>
      <div className="max-w-[1240px] mx-auto px-4 sm:px-7 py-12 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="section-eyebrow brand-fg">{copy.jobsEyebrow}</div>
            <h2 className="font-serif text-[28px] md:text-[36px] font-semibold mt-2 leading-tight">
              <Lines text={copy.jobsTitle} />
            </h2>
          </div>
          <Link href="/careers" className="auf-btn auf-btn-outline">
            Browse all openings <ArrowRight size={14} />
          </Link>
        </div>
        {jobs.length === 0 ? (
          <div className="auf-card p-10 text-center">
            <div className="font-serif text-[20px] font-semibold mb-2">
              No jobs published yet.
            </div>
            <p className="text-[14px] ink-2 mb-5">
              Be the first employer to reach AUF alumni.
            </p>
            <Link href="/for-employers" className="auf-btn auf-btn-primary inline-flex">
              Post a job →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {jobs.map((j, i) => {
              const grad = (((i % 6) + 1) as Grad);
              const short = (j.employerName.trim().charAt(0) || "?").toUpperCase();
              const pay = formatPay(j);
              return (
                <Link
                  key={j._id}
                  href="/login"
                  className="auf-card p-5 hover:shadow-md transition text-left block"
                  style={{ borderColor: "var(--border-soft)" }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`w-11 h-11 rounded-lg av-grad-${grad} text-white font-serif font-semibold flex items-center justify-center`}
                    >
                      {short}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] ink-3">{j.employerName}</div>
                      <div className="font-medium text-[15px]">{j.title}</div>
                    </div>
                  </div>
                  <div className="text-[12.5px] ink-3 mb-3">
                    {j.location}
                    {pay ? ` · ${pay}` : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="auf-chip auf-chip-brand text-[10px]!">
                      {j.employerSlug || "partner"}
                    </span>
                    <span className="text-[11.5px] ink-3">Posted recently</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function batchSuffix(batch?: number): string {
  if (batch == null) return "";
  const yy = String(batch).slice(-2);
  return `'${yy}`;
}

function MentorSpotlight({
  mentors,
  copy,
}: {
  mentors: PublicMentor[];
  copy: Copy;
}) {
  return (
    <section className="max-w-[1240px] mx-auto px-4 sm:px-7 py-12 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-12 items-center">
        <div className="lg:col-span-5">
          <div className="section-eyebrow brand-fg">{copy.mentorsEyebrow}</div>
          <h2 className="font-serif text-[28px] md:text-[36px] font-semibold mt-2 leading-tight">
            {copy.mentorsTitle}
          </h2>
          <p className="text-[15px] ink-2 mt-4 leading-[1.6]">
            {copy.mentorsBody}
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-[13.5px]">
            {copy.mentorsBullets
              .split("\n")
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p) => (
              <div key={p} className="flex items-center gap-2">
                <Check size={14} className="brand-fg" /> {p}
              </div>
            ))}
          </div>
          <Link href="/signup" className="auf-btn auf-btn-primary mt-8 inline-flex">
            Browse mentors →
          </Link>
        </div>

        <div className="lg:col-span-7">
          {mentors.length === 0 ? (
            <div className="auf-card p-8 text-center">
              <div className="font-serif text-[18px] font-semibold mb-2">
                No mentors listed yet.
              </div>
              <p className="text-[13.5px] ink-2 mb-4">
                Verified alumni can opt-in to mentor from their profile.
              </p>
              <Link href="/signup" className="auf-btn auf-btn-outline inline-flex">
                Join and opt in →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mentors.map((a, i) => {
                const grad = (((i % 6) + 1) as Grad);
                return (
                  <div key={a._id} className={`auf-card p-5 ${i % 2 === 1 ? "sm:mt-6" : ""}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <AUFAvatar name={a.displayName} grad={grad} badge size={42} />
                      <div className="leading-tight">
                        <div className="font-medium text-[14px]">{a.displayName}</div>
                        <div className="text-[11.5px] ink-3">
                          {batchSuffix(a.batch)}
                          {a.batch != null && a.program ? " · " : ""}
                          {a.program ?? ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-[12.5px] ink-2 font-medium">
                      {a.currentRole ?? "Open to mentor"}
                    </div>
                    <div className="text-[11.5px] ink-3 mb-3">{a.company ?? ""}</div>
                    <div className="pt-3 border-t auf-hairline flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[12px] ink-3">
                        <Star size={12} className="gold-fg" /> 4.9 · 124 sessions
                      </div>
                      <Link
                        href={`/u/${a.slug}`}
                        className="text-[12px] brand-fg font-medium"
                      >
                        Book →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Testimonial({ copy }: { copy: Copy }) {
  return (
    <section className="py-20" style={{ background: "var(--brand-deep)", color: "white" }}>
      <div className="max-w-[1000px] mx-auto px-4 sm:px-7 text-center">
        <div className="text-[80px] font-serif leading-none" style={{ color: "var(--gold)" }}>
          &ldquo;
        </div>
        <blockquote className="font-serif text-[22px] md:text-[28px] leading-[1.35] font-medium -mt-6">
          {copy.testimonialQuote}
        </blockquote>
        <div className="flex items-center justify-center gap-3 mt-8">
          <AUFAvatar name={copy.testimonialName} grad={4} size={48} />
          <div className="text-left">
            <div className="font-medium">{copy.testimonialName}</div>
            <div className="text-[12.5px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              {copy.testimonialRole}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ copy }: { copy: Copy }) {
  return (
    <section className="max-w-[1240px] mx-auto px-4 sm:px-7 py-12 sm:py-24">
      <div className="auf-card p-6 sm:p-12 relative overflow-hidden text-center">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, var(--brand) 0%, transparent 60%), radial-gradient(circle at 50% 100%, var(--gold) 0%, transparent 50%)",
          }}
        />
        <div className="relative">
          <div className="section-eyebrow brand-fg mb-3">{copy.ctaEyebrow}</div>
          <h2 className="font-serif text-[32px] md:text-[42px] font-semibold leading-tight max-w-[20ch] mx-auto">
            {copy.ctaTitle}
          </h2>
          <p className="text-[15px] ink-2 mt-4 max-w-[52ch] mx-auto">
            {copy.ctaBody}
          </p>
          <div className="flex items-center justify-center gap-3 mt-7">
            <Link href="/signup" className="auf-btn auf-btn-primary !px-6 !py-3 !text-[15px]">
              Join free <ArrowRight size={15} />
            </Link>
            <Link href="/login" className="auf-btn auf-btn-outline !px-6 !py-3 !text-[15px]">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
