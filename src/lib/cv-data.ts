/**
 * Alumna CV data — the editable content that fills the AUF CV template.
 *
 * The generator reads: the alumna's saved edits (this store) if present,
 * otherwise the live Convex profile, otherwise a demo. Editing writes an
 * override here so alumni can add/adjust every field (basic details, summary,
 * experience, education, skills, certifications) without a backend.
 *
 * Prototype persistence: localStorage. Swap for a Convex profile mutation
 * when wired.
 */

export type CvExperience = { role: string; company: string; years: string };
export type CvEducation = {
  degree: string;
  program: string;
  school: string;
  year: number;
};
export type CvCertification = { name: string; issuer: string; year: number };

export type CvData = {
  name: string;
  title: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  summary: string;
  experience: CvExperience[];
  education: CvEducation[];
  skills: string[];
  certifications: CvCertification[];
  alumniId: string;
};

export const EMPTY_CV: CvData = {
  name: "",
  title: "",
  email: "",
  phone: "",
  city: "",
  country: "",
  summary: "",
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  alumniId: "Pending verification",
};

export const DEMO_CV: CvData = {
  name: "Maria Santos",
  title: "Senior Software Engineer · Globe Telecom",
  email: "maria.santos@auf.edu.ph",
  phone: "+63 917 555 0101",
  city: "Manila",
  country: "Philippines",
  summary:
    "AUF Information Technology '18. Senior engineer leading a platform team at Globe Telecom. Strong in TypeScript, React, and system design, with a track record of mentoring junior engineers into backend and platform roles.",
  experience: [
    { role: "Senior Software Engineer", company: "Globe Telecom", years: "2022 – Present" },
    { role: "Software Engineer", company: "Kalibrr", years: "2019 – 2022" },
    { role: "Junior Developer", company: "Accenture", years: "2018 – 2019" },
  ],
  education: [
    { degree: "BS Information Technology", program: "Information Technology", school: "Angeles University Foundation", year: 2018 },
  ],
  skills: ["TypeScript", "React", "Node.js", "AWS", "System Design", "Mentoring"],
  certifications: [
    { name: "AWS Solutions Architect – Associate", issuer: "Amazon Web Services", year: 2023 },
    { name: "Professional Scrum Master I", issuer: "Scrum.org", year: 2021 },
  ],
  alumniId: "AUF-2018-004821",
};

const STORAGE_KEY = "auf-cv-data-v1";

/** The alumna's saved CV override, or null if they haven't edited. */
export function loadCvOverride(): CvData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CvData) : null;
  } catch {
    return null;
  }
}

export function saveCvOverride(data: CvData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearCvOverride(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
