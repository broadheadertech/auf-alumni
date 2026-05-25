import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Verification — AUF Alumni Network",
  description:
    "How the AUF Alumni Network keeps membership alumni-only — a three-step verification flow that checks every account against the AUF registrar.",
};

export default function VerificationPage() {
  return (
    <div className="max-w-[860px] mx-auto px-7 py-16">
      <div className="section-eyebrow brand-fg mb-3">Verification</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        How we keep the network alumni-only.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Every account on the AUF Alumni Network is matched against the
        Angeles University Foundation registrar before it appears in the
        directory. Here is exactly how that works.
      </p>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          Step 1 — Sign up
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Create an account with your AUF student ID and either your AUF
          school email or a personal email. We capture the minimum we need
          to find your record: full name, batch year, and program. You can
          finish your profile afterwards.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          Step 2 — Registrar lookup
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          We match your details against the AUF registrar. School-email
          addresses are fast-pathed because the address itself is a strong
          signal — most school-email signups are verified within a few
          minutes. Personal-email signups still match, just with one extra
          check.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          Step 3 — Manual review
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          When the registrar lookup is ambiguous — older batches, name
          changes, transferred programs — your file goes to the Alumni
          Relations team. You may be asked to upload a photo of your
          student ID, diploma, or transcript. Manual reviews are typically
          completed within two business days.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          Privacy of verification artifacts
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Any document you upload during verification (student ID, diploma,
          or transcript) is encrypted, access-logged, and visible only to
          vetted Alumni Relations reviewers. Verification artifacts are
          automatically purged 30 days after the decision is recorded,
          whether you were approved or declined.
        </p>
      </section>

      <section className="mt-12 auf-card p-6">
        <h2 className="font-serif text-[20px] font-semibold">
          Ready to join?
        </h2>
        <p className="text-[14px] ink-2 mt-2 leading-[1.6]">
          Most verified alumni are in the directory within 48 hours of
          signing up. There is no fee, and your account stays free for life.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/signup" className="auf-btn auf-btn-primary auf-btn-sm">
            Start signup
          </Link>
          <Link href="/help" className="auf-btn auf-btn-outline auf-btn-sm">
            Verification FAQ
          </Link>
        </div>
      </section>
    </div>
  );
}
