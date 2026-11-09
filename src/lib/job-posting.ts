/**
 * Shared derivation for how a job posting reads.
 *
 * The board's detail pane and the standalone /jobs/[jobId] page each worked
 * this out for themselves, and drifted: the detail page rendered the
 * responsibilities / requirements / benefits an employer had entered, while the
 * board pane showed only the description blob and the skill chips. Alumni read
 * postings on the board, so the qualifications for the role were effectively
 * invisible.
 *
 * Both surfaces now derive their sections here. Styling still belongs to each
 * page (the board is shadcn, the detail page is the `auf-*` system) — only the
 * "what is in this posting" logic is shared.
 */

export type JobPostingFields = {
  description: string;
  responsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  skills?: string[];
  workMode?: string;
  experienceLevel?: string;
  closingAt?: number;
};

export const WORK_MODE_LABEL: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "Onsite",
};

export const EXPERIENCE_LABEL: Record<string, string> = {
  entry: "Entry level",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead / manager",
};

/** Pulls bullet-looking lines (-, *, •, numbered) out of a description blob. */
export function parseBullets(description: string): string[] {
  return description
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^([-*•]|\d+[.)])\s+/.test(l))
    .map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, ""));
}

export type JobPostingSections = {
  /** Chips: work mode, experience level, closing date. */
  roleMeta: string[];
  /** The prose overview with any bullet lines stripped out when they've been
   *  promoted into Key responsibilities, so they don't appear twice. */
  overview: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  skills: string[];
  /** False when the employer left every structured section empty. */
  hasDetail: boolean;
};

export function jobPostingSections(job: JobPostingFields): JobPostingSections {
  // Structured fields win. Fall back to parsing the description only for
  // legacy/seeded jobs posted before those fields existed.
  const parsed = parseBullets(job.description);
  const usedParsed = !job.responsibilities?.length && parsed.length > 0;
  const responsibilities = job.responsibilities?.length
    ? job.responsibilities
    : parsed.slice(0, 8);
  const requirements = job.requirements ?? [];
  const benefits = job.benefits ?? [];
  const skills = job.skills ?? [];

  const overview = usedParsed
    ? job.description
        .split(/\r?\n/)
        .filter((l) => !/^\s*([-*•]|\d+[.)])\s+/.test(l))
        .join("\n")
        .trim() || job.description
    : job.description;

  const roleMeta = [
    job.workMode ? WORK_MODE_LABEL[job.workMode] ?? job.workMode : null,
    job.experienceLevel
      ? EXPERIENCE_LABEL[job.experienceLevel] ?? job.experienceLevel
      : null,
    job.closingAt
      ? `Closes ${new Date(job.closingAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`
      : null,
  ].filter(Boolean) as string[];

  return {
    roleMeta,
    overview,
    responsibilities,
    requirements,
    benefits,
    skills,
    hasDetail:
      responsibilities.length > 0 ||
      requirements.length > 0 ||
      benefits.length > 0 ||
      skills.length > 0,
  };
}
