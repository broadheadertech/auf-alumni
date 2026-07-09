import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireRole } from "./helpers/rbac";

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
 *   - `college` is derived from the free-text `program` via keyword match,
 *     since the schema only stores `program`, not a college classification
 *
 * Fields the mock invented with no backing store (EQ composite, certification
 * counts, skill endorsement weights) are intentionally dropped — the page no
 * longer shows them.
 */

const COLLEGE_RULES: Array<[RegExp, string]> = [
  [/comput|informa|software|data sci|\bit\b|information tech/i, "College of Computer Studies"],
  [/engineer|architect/i, "College of Engineering & Architecture"],
  [/business|account|management|marketing|finance|entrep|commerce|economic/i, "College of Business & Accountancy"],
  [/nurs/i, "College of Nursing"],
  [/medic|pharmac|physical therapy|medical tech|radiolog|allied|therapy|dentis/i, "College of Allied Medical Professions"],
  [/educat|teaching|elementary|secondary/i, "College of Education"],
];

function collegeFor(program: string): string {
  for (const [re, college] of COLLEGE_RULES) {
    if (re.test(program)) return college;
  }
  return "College of Arts & Sciences";
}

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
    const [profiles, applications, jobs, orgs] = await Promise.all([
      ctx.db.query("profiles").collect(),
      ctx.db.query("applications").collect(),
      ctx.db.query("jobs").collect(),
      ctx.db.query("employerOrgs").collect(),
    ]);

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
        currentRole: p.currentRole ?? null,
        currentCompany: p.company ?? null,
        openToWork,
        hired,
        workStatus,
        skills: p.skills ?? [],
        cv: !!p.resumeStorageId,
        verifiedAt: p.verifiedAt ?? null,
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

    // This alumna's applications, joined to job + employer.
    const apps = (await ctx.db.query("applications").collect()).filter(
      (a) => a.applicantId === p.userId,
    );
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
      alumniId: p.alumniId ?? null,
      registeredAt: p.createdAt,
      applications,
    };
  },
});
