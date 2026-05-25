import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy notice — AUF Alumni Network",
  description:
    "How Angeles University Foundation collects, uses, and protects your personal information on the AUF Alumni Network, in compliance with the Philippine Data Privacy Act (RA 10173).",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <div className="section-eyebrow brand-fg mb-3">Privacy notice</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Privacy notice
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Angeles University Foundation (&ldquo;AUF&rdquo;, &ldquo;we&rdquo;)
        operates the AUF Alumni Network in compliance with Republic Act No.
        10173, the Data Privacy Act of 2012 (&ldquo;DPA&rdquo;), and under the
        oversight of the National Privacy Commission (&ldquo;NPC&rdquo;). This
        notice explains what we collect, why, and the rights you can exercise.
      </p>
      <p className="text-[13px] ink-3 mt-3">
        Version 1.0 · Last updated 2026-05-25
      </p>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          1. Personal information we collect
        </h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] ink-2 leading-[1.6]">
          <li>Identity: full name, batch year, program, AUF student ID.</li>
          <li>Contact: email address, optional mobile number.</li>
          <li>Profile content: optional photo, bio, work history, skills, location.</li>
          <li>Verification artifacts: registrar match logs and any documents you upload.</li>
          <li>Usage data: device, IP address, pages visited, and feature interactions.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">2. Lawful bases</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          We process your data based on your <strong>consent</strong> when you
          create an account and accept this notice, and on our{" "}
          <strong>legitimate interest</strong> in operating a verified alumni
          network — specifically, confirming that members are genuine AUF
          graduates. Where you provide sensitive personal information
          (e.g.&nbsp;a government ID), processing is based on your explicit
          consent.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          3. How we use your information
        </h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] ink-2 leading-[1.6]">
          <li>To verify your status as an AUF alum.</li>
          <li>To power the directory, messaging, jobs, and mentorship features.</li>
          <li>To send transactional emails and an opt-in alumni digest.</li>
          <li>To keep the platform safe — detect abuse, scraping, and impersonation.</li>
          <li>To produce aggregated, non-identifying analytics for AUF leadership.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          4. With whom we share
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          We share information with other verified alumni only to the extent
          allowed by your per-field privacy settings, and with verified
          employers only when you actively apply to one of their jobs. We use a
          small number of processors (hosting, email delivery, analytics) bound
          by data processing agreements. <strong>We do not sell your data.</strong>
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          5. Your rights under the DPA
        </h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] ink-2 leading-[1.6]">
          <li>Right to be informed (this notice).</li>
          <li>Right to access your personal data.</li>
          <li>Right to correct inaccurate information.</li>
          <li>Right to erasure or blocking.</li>
          <li>Right to data portability.</li>
          <li>Right to object to processing.</li>
          <li>Right to withdraw consent at any time.</li>
          <li>Right to file a complaint with the NPC.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">6. Retention</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          We retain your profile and account data for as long as your account
          is active. After you delete your account there is a 30-day grace
          period during which you can reactivate; after that, data is purged
          from production systems. Verification artifacts (ID photos,
          registrar logs) are purged 30 days after the verification decision
          is recorded, whichever comes first.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">7. Security</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          All traffic is encrypted in transit (TLS 1.2+) and data at rest is
          encrypted on the backend. Sensitive personal information (SPI) such
          as government IDs is segregated from operational data, access-logged,
          and limited to vetted Alumni Relations staff.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">8. Cookies</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          We use strictly necessary cookies to keep you signed in and to
          remember your privacy preferences, plus first-party analytics cookies
          to understand product usage. We do not use third-party advertising
          cookies.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">9. Children</h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          The AUF Alumni Network is intended for users 16 years of age and
          older. We do not knowingly collect data from anyone younger; if you
          believe we have, please contact our DPO so we can delete it.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          10. International transfers
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          The platform is hosted on Convex Cloud, whose primary regions are
          outside the Philippines. Transfers are protected by the processor&apos;s
          contractual safeguards and by encryption in transit and at rest. By
          using the service you consent to this transfer.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          11. Data Protection Officer
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          To exercise any right above or to ask a question about this notice,
          contact our Data Protection Officer at{" "}
          <a
            href="mailto:dpo@auf.edu.ph"
            className="brand-fg underline underline-offset-4"
          >
            dpo@auf.edu.ph
          </a>{" "}
          or by post: Office of the DPO, Angeles University Foundation,
          McArthur Highway, Angeles City 2009, Pampanga, Philippines.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          12. Filing a complaint with the NPC
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          If you believe your privacy rights have been violated, you may lodge
          a complaint with the National Privacy Commission. We ask that you
          contact our DPO first so we can resolve the issue directly.
        </p>
        <p className="text-[14px] ink-2 mt-2 leading-[1.6]">
          National Privacy Commission · 5th Floor, Philippine International
          Convention Center, Pasay City · complaints@privacy.gov.ph ·
          privacy.gov.ph
        </p>
      </section>
    </div>
  );
}
