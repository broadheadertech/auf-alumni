import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export const metadata: Metadata = {
  title: "For employers — AUF Alumni Network",
  description:
    "Reach 38,000+ verified AUF alumni without the noise. Apply for a Verified or Partner employer account and post jobs reviewed by AUF Career Services.",
};

/**
 * Mirrors PLAN_TIERS in convex/billing.ts (starter / growth / scale) so the
 * pitch page and the employer billing screen can't quote different numbers.
 * The cards used to be inert and described the plans as per-post, which is not
 * how billing actually works — they are monthly with a post allowance.
 */
const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "₱2,000",
    period: "/ month",
    quota: "1 job post a month",
    blurb: "For a one-off hire or a first look at the network.",
    features: [
      "Reviewed and published by AUF",
      "Applications in one pipeline",
      "Company profile page",
    ],
    cta: "Get started",
    featured: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "₱5,000",
    period: "/ month",
    quota: "5 job posts a month",
    blurb: "For teams hiring across several roles at once.",
    features: [
      "Everything in Starter",
      "Featured placement on the board",
      "Alumni-match emails to fitting graduates",
    ],
    cta: "Choose Growth",
    featured: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "Custom",
    period: "",
    quota: "Unlimited posts",
    blurb: "Annual partnership for Partner-tier organisations.",
    features: [
      "Everything in Growth",
      "Named AUF Career Services contact",
      "Campus and career-fair invitations",
    ],
    cta: "Talk to AUF",
    featured: false,
  },
];

export default function ForEmployersPage() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <div className="section-eyebrow brand-fg mb-3">For hiring teams</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Hire AUF-verified alumni — without the noise.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Reach 38,000+ alumni of Angeles University Foundation, each verified
        against the school registrar. No bot applicants, no recycled resumes
        from unrelated schools, no cold-DM recruiter spam.
      </p>

      <section className="mt-14">
        <h2 className="font-serif text-[24px] mb-5">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            {
              n: "01",
              t: "Apply",
              d: "Submit your company profile, SEC/DTI registration, and the hiring contact. Takes about five minutes.",
            },
            {
              n: "02",
              t: "Get verified",
              d: "AUF Career Services reviews your application within three business days and assigns your employer tier.",
            },
            {
              n: "03",
              t: "Post jobs",
              d: "Publish openings that show alumni who already work at your company. Every post is moderated before going live.",
            },
          ].map((s) => (
            <li key={s.n} className="auf-card p-5">
              <div className="font-serif text-[13px] gold-fg font-semibold">
                {s.n}
              </div>
              <div className="font-serif text-[18px] mt-2 font-semibold">
                {s.t}
              </div>
              <p className="text-[13.5px] ink-2 mt-2 leading-[1.55]">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-14 mb-5">Employer tiers</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="auf-card p-6">
            <div className="text-[12px] uppercase tracking-wider ink-3">
              Verified
            </div>
            <div className="font-serif text-[22px] mt-1 font-semibold">
              For most companies
            </div>
            <ul className="mt-4 space-y-2 text-[14px] ink-2">
              <li>Up to 10 active job posts</li>
              <li>Verified-employer badge on every listing</li>
              <li>Standard moderation queue (24-hour SLA)</li>
              <li>Self-serve applicant inbox</li>
            </ul>
          </div>
          <div className="auf-card p-6" style={{ borderColor: "var(--brand)" }}>
            <div className="text-[12px] uppercase tracking-wider brand-fg">
              Partner
            </div>
            <div className="font-serif text-[22px] mt-1 font-semibold">
              For strategic hiring
            </div>
            <ul className="mt-4 space-y-2 text-[14px] ink-2">
              <li>Unlimited active job posts</li>
              <li>Co-branded AUF x Employer landing page</li>
              <li>Priority moderation (4-hour SLA)</li>
              <li>Dedicated Customer Success Manager</li>
              <li>Quarterly campus and career-fair invites</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="pricing">
        <h2 className="font-serif text-[24px] mt-14 mb-2">Pricing</h2>
        <p className="text-[14px] ink-2 mb-5 max-w-[62ch]">
          Employers pay; alumni never do. A plan covers a monthly allowance of
          posts — every one is reviewed by AUF Career Services before it reaches
          alumni, and unused posts don&apos;t roll over.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={
                "auf-card flex flex-col p-5" +
                (plan.featured ? " ring-1 ring-[var(--brand)]" : "")
              }
            >
              <div className="flex items-center gap-2">
                <div className="font-serif text-[20px] font-semibold">
                  {plan.name}
                </div>
                {plan.featured && (
                  <span className="auf-chip auf-chip-brand text-[10px]">
                    Most chosen
                  </span>
                )}
              </div>
              <div className="text-[22px] font-semibold mt-1">
                {plan.price}
                {plan.period && (
                  <span className="text-[13px] ink-3 font-normal">
                    {" "}
                    {plan.period}
                  </span>
                )}
              </div>
              <div className="text-[13px] brand-fg font-medium mt-0.5">
                {plan.quota}
              </div>
              <p className="text-[13px] ink-2 mt-2">{plan.blurb}</p>
              <ul className="mt-3 space-y-1 text-[12.5px] ink-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-1.5">
                    <Check size={13} className="mt-[3px] shrink-0 brand-fg" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/contact?topic=employer&plan=${plan.id}`}
                className={
                  "mt-4 w-full justify-center auf-btn auf-btn-sm " +
                  (plan.featured ? "auf-btn-primary" : "auf-btn-outline")
                }
              >
                {plan.cta} <ArrowRight size={13} />
              </Link>
            </div>
          ))}
        </div>
        <p className="text-[12px] ink-3 mt-4">
          Prices are illustrative for the v1 launch and are finalised with AUF
          Career Services. Already have an employer account?{" "}
          <Link href="/employer/billing" className="brand-fg hover:underline">
            Manage your plan in billing
          </Link>
          .
        </p>
      </section>

      <section className="mt-16 flex flex-wrap items-center gap-3">
        <Link href="/signup" className="auf-btn auf-btn-primary">
          Apply for Verified access
        </Link>
        <Link href="/contact?topic=employer" className="auf-btn auf-btn-outline">
          Talk to AUF Career Services
        </Link>
      </section>
    </div>
  );
}
