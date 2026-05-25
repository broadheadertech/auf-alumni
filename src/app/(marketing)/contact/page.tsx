import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — AUF Alumni Network",
  description:
    "Reach the AUF Alumni Network team — general inquiries, support, employer partnerships, data privacy, and security contacts.",
};

const CHANNELS: Array<{ label: string; email: string; note: string }> = [
  {
    label: "General inquiries",
    email: "alumni@auf.edu.ph",
    note: "Anything that doesn't fit the other boxes.",
  },
  {
    label: "Account support",
    email: "support@auf.edu.ph",
    note: "Sign-in, verification, profile, billing questions.",
  },
  {
    label: "Employer partnerships",
    email: "careers@auf.edu.ph",
    note: "Job posting, recruiter access, and partner tier.",
  },
  {
    label: "Data Protection Officer",
    email: "dpo@auf.edu.ph",
    note: "Privacy questions and Data Privacy Act requests.",
  },
  {
    label: "Security",
    email: "security@auf.edu.ph",
    note: "Vulnerability disclosure and security incidents.",
  },
];

export default function ContactPage() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <div className="section-eyebrow brand-fg mb-3">Contact</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        We&apos;re here to help.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        The AUF Alumni Network is operated by the Office of Alumni Relations
        at Angeles University Foundation. Pick the channel that matches your
        question and we will get back to you within one business day.
      </p>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <h2 className="font-serif text-[20px] font-semibold mb-4">
            Email channels
          </h2>
          <ul className="space-y-4">
            {CHANNELS.map((c) => (
              <li key={c.email}>
                <div className="text-[14px] font-medium ink">{c.label}</div>
                <a
                  href={`mailto:${c.email}`}
                  className="brand-fg text-[14px] underline underline-offset-4"
                >
                  {c.email}
                </a>
                <p className="text-[13px] ink-3 mt-1 leading-[1.5]">{c.note}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-serif text-[20px] font-semibold mb-4">
            Office of Alumni Relations
          </h2>
          <address className="not-italic text-[14px] ink-2 leading-[1.7]">
            Angeles University Foundation
            <br />
            McArthur Highway
            <br />
            Angeles City 2009
            <br />
            Pampanga, Philippines
          </address>

          <div className="mt-5">
            <div className="text-[13px] section-eyebrow ink-3 mb-1">Phone</div>
            <a
              href="tel:+63456252999"
              className="brand-fg text-[14px] underline underline-offset-4"
            >
              +63 (45) 625-2999
            </a>
            <p className="text-[13px] ink-3 mt-1">
              Extension 8 for Alumni Relations.
            </p>
          </div>

          <div className="mt-5">
            <div className="text-[13px] section-eyebrow ink-3 mb-1">
              Office hours
            </div>
            <p className="text-[14px] ink-2">
              Monday to Friday, 8:00 AM to 5:00 PM (PHT).
            </p>
            <p className="text-[13px] ink-3 mt-1">
              Closed on Philippine public holidays.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
