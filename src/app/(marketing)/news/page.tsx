import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Newsroom — AUF Alumni Network",
  description:
    "Updates from the AUF Alumni Network — verified-member milestones, employer partner launches, and upcoming alumni events.",
};

const ITEMS: Array<{ date: string; title: string; body: string }> = [
  {
    date: "May 20, 2026",
    title: "Network crosses 1,000 verified alumni",
    body:
      "Six months after the soft launch, the AUF Alumni Network passed 1,000 fully verified members across the eight colleges. Computer Studies, Nursing, and Engineering lead by college share. The Office of Alumni Relations credits the milestone to batch-captain outreach and a faster registrar lookup added in March.",
  },
  {
    date: "May 12, 2026",
    title: "Partner tier launches with Kumu, GCash, and TMC Clark",
    body:
      "Three founding employer partners go live this week with verified profiles and priority job posting: Kumu (live-streaming, Manila), GCash (fintech, BGC), and The Medical City Clark (healthcare, Pampanga). Partner-tier roles include alumni-only application windows and faster recruiter response SLAs.",
  },
  {
    date: "May 5, 2026",
    title: "AUF tech mixer 2026 — registration opens",
    body:
      "The annual AUF tech mixer returns to Clark on July 18, 2026, hosted at the AUF Innovation Lab. Open to all verified alumni and current Computer Studies and Engineering students. Capacity is capped at 300 — RSVP through the events tab once your account is verified.",
  },
];

export default function NewsPage() {
  return (
    <div className="max-w-[860px] mx-auto px-7 py-16">
      <div className="section-eyebrow brand-fg mb-3">Newsroom</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        What&apos;s happening at AUF Alumni.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Milestones, employer partner launches, and the events worth blocking
        on your calendar. This is a stub press feed while we wire up a
        proper editorial workflow with the Office of Alumni Relations.
      </p>

      <section className="mt-12 space-y-4">
        {ITEMS.map((n) => (
          <article key={n.title} className="auf-card p-6">
            <div className="auf-chip auf-chip-brand text-[11px] font-medium">
              {n.date}
            </div>
            <h2 className="font-serif text-[22px] font-semibold mt-3">
              {n.title}
            </h2>
            <p className="text-[15px] ink-2 mt-2 leading-[1.7]">{n.body}</p>
          </article>
        ))}
      </section>

      <p className="text-[13px] ink-3 mt-10">
        Note: this newsroom currently shows a sample feed. A live editorial
        feed will replace it once the press workflow ships.
      </p>
    </div>
  );
}
