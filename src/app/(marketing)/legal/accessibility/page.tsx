import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accessibility — AUF Alumni Network",
  description:
    "The AUF Alumni Network is committed to WCAG 2.2 AA. What we have shipped, known gaps, and how to report accessibility issues.",
};

export default function AccessibilityPage() {
  return (
    <div className="max-w-[860px] mx-auto px-7 py-16">
      <div className="section-eyebrow brand-fg mb-3">Accessibility</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Accessibility statement.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        Angeles University Foundation is committed to making the alumni
        network usable by every Auf&iacute;an, including those who rely on
        assistive technology. This statement explains the standard we hold
        ourselves to and where we still fall short.
      </p>
      <p className="text-[13px] ink-3 mt-3">Last updated 2026-05-25</p>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          Our standard
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          The platform targets <strong>WCAG 2.2 Level AA</strong>. New
          features are reviewed against AA success criteria before they
          ship, and the existing surface is audited every quarter by the
          Office of Alumni Relations and the product team.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          Known limitations
        </h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] ink-2 leading-[1.6]">
          <li>
            Mobile layout is still being refined; some tables on the
            directory and admin queue scroll horizontally on small screens.
          </li>
          <li>
            Dark mode is incomplete — a small number of components fall
            back to the light palette and may not yet meet contrast targets
            in dark mode.
          </li>
          <li>
            Avatar uploads and a few legacy modals lack a full keyboard
            focus trap. Fixes are scheduled for the next release.
          </li>
          <li>
            Auto-generated charts in the admin dashboard do not yet expose
            data tables for screen readers.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          Tools and choices
        </h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] ink-2 leading-[1.6]">
          <li>
            <strong>Geist Sans</strong> for body and UI text, chosen for
            legibility at small sizes.
          </li>
          <li>
            <strong>OKLCH-based palette</strong> so brand colours hold
            consistent contrast across light, dark, and printed surfaces.
          </li>
          <li>
            <strong>Keyboard navigation</strong> across the admin
            verification queue, including row selection, approve, and
            decline actions.
          </li>
          <li>
            <strong>Semantic HTML</strong> — landmarks, headings, lists,
            and form labels are used as intended; ARIA only where native
            HTML cannot express the intent.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          Report an accessibility issue
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          If something on the platform is not usable for you, please email{" "}
          <a
            href="mailto:accessibility@auf.edu.ph"
            className="brand-fg underline underline-offset-4"
          >
            accessibility@auf.edu.ph
          </a>
          . Describe the page, the assistive technology you use, and what
          you expected to happen. We aim to acknowledge within two
          business days and to fix or mitigate within the next release
          cycle.
        </p>
      </section>
    </div>
  );
}
