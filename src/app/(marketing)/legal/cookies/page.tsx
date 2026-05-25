import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie policy — AUF Alumni Network",
  description:
    "How the AUF Alumni Network uses cookies — strictly essential session cookies, no third-party trackers, and how to control them in your browser.",
};

export default function CookiesPage() {
  return (
    <div className="max-w-[860px] mx-auto px-7 py-16">
      <div className="section-eyebrow brand-fg mb-3">Cookie policy</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Cookies on AUF Alumni.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        This policy explains the small number of cookies the AUF Alumni
        Network uses and the choices you have over them. It supplements,
        and should be read alongside, our privacy notice.
      </p>
      <p className="text-[13px] ink-3 mt-3">
        Version 1.0 · Last updated 2026-05-25
      </p>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          1. What we use
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          The platform uses strictly essential first-party cookies only.
          These keep you signed in across pages, remember your selected
          language and privacy preferences, and protect against
          cross-site request forgery. We do not run third-party advertising
          cookies, social-media pixels, or behavioural-targeting trackers
          in v1.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          2. Why we use them
        </h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] ink-2 leading-[1.6]">
          <li>To keep your session alive between page loads.</li>
          <li>To remember your privacy settings and language choice.</li>
          <li>To protect form submissions against cross-site forgery.</li>
          <li>To detect and block automated abuse of public pages.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          3. Controlling cookies
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Because the platform does not yet ship an analytics or marketing
          stack, there is no in-product cookie banner — there is nothing
          optional to consent to. You can still clear or block cookies at
          the browser level; doing so will sign you out and disable any
          remembered preferences.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          4. Changes to this policy
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          If we add product analytics or marketing tags in the future, we
          will update this page, post a notice in-product, and — where
          required by the Data Privacy Act — request fresh consent before
          any non-essential cookie is set.
        </p>
      </section>
    </div>
  );
}
