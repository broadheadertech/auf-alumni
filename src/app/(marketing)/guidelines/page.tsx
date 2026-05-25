import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Community guidelines — AUF Alumni Network",
  description:
    "The standards of conduct on the AUF Alumni Network — respectful interaction, no spam, no impersonation, and a kind tone toward every Aufian.",
};

const RULES: Array<{ title: string; body: string }> = [
  {
    title: "1. Treat every Aufían with respect.",
    body: "Disagreement is fine. Personal attacks, slurs, and contempt are not. Argue ideas, not people.",
  },
  {
    title: "2. No spam or off-platform recruiting.",
    body: "All hiring outreach belongs on the jobs board. Unsolicited recruiter messages, mass DMs, and link-bait posts are removed on sight.",
  },
  {
    title: "3. Do not impersonate anyone.",
    body: "Use your real name, your real photo, and your actual academic history. Verification exists for a reason.",
  },
  {
    title: "4. No harassment.",
    body: "Repeated unwanted contact, targeted attacks, doxxing, or sexual harassment lead to immediate suspension. Block, mute, and report — we will follow up.",
  },
  {
    title: "5. Do not scrape the directory.",
    body: "Automated extraction of profile data is a violation of these guidelines and of the terms of service. Accounts caught scraping are banned permanently.",
  },
  {
    title: "6. Keep it professional.",
    body: "This is the alumni network of a university. Keep posts, photos, and conversation on the kind of footing you would in a faculty room or an office.",
  },
  {
    title: "7. No political campaigning.",
    body: "Civic discussion is welcome. Campaign material, fundraising for candidates, and partisan organizing are not. Find another venue for that work.",
  },
  {
    title: "8. Be kind to recent grads.",
    body: "The whole point of an alumni network is that every senior member was once new. Answer questions, take introductions, and pay it forward.",
  },
  {
    title: "9. Protect confidential information.",
    body: "Do not share other people's contact details, employer information, or photos without their permission. Trust is built quietly.",
  },
  {
    title: "10. Report what you see.",
    body: "If a post or profile crosses a line, use Report — every flag goes to a human reviewer, not a model.",
  },
];

export default function GuidelinesPage() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <div className="section-eyebrow brand-fg mb-3">Community guidelines</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        How we behave here.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Ten standards that make the AUF Alumni Network worth being on.
        Breaking them can lead to content removal, suspension, or a
        permanent ban — at the discretion of the Trust &amp; Safety team.
      </p>

      <section className="mt-12">
        <ul className="space-y-5">
          {RULES.map((r) => (
            <li key={r.title}>
              <div className="text-[15px] font-semibold ink">{r.title}</div>
              <p className="text-[14px] ink-2 mt-1 leading-[1.6]">{r.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <p className="text-[14px] ink-2">
          <Link href="/report" className="brand-fg underline underline-offset-4">
            Report violations &rarr;
          </Link>
        </p>
      </section>
    </div>
  );
}
