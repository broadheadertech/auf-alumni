/**
 * One-shot: add a second published job under the Broadheader org.
 * Run with: npx convex run addJob:run
 * Idempotent — skips if a job with the same title already exists for the org.
 */

import { internalMutation } from "./_generated/server";

export const run = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; reason?: string }> => {
    const org = await ctx.db
      .query("employerOrgs")
      .withIndex("by_slug", (q) => q.eq("slug", "broadheader"))
      .unique();
    if (!org) return { ok: false, reason: "broadheader-org-not-found" };

    const title = "Frontend Web Developer (Fresh Grad)";
    const existing = await ctx.db
      .query("jobs")
      .withIndex("by_employer_time", (q) => q.eq("employerOrgId", org._id))
      .collect();
    if (existing.some((j) => j.title === title)) return { ok: true };

    const createdBy = (org.adminUserIds ?? [])[0];
    if (!createdBy) return { ok: false, reason: "org-has-no-admin" };

    const now = Date.now();
    await ctx.db.insert("jobs", {
      employerOrgId: org._id,
      title,
      description:
        "Join Broadheader as a Frontend Web Developer. A strong fit for a BS " +
        "Information Technology graduate who enjoys building polished user " +
        "interfaces. You'll ship features with React, TypeScript, and Tailwind, " +
        "collaborate on API integration, and care about accessibility and clean UI.\n\n" +
        "What we're looking for:\n" +
        "• BS Information Technology (or related) graduate\n" +
        "• React + TypeScript, HTML/CSS fundamentals\n" +
        "• Comfortable consuming REST APIs\n" +
        "• Eye for detail and good communication\n\n" +
        "Fresh graduates encouraged to apply.",
      location: "Angeles City · Onsite",
      employmentType: "full-time",
      salaryMin: 32000,
      salaryMax: 50000,
      salaryCurrency: "PHP",
      targetingPrograms: ["BS Information Technology"],
      targetingSkills: ["React", "TypeScript", "HTML/CSS", "Tailwind"],
      aufOnly: true,
      status: "published",
      createdBy,
      createdAt: now,
      publishedAt: now,
    });
    await ctx.db.patch(org._id, { jobPostsUsed: (org.jobPostsUsed ?? 0) + 1 });
    return { ok: true };
  },
});
