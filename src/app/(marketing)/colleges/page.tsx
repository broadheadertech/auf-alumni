/**
 * Colleges — public overview of the AUF colleges and their programs.
 *
 * The college + program list comes from the admin-managed taxonomy tables
 * (Admin → Colleges & programs), the same source every picker and filter uses,
 * so this page can't drift from the database. The descriptive blurbs are
 * marketing copy keyed by college name; colleges without one still render.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/lib/convex-api";

export const metadata: Metadata = {
  title: "Colleges — AUF Alumni Network",
  description:
    "Browse the AUF colleges and programs represented in the alumni network — from Computer Studies and Engineering to Nursing and Allied Medical Professions.",
};

const BLURBS: Record<string, string> = {
  "College of Computer Studies":
    "Home of AUF's software engineers, data analysts, cybersecurity specialists, and IT operators. CCS alumni anchor the platform's strongest hiring pipeline into the Clark and Manila tech corridors.",
  "College of Engineering & Architecture":
    "Civil, electrical, electronics, industrial, and computer engineers, plus a long-running architecture program. CEA alumni dominate the region's infrastructure, manufacturing, and BPO build-outs.",
  "College of Business & Accountancy":
    "Accounting, management, marketing, and entrepreneurship. CBA alumni lead finance teams across the Philippines and run a disproportionate share of Pampanga's family-owned enterprises.",
  "College of Nursing":
    "One of the largest nursing programs in Central Luzon, with alumni practicing across the Philippines, the Gulf states, the UK, and the US healthcare system.",
  "College of Allied Medical Professions":
    "Medical technology, pharmacy, physical therapy, and radiologic technology. CAMP graduates fill the diagnostic and rehabilitation roles every hospital depends on.",
  "College of Education":
    "Producing the teachers and school leaders who shape the next generation of Aufíans — from K-12 classrooms to graduate-school faculties.",
  "College of Arts & Sciences":
    "Communication, psychology, political science, and the natural sciences. CAS alumni are the platform's writers, researchers, public servants, and clinicians-in-training.",
  "School of Law":
    "Juris Doctor graduates practicing across litigation, corporate counsel, government service, and the judiciary. The smallest college by headcount, the largest by reach.",
};

type CollegeRow = { name: string; programs: string[] };

async function loadColleges(): Promise<CollegeRow[]> {
  try {
    const [colleges, programs] = await Promise.all([
      fetchQuery(api.taxonomy.listColleges, {}),
      fetchQuery(api.taxonomy.listPrograms, {}),
    ]);
    return (colleges as Array<{ name: string }>).map((c) => ({
      name: c.name,
      programs: (programs as Array<{ name: string; collegeName: string }>)
        .filter((p) => p.collegeName === c.name)
        .map((p) => p.name),
    }));
  } catch {
    return [];
  }
}

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export default async function CollegesPage() {
  const colleges = await loadColleges();
  const count = colleges.length;
  const countWord = NUMBER_WORDS[count] ?? String(count);

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <div className="section-eyebrow brand-fg mb-3">Across AUF</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        {count > 0
          ? `${countWord} ${count === 1 ? "college" : "colleges"}, one network.`
          : "Every college, one network."}
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Whatever you studied at Angeles University Foundation, this is your
        network. Browse alumni by college, batch, or program — or filter to
        the discipline that matches the role you are hiring for.
      </p>

      {count === 0 ? (
        <div className="auf-card p-8 mt-12 text-center">
          <p className="text-[14px] ink-2">
            The college list is being updated. Please check back soon.
          </p>
        </div>
      ) : (
        <section className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {colleges.map((c) => (
            <article key={c.name} className="auf-card p-6 flex flex-col">
              <h2 className="font-serif text-[18px] font-semibold">{c.name}</h2>
              {BLURBS[c.name] && (
                <p className="text-[14px] ink-2 mt-2 leading-[1.6]">{BLURBS[c.name]}</p>
              )}
              {c.programs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.programs.map((p) => (
                    <span key={p} className="auf-chip text-[11px]">
                      {p}
                    </span>
                  ))}
                </div>
              )}
              <Link
                href="/signup"
                className="brand-fg text-[13px] font-medium mt-auto pt-3 inline-block underline underline-offset-4"
              >
                Browse alumni &rarr;
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
