import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admissions — AUF Alumni Network",
  description:
    "Future and current AUF students — what the alumni network offers you, and where to start your application to Angeles University Foundation.",
};

export default function AdmissionsPage() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <div className="section-eyebrow brand-fg mb-3">Admissions</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Future AUF student? Start here.
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[60ch]">
        The AUF Alumni Network is the official career community for Angeles
        University Foundation graduates. If you are still considering AUF or
        just starting your application, this page is a quick guide to what
        comes next — and what the network unlocks once you are in.
      </p>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          Applying to AUF
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          This network does not handle admissions directly. To apply for an
          undergraduate, graduate, or law program, start at the main AUF
          website, where you can review course offerings, entrance test
          schedules, scholarships, and tuition.
        </p>
        <p className="text-[15px] ink-2 leading-[1.7] mt-3">
          Visit{" "}
          <a
            href="https://www.auf.edu.ph/home/index.php"
            className="brand-fg underline underline-offset-4"
            rel="noopener"
          >
            auf.edu.ph
          </a>{" "}
          for the latest admissions information, or contact the AUF
          Admissions Office for tours and inquiries.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          Already a current student?
        </h2>
        <p className="text-[15px] ink-2 leading-[1.7]">
          Enrolled Auf&iacute;ans with an active student ID can join the
          alumni network early. Sign up with your AUF student email and we
          will verify you against the registrar within a couple of business
          days. Once you are in, you get the same access to mentorship,
          events, and the directory as graduating alumni.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-[24px] mt-10 mb-3">
          What current students get
        </h2>
        <ul className="list-disc pl-5 space-y-1.5 text-[15px] ink-2 leading-[1.6]">
          <li>
            <strong>Early mentorship.</strong> Find alumni one or two career
            steps ahead in the path you are eyeing and ask the questions
            faculty cannot always answer.
          </li>
          <li>
            <strong>Internship leads.</strong> Verified employers can post
            internships visible to current students, often through alumni
            referrals.
          </li>
          <li>
            <strong>Alumni-led events.</strong> Tech mixers, career talks,
            and homecoming weekends — RSVP through the platform and skip
            the line at the door.
          </li>
          <li>
            <strong>A network that compounds.</strong> The connections you
            make as a student are the same ones you carry into your first
            job, your first promotion, and your first hire.
          </li>
        </ul>
      </section>
    </div>
  );
}
