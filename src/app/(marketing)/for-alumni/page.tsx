import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "For alumni — AUF Alumni Network",
  description:
    "Free for life. A verified network of fellow AUF graduates, one-click referrals, mentorship matching, and a weekly digest of jobs and events.",
};

export default function ForAlumniPage() {
  return (
    <div className="max-w-[860px] mx-auto px-7 py-16">
      <div className="section-eyebrow brand-fg mb-3">For alumni</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Built for you, free for life.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        The AUF Alumni Network is the official career and community platform
        of Angeles University Foundation. Every member is school-verified, so
        every conversation you have here starts with shared ground.
      </p>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">A verified network</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Every account is matched against the AUF registrar before it
          appears in the directory. No recruiters cold-spamming you, no
          impersonators, no LinkedIn-style noise — just fellow Auf&iacute;ans
          who actually share your batch, program, or college.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">One-click referrals</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          See a job from a verified employer and want it surfaced to a
          classmate? Refer them with a single click — they get a note from
          you with the post attached, and the employer sees the referral
          chain. Referrals from alumni get top-of-queue review.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">Mentorship matching</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Tell us what you want to learn or who you want to help, and we will
          match you with alumni one or two career steps ahead (or behind).
          You set the cadence and the topic; we just handle introductions
          and gentle nudges.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">The weekly digest</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          One short email every Sunday: new jobs from verified employers,
          upcoming AUF events, three alumni worth meeting this week, and a
          short note from the Office of Alumni Relations. Opt out any time.
        </p>
      </section>

      <section className="mt-16 flex flex-wrap items-center gap-3">
        <Link href="/signup" className="auf-btn auf-btn-primary">
          Join free
        </Link>
        <Link href="/verification" className="auf-btn auf-btn-outline">
          How verification works
        </Link>
      </section>
    </div>
  );
}
