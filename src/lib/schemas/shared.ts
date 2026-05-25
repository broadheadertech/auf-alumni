import { z } from "zod";

export const PRIVACY_TIERS = ["public", "alumni", "connections", "private"] as const;
export const PrivacyTier = z.enum(PRIVACY_TIERS);
export type PrivacyTier = z.infer<typeof PrivacyTier>;

export const ROLES = [
  "alumnus-pending",
  "alumnus",
  "current-student",
  "partner-employer-admin",
  "verified-employer-admin",
  "moderator",
  "verifier",
  "super-admin",
] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

export const OPEN_TO_KINDS = ["mentorship", "hiring", "referrals", "speaking"] as const;
export const OpenToKind = z.enum(OPEN_TO_KINDS);
export type OpenToKind = z.infer<typeof OpenToKind>;

export const DEGREES = ["Undergraduate", "Graduate"] as const;
export const Degree = z.enum(DEGREES);
export type Degree = z.infer<typeof Degree>;

export const PROGRAMS = [
  "BS Information Technology",
  "BS Computer Science",
  "BS Business Administration",
  "BS Accountancy",
  "BS Nursing",
  "BS Architecture",
  "BS Psychology",
  "BS Civil Engineering",
] as const;
export const Program = z.enum(PROGRAMS);
export type Program = z.infer<typeof Program>;

export const EMPLOYER_TIERS = ["partner", "verified", "unverified"] as const;
export const EmployerTier = z.enum(EMPLOYER_TIERS);
export type EmployerTier = z.infer<typeof EmployerTier>;
