import { z } from "zod";
import { Degree, OpenToKind, PrivacyTier, Program } from "./shared";

const CURRENT_YEAR = new Date().getFullYear();

const ExperienceEntry = z
  .object({
    role: z.string().min(1).max(200),
    company: z.string().min(1).max(200),
    years: z.string().min(1).max(50),
  })
  .strict();

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
    program: Program,
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
