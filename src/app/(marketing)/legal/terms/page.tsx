import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of service — AUF Alumni Network",
  description:
    "The agreement between Angeles University Foundation and users of the AUF Alumni Network — eligibility, acceptable use, content, billing, and governing law.",
};

export default function TermsPage() {
  return (
    <div className="max-w-[860px] mx-auto px-7 py-16">
      <div className="section-eyebrow brand-fg mb-3">Terms of service</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Terms of service
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        These terms (&ldquo;Terms&rdquo;) form the agreement between Angeles
        University Foundation (&ldquo;AUF&rdquo;, &ldquo;we&rdquo;) and you
        when you use the AUF Alumni Network. Please read them carefully — by
        creating an account you accept them in full.
      </p>
      <p className="text-[13px] ink-3 mt-3">
        Version 1.0 · Last updated 2026-05-25
      </p>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">1. Acceptance</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          By signing up for, accessing, or using the AUF Alumni Network you
          agree to these Terms and to our Privacy Notice. If you do not agree,
          please do not use the service.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">2. Eligibility</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          The platform is open to (a) verified graduates of Angeles University
          Foundation, (b) currently enrolled AUF students invited through an
          official AUF channel, and (c) employer organizations whose accounts
          have been approved by AUF Career Services. You must be at least 16
          years old.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">3. Your account</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          You are responsible for keeping your credentials confidential and for
          activity that happens under your account. One account per person.
          Notify us promptly at security@auf.edu.ph if you suspect unauthorized
          access.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          4. Acceptable use
        </h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] ink-2 leading-[1.6]">
          <li>No harassment, hate speech, or threats toward other members.</li>
          <li>No impersonation of another alum, employer, or AUF staff.</li>
          <li>
            No automated scraping, crawling, or bulk export of the alumni
            directory, profiles, or messages.
          </li>
          <li>No off-platform recruiting spam targeted at the directory.</li>
          <li>No malware, phishing, or attempts to bypass access controls.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          5. Content you post
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          You retain ownership of the content you publish (profile fields,
          posts, photos, messages). You grant AUF a worldwide, royalty-free,
          non-exclusive license to host, display, and reproduce that content
          solely to operate and promote the platform. We may remove content
          that violates these Terms.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          6. Jobs and referrals
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Every employer job post is subject to AUF moderation before going
          live and may be removed at any time. Referrals offered by alumni are
          personal endorsements, not employment guarantees. AUF is not a party
          to any employment agreement between an alum and an employer.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          7. Subscriptions and billing
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Alumni accounts are free. Employer plans (Starter, Growth, Scale)
          are billed in Philippine pesos to the contact on file. New
          subscriptions are eligible for a full refund within 14 days of
          purchase if no job post has gone live; thereafter, refunds are
          handled on a pro-rata basis at AUF&apos;s discretion.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          8. Termination and suspension
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          We may suspend or terminate accounts that violate these Terms, that
          we cannot verify, or that pose a risk to the community. You can
          close your account at any time from Settings → Account.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">9. Disclaimers</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          The platform is provided &ldquo;as is&rdquo;. AUF makes no warranty
          regarding job outcomes, the accuracy of profiles, or the conduct of
          employers and alumni. We do our best to verify membership, but
          ultimate due diligence is yours.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          10. Limitation of liability
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          To the maximum extent allowed by Philippine law, AUF&apos;s aggregate
          liability arising from your use of the platform is limited to the
          amounts you paid (if any) in the twelve months before the claim. We
          are not liable for indirect, incidental, or consequential damages.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          11. Indemnification
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          You agree to indemnify and hold AUF harmless from claims arising out
          of (a) your content, (b) your use of the platform in violation of
          these Terms, or (c) your violation of any applicable law or
          third-party right.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          12. Governing law
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          These Terms are governed by the laws of the Republic of the
          Philippines. The proper venue for any dispute is the courts of
          Angeles City, Pampanga, to the exclusion of all others.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          13. Changes to the Terms
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          We may update these Terms from time to time. Material changes will
          be announced by email and on the platform at least 14 days before
          they take effect. Continued use after that date constitutes
          acceptance of the new Terms.
        </p>
      </section>
    </div>
  );
}
