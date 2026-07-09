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
    key: "admin",
    email: "tech@broadheader.com",
    password: "@Broadheader_8080",
    name: "Broadheader Admin",
    roles: ["super-admin", "moderator", "verifier"],
  },
  {
    key: "alumna",
    email: "bellojaezarjohn@broadheader.com",
    password: "@Broadheader_8080",
    name: "Jaezar John Bello",
    roles: ["alumnus"],
    alumnaProfile: {
      slug: "jaezar-bello",
      batch: 2024,
      program: "BS Information Technology",
      degree: "Bachelor of Science",
      currentRole: "IT Graduate",
      company: undefined,
      city: "Angeles City",
      country: "Philippines",
      bio: "BS Information Technology graduate looking for a first software role. Comfortable across the web stack and eager to grow.",
      skills: [
        "JavaScript",
        "TypeScript",
        "React",
        "Node.js",
        "SQL",
        "Git",
        "HTML/CSS",
      ],
      openTo: ["Job referrals", "Mentorship"],
    },
  },
  {
    key: "employer",
    email: "employer@demo.auf.local",
    password: "Demo1234",
    name: "Broadheader Hiring",
    roles: ["partner-employer-admin"],
  },
  {
    key: "employer",
    email: "employer@broadheader.com",
    password: "@Broadheader_8080",
    name: "Broadheader Recruiter",
    roles: ["partner-employer-admin"],
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

    // Give the employer an org + one published IT job.
    await ctx.runMutation(internal.seedAccountsHelpers.seedEmployerOrgAndJob, {
      employerEmail: "employer@demo.auf.local",
    });
    // Affiliate the Broadheader employer account with the same org.
    await ctx.runMutation(internal.seedAccountsHelpers.linkEmployerAdmin, {
      userEmail: "employer@broadheader.com",
      orgSlug: "broadheader",
    });
    return results;
  },
});
