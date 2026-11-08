import { z } from "zod";
import { Degree, OpenToKind, PrivacyTier } from "./shared";

const CURRENT_YEAR = new Date().getFullYear();

const ExperienceEntry = z
  .object({
    role: z.string().min(1).max(200),
    company: z.string().min(1).max(200),
    // Display label. The server recomputes this from the structured fields
    // on write (convex/helpers/experience.ts), so it is allowed to be empty
    // here for a row that has a start date.
    years: z.string().max(50),
    startYear: z.number().int().min(1900).max(CURRENT_YEAR + 1).optional(),
    startMonth: z.number().int().min(1).max(12).optional(),
    endYear: z.number().int().min(1900).max(CURRENT_YEAR + 1).optional(),
    endMonth: z.number().int().min(1).max(12).optional(),
    current: z.boolean().optional(),
  })
  .strict()
  .refine((e) => e.startYear != null || e.years.trim().length > 0, {
    message: "Add the year you started",
  })
  .refine(
    (e) =>
      e.startYear == null ||
      e.current ||
      e.endYear == null ||
      e.endYear * 12 + ((e.endMonth ?? 12) - 1) >=
        e.startYear * 12 + ((e.startMonth ?? 1) - 1),
    { message: "The end date is before the start date" },
  );

const EducationEntry = z
  .object({
    degree: z.string().min(1).max(200),
    program: z.string().min(1).max(200),
    school: z.string().min(1).max(200),
    year: z
      .number()
      .int()
      .min(1960)
      .max(CURRENT_YEAR + 6), // allow future for OJT students
  })
  .strict();

/** Profile-edit input (Epic 3 Story 3.1). */
export const ProfileSchema = z
  .object({
    displayName: z.string().min(1).max(120),
    batch: z
      .number()
      .int()
      .min(1960, "Batch year out of range")
      .max(CURRENT_YEAR, "Batch year cannot be in the future"),
    // Program is admin-managed (see convex/taxonomy.ts) — validate as a
    // non-empty string rather than a fixed enum so newly-added programs pass.
    program: z.string().trim().min(1).max(120),
    degree: Degree,
    currentRole: z.string().max(200).optional(),
    company: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    country: z.string().max(120).optional(),
    bio: z.string().max(2000).optional(),
    skills: z.array(z.string().min(1).max(60)).max(30),
    openTo: z.array(OpenToKind).max(4),
    experience: z.array(ExperienceEntry).max(20),
    education: z.array(EducationEntry).max(10),
    privacyTiers: z.record(z.string(), PrivacyTier),
    excludeFromSearchEngines: z.boolean().default(false),
  })
  .strict();
export type ProfileInput = z.infer<typeof ProfileSchema>;
