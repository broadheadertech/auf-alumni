import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "For employers — AUF Alumni Network",
  description:
    "Reach 38,000+ verified AUF alumni without the noise. Apply for a Verified or Partner employer account and post jobs reviewed by AUF Career Services.",
};

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

      <section>
        <h2 className="font-serif text-[24px] mt-14 mb-5">Pricing</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="auf-card p-5">
            <div className="font-serif text-[20px] font-semibold">Starter</div>
            <div className="text-[22px] font-semibold mt-1">
              &#8369;2,000
              <span className="text-[13px] ink-3 font-normal"> /post</span>
            </div>
            <p className="text-[13px] ink-2 mt-2">
              Pay-as-you-go for one-off hires.
            </p>
          </div>
          <div className="auf-card p-5">
            <div className="font-serif text-[20px] font-semibold">Growth</div>
            <div className="text-[22px] font-semibold mt-1">
              &#8369;5,000
              <span className="text-[13px] ink-3 font-normal"> /post</span>
            </div>
            <p className="text-[13px] ink-2 mt-2">
              Featured placement plus alumni-match emails.
            </p>
          </div>
          <div className="auf-card p-5">
            <div className="font-serif text-[20px] font-semibold">Scale</div>
            <div className="text-[22px] font-semibold mt-1">Custom</div>
            <p className="text-[13px] ink-2 mt-2">
              Annual contract for Partner-tier accounts.
            </p>
          </div>
        </div>
        <p className="text-[12px] ink-3 mt-4">
          Pricing shown is illustrative for the v1 launch and is subject to
          finalization with AUF Career Services.
        </p>
      </section>

      <section className="mt-16 flex flex-wrap items-center gap-3">
        <Link href="/signup" className="auf-btn auf-btn-primary">
          Apply for Verified access
        </Link>
        <a
          href="mailto:careers@auf.edu.ph"
          className="auf-btn auf-btn-outline"
        >
          Talk to AUF Career Services
        </a>
      </section>
    </div>
  );
}
