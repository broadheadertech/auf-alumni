/**
 * V8-runtime helper for seedAccounts. The action in seedAccounts.ts must
 * `"use node"` to call Lucia's Scrypt; mutations can't live in node files,
 * so the DB upsert lives here.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Attach an employer-admin user to an employer org by slug. Used by
 * the demo seeder so the seeded `employer@demo.auf.local` account is
 * scoped to a single org (Kumu) rather than seeing every employer.
 */
export const linkEmployerAdmin = internalMutation({
  args: { userEmail: v.string(), orgSlug: v.string() },
  handler: async (
    ctx,
    { userEmail, orgSlug },
  ): Promise<{ ok: boolean; orgId?: Id<"employerOrgs">; reason?: string }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", userEmail))
      .unique();
    if (!user) return { ok: false, reason: "user-not-found" };
    const org = await ctx.db
      .query("employerOrgs")
      .withIndex("by_slug", (q) => q.eq("slug", orgSlug))
      .unique();
    if (!org) return { ok: false, reason: "org-not-found" };
    const existing = new Set(org.adminUserIds ?? []);
    if (!existing.has(user._id)) {
      await ctx.db.patch(org._id, {
        adminUserIds: [...existing, user._id],
        updatedAt: Date.now(),
      });
    }
    return { ok: true, orgId: org._id };
  },
});

/**
 * Ensure the employer has an org and one published IT job (for the demo).
 * Idempotent — reuses the org by slug and skips the job if it already exists.
 */
export const seedEmployerOrgAndJob = internalMutation({
  args: { employerEmail: v.string() },
  handler: async (ctx, { employerEmail }): Promise<{ ok: boolean; reason?: string }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", employerEmail))
      .unique();
    if (!user) return { ok: false, reason: "employer-user-not-found" };

    const now = Date.now();
    const slug = "broadheader";

    let org = await ctx.db
      .query("employerOrgs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org) {
      const orgId = await ctx.db.insert("employerOrgs", {
        name: "Broadheader",
        slug,
        tier: "partner",
        websiteUrl: "https://broadheader.com",
        hqCity: "Angeles City",
        planTier: "partner",
        jobPostsUsed: 0,
        adminUserIds: [user._id],
        createdAt: now,
        updatedAt: now,
      });
      org = await ctx.db.get(orgId);
    } else {
      const admins = new Set(org.adminUserIds ?? []);
      if (!admins.has(user._id)) {
        await ctx.db.patch(org._id, {
          adminUserIds: [...admins, user._id],
          updatedAt: now,
        });
      }
    }
    if (!org) return { ok: false, reason: "org-create-failed" };

    // Idempotency: skip if this org already has a job.
    const existingJob = await ctx.db
      .query("jobs")
      .withIndex("by_employer_time", (q) => q.eq("employerOrgId", org!._id))
      .first();
    if (existingJob) return { ok: true };

    await ctx.db.insert("jobs", {
      employerOrgId: org._id,
      title: "Junior Software Developer (IT Fresh Grad)",
      description:
        "We're hiring a Junior Software Developer to join our engineering team. " +
        "Great first role for a BS Information Technology graduate. You'll build " +
        "and maintain web features with React, TypeScript, and Node.js, write " +
        "clean code, and learn from senior engineers.\n\n" +
        "What we're looking for:\n" +
        "• BS Information Technology (or related) graduate\n" +
        "• Familiar with JavaScript/TypeScript, React, and REST APIs\n" +
        "• Basic SQL and Git\n" +
        "• Eager to learn, good communicator\n\n" +
        "Fresh graduates are welcome to apply.",
      location: "Angeles City · Hybrid",
      employmentType: "full-time",
      salaryMin: 30000,
      salaryMax: 45000,
      salaryCurrency: "PHP",
      targetingPrograms: ["BS Information Technology"],
      targetingSkills: ["JavaScript", "TypeScript", "React", "Node.js", "SQL"],
      aufOnly: true,
      status: "published",
      createdBy: user._id,
      createdAt: now,
      publishedAt: now,
    });

    await ctx.db.patch(org._id, { jobPostsUsed: (org.jobPostsUsed ?? 0) + 1 });
    return { ok: true };
  },
});

export const upsertDemoAccount = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    roles: v.array(v.string()),
    passwordHash: v.string(),
    alumnaProfile: v.union(
      v.null(),
      v.object({
        slug: v.string(),
        batch: v.number(),
        program: v.string(),
        degree: v.string(),
        currentRole: v.optional(v.string()),
        company: v.optional(v.string()),
        city: v.optional(v.string()),
        country: v.optional(v.string()),
        bio: v.optional(v.string()),
        skills: v.array(v.string()),
        openTo: v.array(v.string()),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ action: string; userId: Id<"users"> }> => {
    const now = Date.now();
    let action = "created";

    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    let userId: Id<"users">;
    if (existingUser) {
      userId = existingUser._id;
      await ctx.db.patch(userId, {
        name: args.name,
        roles: Array.from(
          new Set([...(existingUser.roles ?? []), ...args.roles]),
        ),
        consentAcknowledgedAt: existingUser.consentAcknowledgedAt ?? now,
        consentVersion: existingUser.consentVersion ?? "1.0",
      });
      action = "updated";
    } else {
      userId = await ctx.db.insert("users", {
        email: args.email,
        name: args.name,
        roles: args.roles,
        createdAt: now,
        consentAcknowledgedAt: now,
        consentVersion: "1.0",
        planTier: "free",
      });
    }

    const existingAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", args.email),
      )
      .unique();
    if (existingAccount) {
      await ctx.db.patch(existingAccount._id, { secret: args.passwordHash });
    } else {
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: args.email,
        secret: args.passwordHash,
      });
    }

    if (args.alumnaProfile) {
      const p = args.alumnaProfile;
      const existingProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      const initials = args.name
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s.charAt(0).toUpperCase())
        .join("");
      if (!existingProfile) {
        await ctx.db.insert("profiles", {
          userId,
          slug: p.slug,
          displayName: args.name,
          initials,
          batch: p.batch,
          program: p.program,
          degree: p.degree,
          currentRole: p.currentRole,
          company: p.company,
          city: p.city,
          country: p.country,
          bio: p.bio,
          skills: p.skills,
          openTo: p.openTo,
          experience:
            p.currentRole && p.company
              ? [
                  {
                    role: p.currentRole,
                    company: p.company,
                    years: `${p.batch} — Present`,
                  },
                ]
              : [],
          education: [
            {
              degree: p.degree,
              program: p.program,
              school: "Angeles University Foundation",
              year: p.batch,
            },
          ],
          privacyTiers: {
            // Must match DEFAULT_TIERS in the profile editor. A tier here for
            // a field that does not exist yet is a trap: it lies dormant and
            // then silently overrides the intended default the day someone
            // adds that field. "email" used to sit here for exactly that
            // reason and has been removed.
            phone: "connections",
            city: "public",
            country: "public",
            company: "connections",
            currentRole: "public",
            bio: "public",
            experience: "alumni",
            education: "public",
            skills: "public",
          },
          verifiedAt: now,
          createdAt: now,
          updatedAt: now,
          excludeFromSearchEngines: false,
        });
      }
    }

    return { action, userId };
  },
});
