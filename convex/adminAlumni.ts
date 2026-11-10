import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { withAuditLog } from "./helpers/audit";
import { loadCollegeClassifier } from "./helpers/taxonomy";
import { accountStatusOf } from "./accountStatus";
import type { Id } from "./_generated/dataModel";

/**
 * Admin alumni roster (Story 6.x support view).
 *
 * The live replacement for the mock `ALUMNAE` array that used to power
 * /admin/alumni. Everything here is real Convex data:
 *   - identity + employment fields come straight off the `profiles` table
 *   - each alumna's `applications` are joined from `applications` → `jobs` →
 *     `employerOrgs`
 *   - `workStatus` / `hired` are *derived* from application stages + the
 *     profile's open-to-work flag (there is no stored status column)
 *   - `college` is looked up from the admin-managed taxonomy (programs →
 *     colleges), the same tables every picker and filter uses. A keyword match
 *     is only a fallback for legacy free-text programs not in the taxonomy.
 *
 * Fields the mock invented with no backing store (EQ composite, certification
 * counts, skill endorsement weights) are intentionally dropped — the page no
 * longer shows them.
 */

type RosterApplication = {
  applicationId: string;
  jobTitle: string;
  company: string;
  stage: string;
};

export const listRoster = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["verifier", "moderator", "super-admin"]);

    // Load the joins once, then group in memory — prototype data volumes are
    // small and this avoids an N+1 across every profile.
    const [profiles, applications, jobs, orgs, collegeFor, users] = await Promise.all([
      // @no-privacy-required: admin-only roster; requireRole(verifier/moderator/super-admin) above.
      // @full-scan-ok: admin roster view joining four whole tables in one pass; paginating it is the real fix
      ctx.db.query("profiles").collect(),
      // @full-scan-ok: admin roster view joining four whole tables in one pass; paginating it is the real fix
      ctx.db.query("applications").collect(),
      // @full-scan-ok: admin roster view joining four whole tables in one pass; paginating it is the real fix
      ctx.db.query("jobs").collect(),
      // @full-scan-ok: admin roster view joining four whole tables in one pass; paginating it is the real fix
      ctx.db.query("employerOrgs").collect(),
      loadCollegeClassifier(ctx),
      // @full-scan-ok: admin roster view joining four whole tables in one pass; paginating it is the real fix
      ctx.db.query("users").collect(),
    ]);
    const userById = new Map(users.map((u) => [u._id, u]));

    const orgName = new Map(orgs.map((o) => [o._id, o.name]));
    const jobById = new Map(
      jobs.map((j) => [
        j._id,
        { title: j.title, company: orgName.get(j.employerOrgId) ?? "—" },
      ]),
    );

    const appsByApplicant = new Map<string, RosterApplication[]>();
    for (const a of applications) {
      const job = jobById.get(a.jobId);
      const list = appsByApplicant.get(a.applicantId) ?? [];
      list.push({
        applicationId: a._id,
        jobTitle: job?.title ?? "—",
        company: job?.company ?? "—",
        stage: a.stage,
      });
      appsByApplicant.set(a.applicantId, list);
    }

    const alumni = profiles.map((p) => {
      const apps = appsByApplicant.get(p.userId) ?? [];
      const hired = apps.some((a) => a.stage === "hired");
      const openToWork = !!p.openToWork;
      const workStatus = hired
        ? "Hired (via AUF)"
        : openToWork
          ? "Open to work"
          : p.currentRole || p.company
            ? "Employed"
            : "Not looking";

      return {
        id: p._id as string,
        slug: p.slug,
        name: p.displayName,
        initials: p.initials,
        batch: p.batch,
        program: p.program,
        college: collegeFor(p.program),
        city: p.city ?? "",
        employmentStatus: p.employmentStatus ?? null,
        currentRole: p.currentRole ?? null,
        currentCompany: p.company ?? null,
        openToWork,
        hired,
        workStatus,
        skills: p.skills ?? [],
        cv: !!p.resumeStorageId,
        verifiedAt: p.verifiedAt ?? null,
        accountStatus: accountStatusOf(userById.get(p.userId)),
        registeredAt: p.createdAt,
        applications: apps,
      };
    });

    const pendingCount = await ctx.db
      .query("verificationSubmissions")
      .withIndex("by_status_time", (q) => q.eq("status", "pending-review"))
      .collect()
      .then((r) => r.length);

    return { alumni, pendingCount };
  },
});

/**
 * Single-alumna drill-down for /admin/alumni/[alumniId]. Same real-data joins
 * as the roster, plus contact email (from `users`), a downloadable resume URL,
 * and full application history.
 */
export const getAlumna = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    await requireRole(ctx, ["verifier", "moderator", "super-admin"]);

    const pid = ctx.db.normalizeId("profiles", id);
    if (!pid) return null;
    const p = await ctx.db.get(pid);
    if (!p) return null;

    const user = await ctx.db.get(p.userId);
    const collegeFor = await loadCollegeClassifier(ctx);

    // This alumna's applications, joined to job + employer.
    // by_applicant_time is (applicantId, createdAt), so an eq on the first
    // field is a valid prefix -- this used to read every application in the
    // system to show one person's handful.
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_applicant_time", (q) => q.eq("applicantId", p.userId))
      .collect();
    const applications = [];
    for (const a of apps) {
      const job = await ctx.db.get(a.jobId);
      const org = job ? await ctx.db.get(job.employerOrgId) : null;
      applications.push({
        applicationId: a._id as string,
        jobTitle: job?.title ?? "—",
        company: org?.name ?? "—",
        employerOrgId: job?.employerOrgId ?? null,
        stage: a.stage,
        appliedAt: a.createdAt,
      });
    }
    applications.sort((x, y) => y.appliedAt - x.appliedAt);

    const hired = applications.some((a) => a.stage === "hired");
    const openToWork = !!p.openToWork;
    const workStatus = hired
      ? "Hired (via AUF)"
      : openToWork
        ? "Open to work"
        : p.currentRole || p.company
          ? "Employed"
          : "Not looking";

    return {
      id: p._id as string,
      slug: p.slug,
      name: p.displayName,
      initials: p.initials,
      batch: p.batch,
      program: p.program,
      degree: p.degree,
      college: collegeFor(p.program),
      city: p.city ?? "",
      country: p.country ?? "",
      employmentStatus: p.employmentStatus ?? null,
      email: user?.email ?? "—",
      currentRole: p.currentRole ?? null,
      currentCompany: p.company ?? null,
      bio: p.bio ?? null,
      openToWork,
      openToWorkNote: p.openToWorkNote ?? null,
      hired,
      workStatus,
      skills: p.skills ?? [],
      cv:
        p.resumeStorageId && p.resumeFilename
          ? {
              filename: p.resumeFilename,
              uploadedAt: p.resumeUploadedAt ?? null,
              url: await ctx.storage.getUrl(p.resumeStorageId),
            }
          : null,
      verifiedAt: p.verifiedAt ?? null,
      accountStatus: accountStatusOf(user),
      alumniId: p.alumniId ?? null,
      registeredAt: p.createdAt,
      applications,
    };
  },
});


/**
 * Admin override of an alumnus's employment status.
 *
 * Employment status was self-serve only: an alumnus set it from their own
 * profile and nobody else could touch it. That left the Alumni Relations
 * office unable to act on what it learns off-platform — a graduate who tells
 * a tracer-study caller they have been employed for a year, or who has
 * plainly moved on but never updated their profile. Since the status feeds
 * tracer-study reporting, a roster nobody can correct is a reporting problem
 * as much as an administrative one.
 *
 * The override is deliberately visible rather than silent: it goes through
 * withAuditLog like every other admin action, and `reason` is required so the
 * log says why, not just what.
 *
 * Passing an empty `status` clears it back to unset.
 */
export const setEmploymentStatus = mutation({
  args: {
    profileId: v.id("profiles"),
    status: v.string(),
    reason: v.string(),
  },
  handler: withAuditLog(
    async (
      ctx,
      {
        profileId,
        status,
        reason,
      }: { profileId: Id<"profiles">; status: string; reason: string },
    ) => {
      await requireRole(ctx, ["super-admin", "moderator"]);

      if (!reason || reason.trim().length === 0) {
        throw new ConvexError({
          code: "reason-required",
          message: "A reason is required when overriding employment status",
        });
      }

      const profile = await ctx.db.get(profileId);
      if (!profile) {
        throw new ConvexError({ code: "not-found", message: "Profile not found" });
      }

      const next = status.trim();
      if (next.length > 0) {
        // Only accept a value from the admin-managed status list, so an
        // override cannot introduce a status the filters and reports do not
        // know about.
        const allowed = await ctx.db
          .query("referenceItems")
          .withIndex("by_kind_sort", (q) => q.eq("kind", "status"))
          .collect();
        const match = allowed.find(
          (item) =>
            item.archivedAt == null &&
            item.name.toLowerCase() === next.toLowerCase(),
        );
        if (!match) {
          throw new ConvexError({
            code: "unknown-status",
            message: `"${next}" is not one of the configured employment statuses`,
          });
        }
      }

      const previous = profile.employmentStatus ?? null;
      await ctx.db.patch(profileId, {
        employmentStatus: next.length > 0 ? next : undefined,
        updatedAt: Date.now(),
      });

      return {
        action: "override-employment-status",
        target: { type: "profile", id: profileId },
        reason,
        metadata: {
          alumna: profile.displayName,
          from: previous,
          to: next.length > 0 ? next : null,
        },
      };
    },
  ),
});
