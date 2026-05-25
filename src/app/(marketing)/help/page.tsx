import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help center — AUF Alumni Network",
  description:
    "Answers to common questions about verification, privacy, account management, and reporting on the AUF Alumni Network.",
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How does alumni verification work?",
    a: "When you sign up, we match the name, batch year, and program you provide against the AUF registrar. If a clean match is found you are auto-approved. If anything is ambiguous, the AUF Alumni Relations team reviews your account manually — you may be asked to upload a photo of your student ID, diploma, or transcript.",
  },
  {
    q: "How long does verification take?",
    a: "Most accounts are verified within two business days. Manual reviews that need additional documents can take up to five business days. You will receive an email at every status change, and you can check progress on your dashboard.",
  },
  {
    q: "What if my degree or batch isn't matched?",
    a: "Older records and some specialized programs may not be in the digitized registrar yet. Upload a clear photo of your diploma or transcript through the verification screen and our team will reconcile the record by hand. If you graduated before 1990, please email alumni@auf.edu.ph so we can prioritize your file.",
  },
  {
    q: "How do I change my privacy settings?",
    a: "Go to Settings → Privacy. Every field on your profile has its own visibility — public, alumni-only, connections-only, or private. You can also toggle off search-engine indexing of your public profile and decide which employer tiers can contact you.",
  },
  {
    q: "How do I delete my account?",
    a: "Settings → Account → Delete account. Your profile is removed from the directory immediately and permanently deleted after a 30-day grace period, during which you can reactivate by signing in. Verification artifacts (ID photos and registrar match logs) are purged 30 days after the deletion is finalized.",
  },
  {
    q: "How do I report someone?",
    a: "On any profile, message thread, or job post, use the Report button to flag harassment, impersonation, scraping, or off-platform recruiting. Reports go to the AUF Trust & Safety queue and are typically reviewed within one business day. For urgent or safety-related concerns, email trust@auf.edu.ph.",
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-[860px] mx-auto px-7 py-16">
      <div className="section-eyebrow brand-fg mb-3">Help center</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        How can we help?
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Quick answers to the questions alumni and employers ask us most. If
        you&apos;re stuck on something not listed here, our support team is
        one email away.
      </p>

      <section className="mt-12">
        <h2 className="font-serif text-[24px] mb-4">Frequently asked</h2>
        <ul className="auf-card divide-y" style={{ borderColor: "var(--border-soft)" }}>
          {FAQS.map((f) => (
            <li key={f.q}>
              <details className="group p-5">
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                  <span className="font-medium text-[15px]">{f.q}</span>
                  <span
                    className="ink-3 text-[18px] leading-none mt-0.5 transition group-open:rotate-45"
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="text-[14px] ink-2 mt-3 leading-[1.65]">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 auf-card p-6">
        <h2 className="font-serif text-[20px] font-semibold">
          Still need a hand?
        </h2>
        <p className="text-[14px] ink-2 mt-2 leading-[1.6]">
          Email{" "}
          <a
            href="mailto:support@auf.edu.ph"
            className="brand-fg underline underline-offset-4"
          >
            support@auf.edu.ph
          </a>{" "}
          and we&apos;ll get back to you within one business day. For urgent
          admissions or registrar questions, you can also reach AUF directly
          at +63 (45) 625-2999 (extension 8 for Alumni Relations).
        </p>
      </section>
    </div>
  );
}
