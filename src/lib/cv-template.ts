/**
 * AUF CV template — the official template the admin provides for alumni CVs.
 *
 * The admin configures branding, the verification watermark + seal, and which
 * sections are required / optional / hidden. Alumni generate their CV against
 * this config: required sections are always shown, optional ones are theirs to
 * toggle, hidden ones aren't offered.
 *
 * Prototype persistence: localStorage (key below) so an admin's edits flow to
 * the alumni generator without a backend. Swap load/save for Convex when wired.
 */

export type SectionPolicy = "required" | "optional" | "hidden";

export type CvSection =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "certifications";

export const CV_SECTIONS: { key: CvSection; label: string }[] = [
  { key: "contact", label: "Contact" },
  { key: "summary", label: "Summary" },
  { key: "experience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "skills", label: "Skills" },
  { key: "certifications", label: "Certifications" },
];

export type CvAccent = "navy" | "maroon" | "forest" | "charcoal";

export const CV_ACCENTS: Record<CvAccent, { label: string; hex: string }> = {
  navy: { label: "AUF Navy", hex: "#1f2d52" },
  maroon: { label: "Maroon", hex: "#5a1f2d" },
  forest: { label: "Forest", hex: "#1f4a36" },
  charcoal: { label: "Charcoal", hex: "#2b2b2f" },
};

export type CvTemplateConfig = {
  accent: CvAccent;
  orgName: string;
  subtitle: string;
  tagline: string;
  watermarkText: string;
  watermarkEnabled: boolean;
  sealEnabled: boolean;
  footerText: string;
  sections: Record<CvSection, SectionPolicy>;
};

export const DEFAULT_CV_TEMPLATE: CvTemplateConfig = {
  accent: "navy",
  orgName: "Angeles University Foundation",
  subtitle: "Alumni Network",
  tagline: "",
  watermarkText: "AUF · VERIFIED ALUMNUS",
  watermarkEnabled: true,
  sealEnabled: true,
  footerText: "Generated & verified by the AUF Alumni Network",
  sections: {
    contact: "required",
    summary: "optional",
    experience: "optional",
    education: "required",
    skills: "optional",
    certifications: "optional",
  },
};

const STORAGE_KEY = "auf-cv-template-v1";

/** Read the admin-provided template (falls back to default; SSR-safe). */
export function loadCvTemplate(): CvTemplateConfig {
  if (typeof window === "undefined") return DEFAULT_CV_TEMPLATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CV_TEMPLATE;
    const parsed = JSON.parse(raw) as Partial<CvTemplateConfig>;
    return {
      ...DEFAULT_CV_TEMPLATE,
      ...parsed,
      sections: { ...DEFAULT_CV_TEMPLATE.sections, ...(parsed.sections ?? {}) },
    };
  } catch {
    return DEFAULT_CV_TEMPLATE;
  }
}

export function saveCvTemplate(cfg: CvTemplateConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}
