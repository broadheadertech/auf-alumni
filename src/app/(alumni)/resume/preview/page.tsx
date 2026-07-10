"use client";

/**
 * AUF CV generator — print-styled, AUF-branded resume built from the alumna's
 * profile, rendered against the admin-provided official template.
 *
 * - Branding, verification watermark + seal, footer, and which sections are
 *   required / optional / hidden all come from the admin template
 *   (lib/cv-template.ts → managed at /admin/cv-template).
 * - Required sections are always shown; optional ones the alumna can toggle in
 *   the "What to display" panel; hidden ones aren't offered.
 * - Uses the signed-in Convex profile when available; falls back to a complete
 *   demo alumna so the template is always reviewable.
 * - "Save as PDF" → window.print(); print CSS preserves band/watermark colours.
 */

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Download,
  FileUp,
  Loader2,
  MapPin,
  Mail,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { extractResumeText } from "@/lib/extract-resume-text";
import {
  CV_ACCENTS,
  CV_SECTIONS,
  DEFAULT_CV_TEMPLATE,
  loadCvTemplate,
  type CvSection,
  type CvTemplateConfig,
} from "@/lib/cv-template";
import {
  DEMO_CV,
  clearCvOverride,
  loadCvOverride,
  saveCvOverride,
  type CvData,
  type CvExperience,
  type CvEducation,
} from "@/lib/cv-data";

const GENERATED_ON = "June 28, 2026";

function escapeXml(s: string) {
  return s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
}
function watermarkBg(text: string, hex: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="250">` +
    `<text x="14" y="150" transform="rotate(-22 180 130)" font-family="Georgia, serif" ` +
    `font-size="23" font-weight="700" fill="${hex}" fill-opacity="0.06">${escapeXml(text)}</text>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ----------------------------------------------- profile → CV field mapping ---

type ConvexProfile = {
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
  experience?: CvExperience[];
  education?: CvEducation[];
  alumniId?: string | null;
} | null | undefined;

type MeSnapshot = { email?: string; phone?: string } | null | undefined;

function mapProfileToCv(p: NonNullable<ConvexProfile>, me: MeSnapshot): CvData {
  const hasAuf = (p.education ?? []).some((e) =>
    e.school.toLowerCase().includes("angeles university foundation"),
  );
  const education = [
    ...(p.education ?? []),
    ...(hasAuf
      ? []
      : [{ degree: p.degree, program: p.program, school: "Angeles University Foundation", year: p.batch }]),
  ];
  return {
    name: p.displayName,
    title: [p.currentRole, p.company].filter(Boolean).join(" · "),
    email: me?.email ?? "",
    phone: me?.phone ?? "",
    city: p.city ?? "",
    country: p.country ?? "",
    summary: p.bio ?? "",
    experience: p.experience ?? [],
    education,
    skills: p.skills ?? [],
    certifications: [],
    alumniId: p.alumniId ?? "Pending verification",
  };
}

type SavedResume =
  | { filename: string; uploadedAt: number | null; url: string | null }
  | null
  | undefined;

export default function ResumePreviewPage() {
  const profile = useQuery(api.profiles.getMyAlumniCard) as ConvexProfile;
  const me = useQuery(api.users.getMe) as MeSnapshot;
  const savedResume = useQuery(api.profiles.getMyProfileResume) as SavedResume;

  // Admin-provided official template (hydrated from storage after mount).
  const [tpl, setTpl] = useState<CvTemplateConfig>(DEFAULT_CV_TEMPLATE);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load admin-provided template from localStorage
    setTpl(loadCvTemplate());
  }, []);

  // Effective CV data: the alumna's saved edits win, else the live profile,
  // else the demo. Editing shows a live draft.
  const base: CvData =
    profile && typeof profile === "object" ? mapProfileToCv(profile, me) : DEMO_CV;

  const [override, setOverride] = useState<CvData | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load saved CV edits from localStorage
    setOverride(loadCvOverride());
  }, []);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CvData>(DEMO_CV);
  const [importing, setImporting] = useState(false);

  const cv: CvData = editing ? draft : (override ?? base);
  const usingDemo =
    !editing && !override && !(profile && typeof profile === "object");

  const startEdit = () => {
    setDraft(override ?? base);
    setEditing(true);
  };
  const saveEdit = () => {
    saveCvOverride(draft);
    setOverride(draft);
    setEditing(false);
    toast.success("CV details saved");
  };
  const resetToProfile = () => {
    clearCvOverride();
    setOverride(null);
    setEditing(false);
    toast.message("Reverted to your profile details");
  };

  // Seed the CV from the alumna's uploaded CV file: fetch it, extract the raw
  // text (no field auto-mapping), drop it into the editable summary, and open
  // the editor so they can organize it into the proper sections before saving.
  const onImportFromCv = async () => {
    if (!savedResume?.url) {
      toast.error("No uploaded CV found — add one in Resume settings first.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch(savedResume.url);
      if (!res.ok) throw new Error("Couldn't fetch your uploaded CV");
      const buf = await res.arrayBuffer();
      const { text } = await extractResumeText(buf, savedResume.filename);
      setDraft({ ...(override ?? base), summary: text });
      setEditing(true);
      toast.success(
        `Imported text from ${savedResume.filename} — organize it into the sections below, then Save details.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CV import failed");
    } finally {
      setImporting(false);
    }
  };

  // Per-alumna choices for OPTIONAL sections (default on).
  const [optIn, setOptIn] = useState<Record<CvSection, boolean>>(() =>
    Object.fromEntries(CV_SECTIONS.map((s) => [s.key, true])) as Record<CvSection, boolean>,
  );

  const accentHex = CV_ACCENTS[tpl.accent].hex;

  const hasContent = (key: CvSection): boolean => {
    switch (key) {
      case "contact":
        return !!(cv.email || cv.phone || cv.city || cv.country);
      case "summary":
        return !!cv.summary;
      case "experience":
        return cv.experience.length > 0;
      case "education":
        return cv.education.length > 0;
      case "skills":
        return cv.skills.length > 0;
      case "certifications":
        return cv.certifications.length > 0;
    }
  };

  const visible = (key: CvSection): boolean => {
    const policy = tpl.sections[key];
    if (policy === "hidden") return false;
    if (!hasContent(key)) return false;
    if (policy === "required") return true;
    return optIn[key];
  };

  const onPrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="min-h-screen bg-[#f4f3ee] print:bg-white">
      {/* Toolbar (hidden on print) */}
      <div className="sticky top-0 z-10 border-b auf-hairline bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[820px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <div className="text-[11px] uppercase tracking-wider ink-3">AUF CV generator</div>
            <div className="font-serif text-[14px] font-semibold">{cv.name || "Your CV"}</div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button type="button" onClick={() => setEditing(false)} className="auf-btn auf-btn-outline auf-btn-sm">
                  Cancel
                </button>
                <button type="button" onClick={saveEdit} className="auf-btn auf-btn-primary auf-btn-sm">
                  Save details
                </button>
              </>
            ) : (
              <>
                {savedResume?.url && (
                  <button
                    type="button"
                    onClick={onImportFromCv}
                    disabled={importing}
                    className="auf-btn auf-btn-outline auf-btn-sm"
                    title={`Read text from ${savedResume.filename} into your CV`}
                  >
                    {importing ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <FileUp size={13} />
                    )}
                    Import from my uploaded CV
                  </button>
                )}
                <button type="button" onClick={startEdit} className="auf-btn auf-btn-outline auf-btn-sm">
                  <Pencil size={13} /> Edit details
                </button>
                <button type="button" onClick={onPrint} className="auf-btn auf-btn-primary auf-btn-sm">
                  <Download size={14} /> Save as PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* What to display — admin policy drives which are togglable */}
        <div className="mx-auto max-w-[820px] px-4 pb-3 sm:px-6">
          <div className="text-[11px] font-medium uppercase tracking-wide ink-3">
            What to display
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {CV_SECTIONS.map(({ key, label }) => {
              const policy = tpl.sections[key];
              if (policy === "hidden") return null;
              const required = policy === "required";
              const noContent = !hasContent(key);
              const checked = required ? true : optIn[key] && !noContent;
              const locked = required || noContent;
              return (
                <label
                  key={key}
                  className={"flex items-center gap-1.5 text-[12.5px] " + (locked ? "opacity-50" : "cursor-pointer")}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    onChange={() => setOptIn((s) => ({ ...s, [key]: !s[key] }))}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  {label}
                  {required && <span className="text-[10px] ink-3">(required)</span>}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] italic ink-3">
            Template provided by AUF Admin.
            {usingDemo && " Demo data — your real profile fields populate this once signed in."}
          </p>
        </div>
      </div>

      {/* Editor (hidden on print) */}
      {editing && (
        <div className="print:hidden mx-auto max-w-[820px] px-4 sm:px-6 mt-6">
          <CvEditor draft={draft} setDraft={setDraft} onReset={resetToProfile} hasOverride={!!override} />
        </div>
      )}

      {/* The CV sheet */}
      <div className="relative mx-auto my-6 max-w-[820px] overflow-hidden bg-white shadow-md print:my-0 print:max-w-none print:shadow-none">
        {tpl.watermarkEnabled && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              backgroundImage: watermarkBg(tpl.watermarkText, accentHex),
              backgroundRepeat: "repeat",
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact",
            }}
          />
        )}

        <div className="relative z-10">
          {/* AUF brand band */}
          <header
            className="flex items-center justify-between gap-4 px-10 py-5 text-white"
            style={{ background: accentHex, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold"
                style={{ background: "var(--gold)", color: accentHex }}
              >
                AUF
              </span>
              <div className="leading-tight">
                <div className="font-serif text-[15px] font-semibold tracking-wide">{tpl.orgName}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] opacity-80">{tpl.subtitle}</div>
                {tpl.tagline && <div className="text-[10px] opacity-70">{tpl.tagline}</div>}
              </div>
            </div>
            {tpl.sealEnabled && (
              <div className="text-right">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold"
                  style={{ background: "var(--gold)", color: accentHex }}
                >
                  <ShieldCheck size={12} /> VERIFIED ALUMNUS
                </span>
                <div className="mt-1 font-mono text-[10.5px] opacity-85">{cv.alumniId}</div>
              </div>
            )}
          </header>

          {/* Identity */}
          <div className="px-10 pt-7">
            <h1 className="font-serif text-[32px] font-semibold leading-tight tracking-tight">{cv.name}</h1>
            {cv.title && <div className="mt-1 text-[14px] ink-2">{cv.title}</div>}
            {visible("contact") && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] ink-3">
                {cv.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail size={12} /> {cv.email}
                  </span>
                )}
                {cv.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={12} /> {cv.phone}
                  </span>
                )}
                {(cv.city || cv.country) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} />
                    {[cv.city, cv.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            )}
          </div>

          <article className="px-10 pb-10 pt-2 font-sans text-ink">
            {visible("summary") && (
              <Section title="Summary">
                <p className="whitespace-pre-wrap text-[13.5px] leading-[1.55] ink-2">{cv.summary}</p>
              </Section>
            )}

            {visible("experience") && (
              <Section title="Experience">
                <ul className="space-y-3">
                  {cv.experience.map((x, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-2">
                      <div className="text-[14px] font-medium">
                        {x.role}
                        <span className="font-normal ink-3"> · {x.company}</span>
                      </div>
                      <div className="text-[12px] ink-3">{x.years}</div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {visible("education") && (
              <Section title="Education">
                <ul className="space-y-3">
                  {cv.education.map((e, i) => {
                    const isAuf = e.school.toLowerCase().includes("angeles university foundation");
                    return (
                      <li key={i}>
                        <div className="flex flex-wrap justify-between gap-2">
                          <div className="text-[14px] font-medium">
                            {e.degree}
                            <span className="font-normal ink-3"> in {e.program}</span>
                          </div>
                          <div className="text-[12px] ink-3">Class of {e.year}</div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12.5px] ink-2">
                          {e.school}
                          {isAuf && (
                            <span
                              className="rounded px-1.5 text-[9.5px] font-semibold"
                              style={{ background: "var(--gold)", color: accentHex, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
                            >
                              VERIFIED
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            {visible("skills") && (
              <Section title="Skills">
                <div className="flex flex-wrap gap-1.5">
                  {cv.skills.map((s) => (
                    <span key={s} className="rounded-full border auf-hairline px-2 py-0.5 text-[12px] ink-2">
                      {s}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {visible("certifications") && (
              <Section title="Certifications">
                <ul className="space-y-2">
                  {cv.certifications.map((c, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-2">
                      <div className="text-[13.5px] font-medium">
                        {c.name}
                        <span className="font-normal ink-3"> · {c.issuer}</span>
                      </div>
                      <div className="text-[12px] ink-3">{c.year}</div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t auf-hairline pt-3 text-[10px] ink-3">
              <span>{tpl.footerText} · {cv.alumniId}</span>
              <span>{GENERATED_ON}</span>
            </footer>
          </article>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: auto; margin: 10mm; }
          body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 border-b auf-hairline pb-1 font-serif text-[15px] font-semibold uppercase tracking-[0.08em] ink-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ------------------------------------------------------------- CV editor ---

function CvEditor({
  draft,
  setDraft,
  onReset,
  hasOverride,
}: {
  draft: CvData;
  setDraft: React.Dispatch<React.SetStateAction<CvData>>;
  onReset: () => void;
  hasOverride: boolean;
}) {
  const set = (patch: Partial<CvData>) => setDraft((d) => ({ ...d, ...patch }));

  const setExp = (i: number, patch: Partial<CvExperience>) =>
    setDraft((d) => ({
      ...d,
      experience: d.experience.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));
  const addExp = () =>
    setDraft((d) => ({ ...d, experience: [...d.experience, { role: "", company: "", years: "" }] }));
  const removeExp = (i: number) =>
    setDraft((d) => ({ ...d, experience: d.experience.filter((_, idx) => idx !== i) }));

  const setEdu = (i: number, patch: Partial<CvEducation>) =>
    setDraft((d) => ({
      ...d,
      education: d.education.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));
  const addEdu = () =>
    setDraft((d) => ({
      ...d,
      education: [...d.education, { degree: "", program: "", school: "", year: 2024 }],
    }));
  const removeEdu = (i: number) =>
    setDraft((d) => ({ ...d, education: d.education.filter((_, idx) => idx !== i) }));

  const setCert = (i: number, patch: Partial<CvData["certifications"][number]>) =>
    setDraft((d) => ({
      ...d,
      certifications: d.certifications.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));
  const addCert = () =>
    setDraft((d) => ({
      ...d,
      certifications: [...d.certifications, { name: "", issuer: "", year: 2024 }],
    }));
  const removeCert = (i: number) =>
    setDraft((d) => ({ ...d, certifications: d.certifications.filter((_, idx) => idx !== i) }));

  return (
    <div className="auf-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-[16px] font-semibold">Edit your CV</h2>
        {hasOverride && (
          <button type="button" onClick={onReset} className="text-[12px] ink-3 hover:ink underline underline-offset-2">
            Reset to profile
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[12px] ink-3">
        Changes preview live below. Click <strong>Save details</strong> above to keep them.
      </p>

      {/* Basic details */}
      <div className="mt-4">
        <EditorLabel>Basic details</EditorLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Full name">
            <input className="auf-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Juan Dela Cruz" />
          </Field>
          <Field label="Headline">
            <input className="auf-input" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Software Engineer · Company" />
          </Field>
          <Field label="Email">
            <input className="auf-input" value={draft.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@auf.edu.ph" />
          </Field>
          <Field label="Phone">
            <input className="auf-input" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+63 917 …" />
          </Field>
          <Field label="City">
            <input className="auf-input" value={draft.city} onChange={(e) => set({ city: e.target.value })} placeholder="Angeles City" />
          </Field>
          <Field label="Country">
            <input className="auf-input" value={draft.country} onChange={(e) => set({ country: e.target.value })} placeholder="Philippines" />
          </Field>
          <Field label="Alumni ID">
            <input className="auf-input" value={draft.alumniId} onChange={(e) => set({ alumniId: e.target.value })} placeholder="AUF-2018-000000" />
          </Field>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4">
        <EditorLabel>Summary</EditorLabel>
        <textarea
          className="auf-input resize-none"
          rows={3}
          value={draft.summary}
          onChange={(e) => set({ summary: e.target.value })}
          placeholder="A short professional summary."
        />
      </div>

      {/* Experience */}
      <RepeatSection label="Experience" onAdd={addExp}>
        {draft.experience.map((x, i) => (
          <RowShell key={i} onRemove={() => removeExp(i)}>
            <input className="auf-input" value={x.role} onChange={(e) => setExp(i, { role: e.target.value })} placeholder="Role / title" />
            <input className="auf-input" value={x.company} onChange={(e) => setExp(i, { company: e.target.value })} placeholder="Company" />
            <input className="auf-input" value={x.years} onChange={(e) => setExp(i, { years: e.target.value })} placeholder="2022 – Present" />
          </RowShell>
        ))}
      </RepeatSection>

      {/* Education */}
      <RepeatSection label="Education" onAdd={addEdu}>
        {draft.education.map((e, i) => (
          <RowShell key={i} onRemove={() => removeEdu(i)}>
            <input className="auf-input" value={e.degree} onChange={(ev) => setEdu(i, { degree: ev.target.value })} placeholder="Degree" />
            <input className="auf-input" value={e.program} onChange={(ev) => setEdu(i, { program: ev.target.value })} placeholder="Program" />
            <input className="auf-input" value={e.school} onChange={(ev) => setEdu(i, { school: ev.target.value })} placeholder="School" />
            <input className="auf-input" type="number" value={e.year} onChange={(ev) => setEdu(i, { year: Number(ev.target.value) })} placeholder="Year" />
          </RowShell>
        ))}
      </RepeatSection>

      {/* Skills */}
      <div className="mt-4">
        <EditorLabel>Skills</EditorLabel>
        <input
          className="auf-input"
          value={draft.skills.join(", ")}
          onChange={(e) =>
            set({ skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
          }
          placeholder="TypeScript, React, Leadership (comma-separated)"
        />
      </div>

      {/* Certifications */}
      <RepeatSection label="Certifications" onAdd={addCert}>
        {draft.certifications.map((c, i) => (
          <RowShell key={i} onRemove={() => removeCert(i)}>
            <input className="auf-input" value={c.name} onChange={(e) => setCert(i, { name: e.target.value })} placeholder="Certification" />
            <input className="auf-input" value={c.issuer} onChange={(e) => setCert(i, { issuer: e.target.value })} placeholder="Issuer" />
            <input className="auf-input" type="number" value={c.year} onChange={(e) => setCert(i, { year: Number(e.target.value) })} placeholder="Year" />
          </RowShell>
        ))}
      </RepeatSection>
    </div>
  );
}

function EditorLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide ink-3">
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] ink-2">{label}</span>
      {children}
    </label>
  );
}

function RepeatSection({
  label,
  onAdd,
  children,
}: {
  label: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <EditorLabel>{label}</EditorLabel>
        <button type="button" onClick={onAdd} className="auf-btn auf-btn-outline auf-btn-sm">
          <Plus size={13} /> Add
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RowShell({
  onRemove,
  children,
}: {
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border auf-hairline p-2">
      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="mt-1 rounded p-1 ink-3 hover:ink hover:bg-[var(--surface-2)]"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
