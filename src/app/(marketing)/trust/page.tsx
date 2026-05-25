import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Trust & safety — AUF Alumni Network",
  description:
    "How the AUF Alumni Network protects its members — verified-only membership, per-field privacy, audit-logged admin actions, and a clear moderation process.",
};

export default function TrustPage() {
  return (
    <div className="max-w-[860px] mx-auto px-7 py-16">
      <div className="section-eyebrow brand-fg mb-3">Trust &amp; safety</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Verified people. Verified conversations.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Trust is the network&apos;s only real moat. The five practices below
        are how we keep it intact for every Auf&iacute;an who signs up.
      </p>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          1. Verified alumni only
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Every account is matched against the AUF registrar before it
          appears in the directory. Unverified accounts cannot message
          alumni, browse the directory, or be searched. This applies to
          recruiters and partners too — verification is not optional for
          anyone.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          2. Per-field privacy tiers
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Each field on your profile — email, phone, employer, location, and
          so on — has its own visibility setting: public, alumni-only,
          connections-only, or private. You decide, field by field, who
          gets what. Nothing is shared by default beyond your name, batch,
          and program.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          3. Audit-logged admin actions
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Every action an Alumni Relations admin takes on the platform —
          verifying an account, removing content, suspending a user — is
          logged with timestamp, actor, and reason. Logs are reviewed
          quarterly by the Office of Alumni Relations and the DPO.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          4. Content moderation
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Members can report any profile, message, post, or job listing
          they think violates the{" "}
          <Link href="/guidelines" className="brand-fg underline underline-offset-4">
            community guidelines
          </Link>
          . Reports route to the Trust &amp; Safety queue and are usually
          actioned within one business day. Removed-content authors are
          notified and may appeal within 14 days.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          5. Suspension for violations
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Repeated or severe violations — harassment, impersonation,
          scraping, off-platform recruiting — result in suspension or
          permanent removal. Decisions are made by Alumni Relations, not by
          an algorithm, and every suspension comes with a written reason
          and an appeal path.
        </p>
      </section>

      <section className="mt-12 auf-card p-6">
        <h2 className="font-serif text-[20px] font-semibold">
          See something wrong?
        </h2>
        <p className="text-[14px] ink-2 mt-2 leading-[1.6]">
          Use the in-product Report button on any profile or post, or
          contact the Trust &amp; Safety team directly through the{" "}
          <Link href="/report" className="brand-fg underline underline-offset-4">
            report page
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
