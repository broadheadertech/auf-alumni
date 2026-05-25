import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data requests — AUF Alumni Network",
  description:
    "Your rights under the Philippine Data Privacy Act (RA 10173) and how to exercise them on the AUF Alumni Network.",
};

const RIGHTS: Array<{ title: string; body: string; how: string }> = [
  {
    title: "Right to access",
    body:
      "Ask for a copy of the personal data we hold about you, including profile fields, verification artifacts, and admin notes.",
    how: "Submit through Settings → Privacy → Request my data, or email the DPO.",
  },
  {
    title: "Right to correction",
    body:
      "Ask us to fix anything inaccurate about your account — name, batch year, program, employer, or any verification record.",
    how: "Most fields can be edited from your profile directly. For registrar records, email the DPO.",
  },
  {
    title: "Right to erasure",
    body:
      "Ask us to delete your account and the personal data we hold about you, subject to lawful retention obligations.",
    how: "Settings → Account → Delete account, or email the DPO if you cannot sign in.",
  },
  {
    title: "Right to data portability",
    body:
      "Receive a machine-readable export of your profile and activity so you can move it to another service.",
    how: "Settings → Privacy → Export my data — generates a JSON archive within a few minutes.",
  },
  {
    title: "Right to withdraw consent",
    body:
      "Withdraw the consent you gave when signing up. Some processing (e.g. transactional emails for account security) is based on legitimate interest and is not consent-driven.",
    how: "Adjust preferences in Settings → Privacy, or email the DPO for a full review.",
  },
  {
    title: "Right to object",
    body:
      "Object to specific kinds of processing — for example, inclusion in employer-facing search results or in the weekly digest.",
    how: "Settings → Privacy controls each surface independently; email the DPO if you need a broader carve-out.",
  },
];

export default function DataRequestsPage() {
  return (
    <div className="max-w-[860px] mx-auto px-7 py-16">
      <div className="section-eyebrow brand-fg mb-3">Data requests</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Your data, your rights.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Under Republic Act No. 10173 — the Philippine Data Privacy Act —
        you have a defined set of rights over your personal information.
        This page lists each right and how to exercise it on the AUF
        Alumni Network.
      </p>

      <section className="mt-12 space-y-6">
        {RIGHTS.map((r) => (
          <article key={r.title}>
            <h2 className="font-serif text-[20px] font-semibold">{r.title}</h2>
            <p className="text-[15px] ink-2 mt-1 leading-[1.7]">{r.body}</p>
            <p className="text-[13px] ink-3 mt-1 leading-[1.6]">
              <strong>How to exercise:</strong> {r.how}
            </p>
          </article>
        ))}
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-12 mb-3">
          Response timeline
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          We aim to acknowledge data requests within two business days and
          to resolve them within fifteen calendar days. Complex requests
          (e.g. those requiring registrar reconciliation) may take longer
          — we will tell you up front and keep you posted.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          Contact the DPO
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          To file any of the requests above, email{" "}
          <a
            href="mailto:dpo@auf.edu.ph"
            className="brand-fg underline underline-offset-4"
          >
            dpo@auf.edu.ph
          </a>{" "}
          from the address associated with your account. If you cannot
          sign in, we may need to verify your identity by other means
          before releasing or deleting data.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          National Privacy Commission
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          If you are not satisfied with how we handle a request, you may
          file a complaint with the National Privacy Commission (NPC). We
          ask that you contact the DPO first so we can resolve the issue
          directly.
        </p>
      </section>
    </div>
  );
}
