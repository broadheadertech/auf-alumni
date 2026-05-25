import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — AUF Alumni Network",
  description:
    "Built by Angeles University Foundation for its global alumni community. A trusted, verified network where every connection is one degree from a referral.",
};

export default function AboutPage() {
  return (
    <div className="max-w-[860px] mx-auto px-7 py-16">
      <div className="section-eyebrow brand-fg mb-3">Our story</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Built by AUF, for every AUF alum.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        The AUF Alumni Network is the official career and community platform of
        Angeles University Foundation. We exist so that a degree from AUF keeps
        opening doors long after graduation — through people, not algorithms.
      </p>

      <section className="mt-12">
        <h2 className="font-serif text-[24px] mt-10 mb-3">Mission</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          To be the most trusted alumni-only network in the Philippines, where
          every connection is one degree from a referral, a mentor, or a
          classmate worth catching up with. We measure success not in monthly
          active users, but in jobs filled, mentors booked, and reunions
          actually attended.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">Built by AUF</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Founded in 1971 along McArthur Highway in Angeles City, AUF has grown
          into one of Central Luzon&apos;s leading universities. This platform
          is operated directly by the AUF Office of Alumni Relations — not a
          third-party vendor — which means alumni data stays with the school
          and decisions are made with the community, not for it.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          How verification works
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Every account is verified against the AUF registrar before it can
          appear in the directory. We match on full name, batch year, and
          program, with a fallback to student ID or graduation photo when the
          registrar lookup is inconclusive. The review is handled by the AUF
          Alumni Relations team, usually within two business days. Unverified
          accounts cannot message, browse, or be searched.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">Privacy first</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Every field on your profile has its own visibility setting —
          public, alumni-only, connections-only, or private. You can opt out
          of search-engine indexing entirely with one toggle, and you decide
          which employers see your contact details. We comply with the
          Philippine Data Privacy Act (RA 10173) and have a Data Protection
          Officer on staff.
        </p>
      </section>

      <section className="mt-16 flex flex-wrap items-center gap-3">
        <Link href="/signup" className="auf-btn auf-btn-primary">
          Join free
        </Link>
        <Link href="/login" className="auf-btn auf-btn-outline">
          Sign in
        </Link>
      </section>
    </div>
  );
}
