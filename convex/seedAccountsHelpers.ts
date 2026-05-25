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
            email: "alumni",
            phone: "alumni",
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
