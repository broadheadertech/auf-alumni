import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Report an issue — AUF Alumni Network",
  description:
    "Report content, harassment, security vulnerabilities, or bugs on the AUF Alumni Network. Every report is reviewed by a human.",
};

const CARDS: Array<{
  title: string;
  email: string;
  sla: string;
  detail: string;
}> = [
  {
    title: "Content or harassment",
    email: "trust@auf.edu.ph",
    sla: "First response within 24 hours.",
    detail:
      "Use this channel for harassment, impersonation, scraping, spam, hate speech, or any profile or post that breaks the community guidelines. Include a link to the content, screenshots if possible, and a one-line description of what is wrong.",
  },
  {
    title: "Security vulnerability",
    email: "security@auf.edu.ph",
    sla: "First response within 48 hours.",
    detail:
      "Use this channel for security issues — broken access controls, data exposure, authentication bugs, or suspected misuse of admin tools. Please do not exploit the issue beyond what is needed to demonstrate it. We disclose responsibly and credit reporters.",
  },
  {
    title: "Bug or technical issue",
    email: "support@auf.edu.ph",
    sla: "Best-effort, usually within one business day.",
    detail:
      "Use this channel for everything else — broken pages, sign-in trouble, layout glitches, or features behaving oddly. Include your browser, device, and steps to reproduce. Screenshots help a lot.",
  },
];

export default function ReportPage() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <div className="section-eyebrow brand-fg mb-3">Report an issue</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        See something off? Let us know.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Pick the channel that matches what you are reporting. Every report
        is reviewed by a human on the Alumni Relations team — there are no
        automated rejections.
      </p>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <article key={c.email} className="auf-card p-6">
            <h2 className="font-serif text-[18px] font-semibold">{c.title}</h2>
            <p className="text-[13px] ink-3 mt-1">{c.sla}</p>
            <p className="text-[14px] ink-2 mt-3 leading-[1.6]">{c.detail}</p>
            <a
              href={`mailto:${c.email}`}
              className="brand-fg text-[13px] font-medium mt-4 inline-block underline underline-offset-4"
            >
              {c.email}
            </a>
          </article>
        ))}
      </section>

      <p className="text-[13px] ink-3 mt-10 max-w-[60ch] leading-[1.6]">
        Signed-in alumni can also report content inline — every profile,
        message, post, and job listing has a Report button that routes
        straight to the Trust &amp; Safety queue.
      </p>
    </div>
  );
}
