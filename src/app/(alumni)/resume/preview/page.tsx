"use client";

/**
 * Print-styled resume preview, generated from the alumna's profile fields.
 *
 * Renders cleanly to A4 / US-Letter via `@media print`. The user clicks
 * "Save as PDF" → window.print() → browser print dialog → choose "Save
 * as PDF". The output PDF can then be uploaded back via /settings/resume
 * so it becomes the alumna's default attached resume.
 *
 * Pure client component — no PDF library, no server-side rendering of
 * binary assets. Lighter, no new deps.
 */

import { useQuery } from "convex/react";
import {
  Download,
  Loader2,
  MapPin,
  Mail,
  Phone,
} from "lucide-react";
import { api } from "@/lib/convex-api";

type ExperienceRow = { role: string; company: string; years: string };
type EducationRow = {
  degree: string;
  program: string;
  school: string;
  year: number;
};

type ProfileSnapshot = {
  displayName: string;
  batch: number;
  program: string;
  degree: string;
  currentRole?: string;
  company?: string;
  city?: string;
  country?: string;
  bio?: string;
  skills?: string[];
  experience?: ExperienceRow[];
  education?: EducationRow[];
  alumniId?: string | null;
} | null;

type MeSnapshot = { email?: string; phone?: string } | null;

export default function ResumePreviewPage() {
  const profile = useQuery(api.profiles.getMyAlumniCard) as
    | ProfileSnapshot
    | undefined;
  const me = useQuery(api.users.getMe) as MeSnapshot | undefined;

  if (profile === undefined || me === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Loader2 className="mx-auto h-6 w-6 animate-spin ink-3" />
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-serif text-2xl font-semibold">No profile yet</h1>
        <p className="text-sm ink-3 mt-2">
          Create your profile first to generate a resume.
        </p>
      </div>
    );
  }

  const onPrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  const fullEducation: EducationRow[] = [
    ...(profile.education ?? []),
    // Ensure the AUF degree always appears even if the user didn't list it.
    ...(profile.education?.some((e) =>
      e.school.toLowerCase().includes("angeles university foundation"),
    )
      ? []
      : [
          {
            degree: profile.degree,
            program: profile.program,
            school: "Angeles University Foundation",
            year: profile.batch,
          },
        ]),
  ];

  return (
    <div className="bg-[#f4f3ee] min-h-screen print:bg-white">
      {/* Sticky toolbar — hidden on print */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b auf-hairline print:hidden">
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider ink-3">
              Resume preview
            </div>
            <div className="font-serif text-[14px] font-semibold">
              {profile.displayName}
            </div>
          </div>
          <button
            type="button"
            onClick={onPrint}
            className="auf-btn auf-btn-primary auf-btn-sm"
          >
            <Download size={14} /> Save as PDF
          </button>
        </div>
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 pb-2 text-[11px] ink-3">
          Tip: in the print dialog, choose <em>Save as PDF</em>, set margins
          to <em>None</em> or <em>Default</em>, and disable headers/footers
          for the cleanest output.
        </div>
      </div>

      {/* Page sheet (~A4 width on screen, scales to actual paper on print) */}
      <div className="max-w-[820px] mx-auto my-6 print:my-0 bg-white shadow-md print:shadow-none print:max-w-none">
        <article className="p-10 print:p-10 font-sans text-ink">
          {/* Header */}
          <header className="border-b auf-hairline pb-4">
            <h1 className="font-serif text-[32px] font-semibold leading-tight tracking-tight">
              {profile.displayName}
            </h1>
            {(profile.currentRole || profile.company) && (
              <div className="text-[14px] ink-2 mt-1">
                {[profile.currentRole, profile.company].filter(Boolean).join(" · ")}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] ink-3">
              {me?.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail size={12} /> {me.email}
                </span>
              )}
              {me?.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={12} /> {me.phone}
                </span>
              )}
              {(profile.city || profile.country) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} />
                  {[profile.city, profile.country].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </header>

          {/* Summary */}
          {profile.bio && (
            <Section title="Summary">
              <p className="text-[13.5px] leading-[1.55] ink-2 whitespace-pre-wrap">
                {profile.bio}
              </p>
            </Section>
          )}

          {/* Experience */}
          {profile.experience && profile.experience.length > 0 && (
            <Section title="Experience">
              <ul className="space-y-3">
                {profile.experience.map((x, i) => (
                  <li key={i}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <div className="font-medium text-[14px]">
                        {x.role}
                        <span className="ink-3 font-normal"> · {x.company}</span>
                      </div>
                      <div className="text-[12px] ink-3">{x.years}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Education */}
          <Section title="Education">
            <ul className="space-y-3">
              {fullEducation.map((e, i) => (
                <li key={i}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="font-medium text-[14px]">
                      {e.degree}
                      <span className="ink-3 font-normal">
                        {" "}
                        in {e.program}
                      </span>
                    </div>
                    <div className="text-[12px] ink-3">
                      Class of {e.year}
                    </div>
                  </div>
                  <div className="text-[12.5px] ink-2">{e.school}</div>
                </li>
              ))}
            </ul>
          </Section>

          {/* Skills */}
          {profile.skills && profile.skills.length > 0 && (
            <Section title="Skills">
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 text-[12px] rounded-full border auf-hairline ink-2"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Footer */}
          <footer className="mt-10 pt-3 border-t auf-hairline text-[10px] ink-3 flex flex-wrap items-center justify-between gap-2">
            <span>
              Generated via the AUF Alumni Network
              {profile.alumniId ? ` · ${profile.alumniId}` : ""}
            </span>
            <span>{new Date().toLocaleDateString()}</span>
          </footer>
        </article>
      </div>

      {/* Print-only adjustments */}
      <style>{`
        @media print {
          @page { size: auto; margin: 12mm; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="font-serif text-[16px] font-semibold uppercase tracking-[0.08em] ink-2 mb-2 border-b auf-hairline pb-1">
        {title}
      </h2>
      {children}
    </section>
  );
}
