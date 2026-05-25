import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Colleges — AUF Alumni Network",
  description:
    "Browse the eight AUF colleges represented in the alumni network — from Computer Studies and Engineering to Law and Allied Medical Professions.",
};

const COLLEGES: Array<{ name: string; blurb: string }> = [
  {
    name: "College of Computer Studies",
    blurb:
      "Home of AUF's software engineers, data analysts, cybersecurity specialists, and IT operators. CCS alumni anchor the platform's strongest hiring pipeline into the Clark and Manila tech corridors.",
  },
  {
    name: "College of Engineering & Architecture",
    blurb:
      "Civil, electrical, electronics, industrial, and computer engineers, plus a long-running architecture program. CEA alumni dominate the region's infrastructure, manufacturing, and BPO build-outs.",
  },
  {
    name: "College of Business & Accountancy",
    blurb:
      "Accounting, management, marketing, and entrepreneurship. CBA alumni lead finance teams across the Philippines and run a disproportionate share of Pampanga's family-owned enterprises.",
  },
  {
    name: "College of Nursing",
    blurb:
      "One of the largest nursing programs in Central Luzon, with alumni practicing across the Philippines, the Gulf states, the UK, and the US healthcare system.",
  },
  {
    name: "College of Allied Medical Professions",
    blurb:
      "Medical technology, pharmacy, physical therapy, and radiologic technology. CAMP graduates fill the diagnostic and rehabilitation roles every hospital depends on.",
  },
  {
    name: "College of Education",
    blurb:
      "Producing the teachers and school leaders who shape the next generation of Aufíans — from K-12 classrooms to graduate-school faculties.",
  },
  {
    name: "College of Arts & Sciences",
    blurb:
      "Communication, psychology, political science, and the natural sciences. CAS alumni are the platform's writers, researchers, public servants, and clinicians-in-training.",
  },
  {
    name: "School of Law",
    blurb:
      "Juris Doctor graduates practicing across litigation, corporate counsel, government service, and the judiciary. The smallest college by headcount, the largest by reach.",
  },
];

export default function CollegesPage() {
  return (
    <div className="max-w-[860px] mx-auto px-7 py-16">
      <div className="section-eyebrow brand-fg mb-3">Across AUF</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Seven colleges, one network.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Whatever you studied at Angeles University Foundation, this is your
        network. Browse alumni by college, batch, or program — or filter to
        the discipline that matches the role you are hiring for.
      </p>

      <section className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {COLLEGES.map((c) => (
          <article key={c.name} className="auf-card p-6">
            <h2 className="font-serif text-[18px] font-semibold">{c.name}</h2>
            <p className="text-[14px] ink-2 mt-2 leading-[1.6]">{c.blurb}</p>
            <Link
              href="/directory"
              className="brand-fg text-[13px] font-medium mt-3 inline-block underline underline-offset-4"
            >
              Browse alumni &rarr;
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
