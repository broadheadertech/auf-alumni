/**
 * Demo-account seeder. Run with:
 *
 *   npx convex run seedAccounts:run
 *
 * Creates three login-able accounts (alumna / employer / admin) by hashing
 * passwords with Lucia's Scrypt (the same primitive Convex Auth's Password
 * provider uses) and inserting rows into `users` + `authAccounts`.
 *
 * Idempotent — re-running upserts the password hash + roles.
 *
 * **NOT for production.** These credentials are checked into the repo via
 * the README/handoff doc; rotate immediately if this codebase is ever
 * deployed to a non-demo environment.
 */

"use node";

import { Scrypt } from "lucia";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

type DemoAccount = {
  key: "alumna" | "employer" | "admin";
  email: string;
  password: string;
  name: string;
  roles: string[];
  alumnaProfile?: {
    slug: string;
    batch: number;
    program: string;
    degree: string;
    currentRole?: string;
    company?: string;
    city?: string;
    country?: string;
    bio?: string;
    skills: string[];
    openTo: string[];
  };
};

const ACCOUNTS: DemoAccount[] = [
  {
    key: "alumna",
    email: "alumna@demo.auf.local",
    password: "DemoAlumna-2026-Pass",
    name: "Lara Mendoza",
    roles: ["alumnus"],
    alumnaProfile: {
      slug: "demo-alumna-lara",
      batch: 2021,
      program: "BS Information Technology",
      degree: "Bachelor of Science",
      currentRole: "Junior Frontend Developer",
      company: "HealthLink PH",
      city: "Angeles City",
      country: "Philippines",
      bio: "Demo alumna account for stakeholder review. Junior frontend engineer looking to grow into a senior IC role.",
      skills: ["React", "TypeScript", "Next.js", "Tailwind"],
      openTo: ["Mentorship", "Job referrals", "Freelance"],
    },
  },
  {
    key: "employer",
    email: "employer@demo.auf.local",
    password: "DemoEmployer-2026-Pass",
    name: "Kumu Hiring",
    roles: ["partner-employer-admin"],
  },
  {
    key: "admin",
    email: "admin@demo.auf.local",
    password: "DemoAdmin-2026-Pass",
    name: "AUF Demo Admin",
    roles: ["super-admin", "moderator", "verifier"],
  },
];

export const run = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{ key: string; email: string; password: string; action: string }>
  > => {
    const results: Array<{
      key: string;
      email: string;
      password: string;
      action: string;
    }> = [];
    for (const a of ACCOUNTS) {
      const hash = await new Scrypt().hash(a.password);
      const r = await ctx.runMutation(
        internal.seedAccountsHelpers.upsertDemoAccount,
        {
          email: a.email,
          name: a.name,
          roles: a.roles,
          passwordHash: hash,
          alumnaProfile: a.alumnaProfile ?? null,
        },
      );
      results.push({
        key: a.key,
        email: a.email,
        password: a.password,
        action: r.action,
      });
    }

    // Demo employer admins exactly one org (Kumu) so the picker is realistic.
    await ctx.runMutation(internal.seedAccountsHelpers.linkEmployerAdmin, {
      userEmail: "employer@demo.auf.local",
      orgSlug: "kumu",
    });
    return results;
  },
});
