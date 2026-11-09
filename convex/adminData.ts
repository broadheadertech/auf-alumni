/**
 * Admin read models — the live replacement for `src/lib/mock-admin.ts`.
 *
 * Dashboard, Analytics, Employers, Job postings, Approvals and Events all read
 * from here, so every admin screen (and the lists, dropdowns and filters that
 * sit beside them) is computed from the same tables:
 *
 *   profiles · employerOrgs · jobs · applications · verificationSubmissions ·
 *   events · rsvps · colleges/programs (taxonomy)
 *
 * The return shapes deliberately mirror the old mock types (dates as ISO
 * strings, tier/status labels) so screens swap their data source without a
 * rewrite. College is always classified through the taxonomy tables.
 *
 * Admin-only: every query calls requireRole first.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireRole } from "./helpers/rbac";
import { getAuthUserId } from "@convex-dev/auth/server";
import { loadCollegeClassifier, type CollegeClassifier } from "./helpers/taxonomy";
import { accountStatusOf, type AccountStatusView } from "./accountStatus";

const ADMIN_ROLES = ["verifier", "moderator", "super-admin"] as const;
const DAY = 86_400_000;

/**
 * Registrar's estimate of total AUF alumni (registered or not). Not a table —
 * it's an external figure — but defined once here so every "of ~N" matches.
 */
export const ALUMNI_POPULATION_ESTIMATE = 8450;

/** Contract considered "expiring" within this many days of its end date. */
const CONTRACT_WARN_DAYS = 45;

export const STAGES = ["new", "screening", "interview", "offered", "hired", "not-selected"] as const;

/**
 * Optional client-supplied "now" for time-relative fields (upcoming events,
 * contract expiry, "this week"). Convex only re-runs a query when its args or
 * the data it read change, so a query that used Date.now() alone would go
 * stale as time passes. Clients pass a value rounded to a few minutes
 * (src/lib/use-as-of.ts) so results refresh on that cadence and stay cached
 * in between.
 */
const asOfArg = { asOf: v.optional(v.number()) };
const nowOf = (asOf: number | undefined) => asOf ?? Date.now();

// ---------------------------------------------------------------- helpers ---

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** "YYYY-MM-DDTHH:mm" in Manila time — matches datetime-local inputs. */
function manilaDateTime(ms: number): string {
  const d = new Date(ms + 8 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

function tierLabel(tier: string): "Partner" | "Verified" | "Unverified" {
  if (tier === "partner") return "Partner";
  if (tier === "verified") return "Verified";
  return "Unverified";
}

function postingStatus(
  status: string,
): "published" | "closed" | "pending-moderation" | "draft" | "rejected" {
  if (status === "published" || status === "pending-moderation" || status === "draft") return status;
  if (status === "suspended" || status === "rejected") return "rejected"; // jobs.rejectJob / soft-suspend
  return "closed";
}

const EMPLOYMENT_TYPE_LABEL: Record<string, "Full-time" | "Part-time" | "Contract" | "Internship"> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
};

function salaryLabel(job: Doc<"jobs">): string {
  const { salaryMin: min, salaryMax: max } = job;
  if (!min && !max) return "Salary not listed";
  const k = (n: number) => (n >= 1000 ? `₱${Math.round(n / 1000)}K` : `₱${n}`);
  if (min && max) return `${k(min)} – ${k(max)}`;
  return `${k((min ?? max) as number)}+`;
}

export function contractStateOf(
  contractEnd: string | undefined,
  now: number,
): "active" | "expiring" | "expired" | "none" {
  if (!contractEnd) return "none";
  const left = Math.round((new Date(contractEnd + "T00:00:00Z").getTime() - now) / DAY);
  if (left < 0) return "expired";
  if (left <= CONTRACT_WARN_DAYS) return "expiring";
  return "active";
}

/** Deterministic 0–100 fit between a job and a profile (skills + program). */
function matchScore(job: Doc<"jobs">, profile: Doc<"profiles"> | undefined): number {
  if (!profile) return 50;
  const wanted = [...(job.skills ?? []), ...(job.targetingSkills ?? [])].map((s) => s.toLowerCase());
  const have = new Set((profile.skills ?? []).map((s) => s.toLowerCase()));
  const skillFit = wanted.length ? wanted.filter((s) => have.has(s)).length / wanted.length : 0.5;
  const programFit = job.targetingPrograms?.length
    ? job.targetingPrograms.includes(profile.program)
      ? 1
      : 0
    : 0.5;
  return Math.round(40 + skillFit * 40 + programFit * 20);
}

type Loaded = {
  profiles: Doc<"profiles">[];
  profileByUser: Map<Id<"users">, Doc<"profiles">>;
  orgs: Doc<"employerOrgs">[];
  orgById: Map<Id<"employerOrgs">, Doc<"employerOrgs">>;
  jobs: Doc<"jobs">[];
  applications: Doc<"applications">[];
  collegeFor: CollegeClassifier;
};

async function loadMarketplace(ctx: QueryCtx): Promise<Loaded> {
  const [profiles, orgs, jobs, applications, collegeFor] = await Promise.all([
    // @no-privacy-required: admin-only aggregate/roster view; requireRole(ADMIN_ROLES) runs first in every caller.
    ctx.db.query("profiles").collect(),
    ctx.db.query("employerOrgs").collect(),
    ctx.db.query("jobs").collect(),
    ctx.db.query("applications").collect(),
    loadCollegeClassifier(ctx),
  ]);
  return {
    profiles,
    profileByUser: new Map(profiles.map((p) => [p.userId, p])),
    orgs,
    orgById: new Map(orgs.map((o) => [o._id, o])),
    jobs,
    applications,
    collegeFor,
  };
}

export type ApplicationRecord = {
  id: string;
  jobId: string;
  employerOrgId: string;
  company: string;
  jobTitle: string;
  applicantProfileId: string | null;
  applicantName: string;
  college: string;
  program: string;
  batch: number | null;
  appliedAt: string; // YYYY-MM-DD
  stage: (typeof STAGES)[number];
  hired: boolean;
  timeToHireDays: number | null;
};

function toRecords(m: Loaded): ApplicationRecord[] {
  const jobById = new Map(m.jobs.map((j) => [j._id, j]));
  const out: ApplicationRecord[] = [];
  for (const a of m.applications) {
    const job = jobById.get(a.jobId);
    if (!job) continue;
    const org = m.orgById.get(job.employerOrgId);
    const profile = m.profileByUser.get(a.applicantId);
    const hired = a.stage === "hired";
    const hiredAt = a.hiredAt ?? (hired ? a.stageChangedAt ?? a.updatedAt : undefined);
    out.push({
      id: a._id,
      jobId: job._id,
      employerOrgId: job.employerOrgId,
      company: org?.name ?? "—",
      jobTitle: job.title,
      applicantProfileId: profile?._id ?? null,
      applicantName: profile?.displayName ?? "Unknown applicant",
      college: profile ? m.collegeFor(profile.program) : "Unknown",
      program: profile?.program ?? "",
      batch: profile?.batch ?? null,
      appliedAt: isoDate(a.createdAt),
      stage: (STAGES as readonly string[]).includes(a.stage)
        ? (a.stage as ApplicationRecord["stage"])
        : "new",
      hired,
      timeToHireDays:
        hired && hiredAt ? Math.max(0, Math.round((hiredAt - a.createdAt) / DAY)) : null,
    });
  }
  return out.sort((x, y) => y.appliedAt.localeCompare(x.appliedAt));
}

// ------------------------------------------------------------ employers ---

export type PostingApplicantView = {
  applicationId: string;
  alumnaId: string | null; // profile id → /admin/alumni/[id]
  name: string;
  initials: string;
  college: string;
  program: string;
  batch: number | null;
  appliedAt: string;
  stage: ApplicationRecord["stage"];
  matchScore: number;
  hasCv: boolean;
  cvFilename: string | null;
  currentRole: string | null;
  topSkills: string[];
  reviewed: boolean;
};

export type PostingView = {
  id: string;
  title: string;
  location: string;
  employmentType: "Full-time" | "Part-time" | "Contract" | "Internship";
  status: "published" | "closed" | "pending-moderation" | "draft" | "rejected";
  postedAt: string;
  closesAt: string | null;
  salaryLabel: string;
  skills: string[];
  applicants: PostingApplicantView[];
};

export type EmployerDocView = { filename: string; sizeKb: number; uploadedAt: string; url: string | null };

export type EmployerView = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  description: string;
  industry: string;
  hqCity: string;
  websiteUrl: string;
  tier: "Partner" | "Verified" | "Unverified";
  contractStart: string | null;
  contractEnd: string | null;
  contractState: "active" | "expiring" | "expired" | "none";
  moa: EmployerDocView | null;
  nda: EmployerDocView | null;
  onboardedAt: string;
  suspended: boolean;
  accountStatus: AccountStatusView;
  postings: PostingView[];
};

async function docView(
  ctx: QueryCtx,
  doc: Doc<"employerOrgs">["moaDoc"],
): Promise<EmployerDocView | null> {
  if (!doc) return null;
  return {
    filename: doc.filename,
    sizeKb: doc.sizeKb,
    uploadedAt: doc.uploadedAt,
    url: doc.storageId ? await ctx.storage.getUrl(doc.storageId) : null,
  };
}

async function buildEmployers(
  ctx: QueryCtx,
  m: Loaded,
  now: number,
  only?: Id<"employerOrgs">,
): Promise<EmployerView[]> {
  const appsByJob = new Map<Id<"jobs">, Doc<"applications">[]>();
  for (const a of m.applications) {
    appsByJob.set(a.jobId, [...(appsByJob.get(a.jobId) ?? []), a]);
  }
  const out: EmployerView[] = [];
  for (const org of m.orgs) {
    if (only && org._id !== only) continue;
    const postings: PostingView[] = m.jobs
      .filter((j) => j.employerOrgId === org._id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((job) => ({
        id: job._id,
        title: job.title,
        location: job.location,
        employmentType: EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? "Full-time",
        status: postingStatus(job.status),
        postedAt: isoDate(job.publishedAt ?? job.createdAt),
        closesAt: job.closingAt ? isoDate(job.closingAt) : null,
        salaryLabel: salaryLabel(job),
        skills: job.skills ?? [],
        applicants: (appsByJob.get(job._id) ?? []).map((a) => {
          const p = m.profileByUser.get(a.applicantId);
          const name = p?.displayName ?? "Unknown applicant";
          return {
            applicationId: a._id,
            alumnaId: p?._id ?? null,
            name,
            initials: p?.initials ?? initialsOf(name),
            college: p ? m.collegeFor(p.program) : "Unknown",
            program: p?.program ?? "",
            batch: p?.batch ?? null,
            appliedAt: isoDate(a.createdAt),
            stage: ((STAGES as readonly string[]).includes(a.stage) ? a.stage : "new") as PostingApplicantView["stage"],
            matchScore: matchScore(job, p),
            hasCv: !!(a.resumeStorageId ?? p?.resumeStorageId),
            cvFilename: a.resumeFilename ?? p?.resumeFilename ?? null,
            currentRole: p?.currentRole ?? null,
            topSkills: (p?.skills ?? []).slice(0, 3),
            reviewed: a.reviewedAt != null,
          };
        }),
      }));
    out.push({
      id: org._id,
      slug: org.slug,
      name: org.name,
      initials: initialsOf(org.name),
      description: org.about ?? org.tagline ?? "",
      industry: org.industry ?? "",
      hqCity: org.hqCity ?? "",
      websiteUrl: org.websiteUrl ?? "",
      tier: tierLabel(org.tier),
      contractStart: org.contractStart ?? null,
      contractEnd: org.contractEnd ?? null,
      contractState: contractStateOf(org.contractEnd, now),
      moa: await docView(ctx, org.moaDoc),
      nda: await docView(ctx, org.ndaDoc),
      onboardedAt: isoDate(org.createdAt),
      suspended: org.suspendedAt != null,
      accountStatus: accountStatusOf(org),
      postings,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export const employers = query({
  args: asOfArg,
  handler: async (ctx, { asOf }): Promise<EmployerView[]> => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    return buildEmployers(ctx, await loadMarketplace(ctx), nowOf(asOf));
  },
});

export const employer = query({
  args: { id: v.string(), ...asOfArg },
  handler: async (ctx, { id, asOf }): Promise<EmployerView | null> => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const orgId = ctx.db.normalizeId("employerOrgs", id);
    if (!orgId) return null;
    const [view] = await buildEmployers(ctx, await loadMarketplace(ctx), nowOf(asOf), orgId);
    return view ?? null;
  },
});

/** One posting with its employer (sans postings) — admin job detail. */
export const posting = query({
  args: { id: v.string(), ...asOfArg },
  handler: async (ctx, { id, asOf }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const jobId = ctx.db.normalizeId("jobs", id);
    if (!jobId) return null;
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    const [emp] = await buildEmployers(ctx, await loadMarketplace(ctx), nowOf(asOf), job.employerOrgId);
    if (!emp) return null;
    const post = emp.postings.find((p) => p.id === job._id);
    if (!post) return null;
    const { postings: _postings, ...employer } = emp;
    void _postings;
    return {
      posting: {
        ...post,
        description: job.description,
        responsibilities: job.responsibilities ?? [],
        requirements: job.requirements ?? [],
        benefits: job.benefits ?? [],
        workMode: job.workMode ?? null,
        experienceLevel: job.experienceLevel ?? null,
        statusReason: job.statusReason ?? null,
      },
      employer,
    };
  },
});

// ------------------------------------------------------ application data ---

/** Every application as a flat record — Analytics, Dashboard, drill-downs. */
export const applicationRecords = query({
  args: {},
  handler: async (ctx): Promise<ApplicationRecord[]> => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    return toRecords(await loadMarketplace(ctx));
  },
});

/**
 * The signed-in employer's own application records (employer Analytics /
 * Reports). Scoped to orgs listing the user in adminUserIds; platform admins
 * may pass an org id.
 */
export const myEmployerRecords = query({
  args: { employerOrgId: v.optional(v.id("employerOrgs")) },
  handler: async (ctx, { employerOrgId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { orgs: [], records: [] as ApplicationRecord[] };
    const user = await ctx.db.get(userId);
    const roles = user?.roles ?? [];
    const isAdmin = roles.includes("super-admin") || roles.includes("moderator");
    const isEmployer =
      roles.includes("partner-employer-admin") || roles.includes("verified-employer-admin");
    if (!isAdmin && !isEmployer) return { orgs: [], records: [] as ApplicationRecord[] };
    const m = await loadMarketplace(ctx);
    const mine = m.orgs.filter((o) =>
      employerOrgId
        ? o._id === employerOrgId && (isAdmin || (o.adminUserIds ?? []).includes(userId))
        : (o.adminUserIds ?? []).includes(userId),
    );
    const ids = new Set(mine.map((o) => o._id as string));
    return {
      orgs: mine.map((o) => ({ id: o._id as string, name: o.name })),
      records: toRecords(m).filter((r) => ids.has(r.employerOrgId)),
    };
  },
});

// ------------------------------------------------------------- overview ---

export const overview = query({
  args: asOfArg,
  handler: async (ctx, { asOf }) => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const now = nowOf(asOf);
    const m = await loadMarketplace(ctx);
    const [pending, events, rsvps] = await Promise.all([
      ctx.db
        .query("verificationSubmissions")
        .withIndex("by_status_time", (q) => q.eq("status", "pending-review"))
        .collect(),
      ctx.db.query("events").collect(),
      ctx.db.query("rsvps").collect(),
    ]);

    const verified = m.profiles.filter((p) => p.verifiedAt != null);
    const tierCounts = { Partner: 0, Verified: 0, Unverified: 0 };
    let expiringContracts = 0;
    let expiredContracts = 0;
    for (const o of m.orgs) {
      tierCounts[tierLabel(o.tier)] += 1;
      const st = contractStateOf(o.contractEnd, now);
      if (st === "expiring") expiringContracts += 1;
      if (st === "expired") expiredContracts += 1;
    }

    // Verified registrations by month, last 6 calendar months (incl. current).
    const months: { key: string; count: number }[] = [];
    const cursor = new Date(now);
    cursor.setUTCDate(1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
      months.push({ key: d.toISOString().slice(0, 7), count: 0 });
    }
    for (const p of verified) {
      const key = isoDate(p.verifiedAt ?? p.createdAt).slice(0, 7);
      const bucket = months.find((mm) => mm.key === key);
      if (bucket) bucket.count += 1;
    }

    const count = (values: string[]) => {
      const map = new Map<string, number>();
      for (const val of values) map.set(val, (map.get(val) ?? 0) + 1);
      return [...map.entries()].map(([label, n]) => ({ label, count: n }));
    };

    const upcoming = events.filter((e) => !e.cancelledAt && e.startsAt >= now);
    const upcomingIds = new Set(upcoming.map((e) => e._id as string));

    return {
      asOf: now,
      alumniRegistered: verified.length,
      alumniProfiles: m.profiles.length,
      alumniPopulation: ALUMNI_POPULATION_ESTIMATE,
      openToWork: verified.filter((p) => p.openToWork).length,
      employers: m.orgs.length,
      activeEmployers: m.orgs.filter((o) =>
        m.jobs.some((j) => j.employerOrgId === o._id && j.status === "published"),
      ).length,
      tierCounts,
      postings: m.jobs.length,
      publishedPostings: m.jobs.filter((j) => j.status === "published").length,
      postingsToReview: m.jobs.filter((j) => j.status === "pending-moderation").length,
      pendingApprovals: pending.length,
      flaggedApprovals: pending.filter((s) => s.flags.length > 0).length,
      newRegistrationsThisWeek: m.profiles.filter((p) => p.createdAt >= now - 7 * DAY).length,
      expiringContracts,
      expiredContracts,
      upcomingEvents: upcoming.length,
      upcomingGoing: rsvps.filter((r) => r.status === "yes" && upcomingIds.has(r.eventId)).length,
      registrationTrend: months,
      alumniByCollege: count(verified.map((p) => m.collegeFor(p.program))).sort((a, b) => b.count - a.count),
      alumniByBatch: count(verified.map((p) => String(p.batch))).sort((a, b) => b.label.localeCompare(a.label)),
    };
  },
});

// ------------------------------------------------------------ approvals ---

export type PendingApprovalView = {
  id: string; // verificationSubmissions id
  userId: string;
  name: string;
  initials: string;
  email: string;
  claimedBatch: number;
  claimedProgram: string;
  college: string;
  city: string;
  submittedAt: string; // ISO datetime
  status: string;
  method: "School email" | "Registry match" | "ID upload" | "Diploma upload";
  registryMatched: boolean;
  registryConfidence: number | null;
  registryRecord: { name: string; batch: number; program: string } | null;
  flags: string[];
  idDoc: EmployerDocView | null;
  diplomaDoc: EmployerDocView | null;
  note: string | null;
};

async function storageDoc(
  ctx: QueryCtx,
  storageId: Id<"_storage"> | undefined,
  label: string,
  createdAt: number,
): Promise<EmployerDocView | null> {
  if (!storageId) return null;
  const meta = await ctx.db.system.get(storageId);
  const ext = meta?.contentType?.includes("pdf") ? "pdf" : meta?.contentType?.split("/")[1] ?? "file";
  return {
    filename: `${label}.${ext}`,
    sizeKb: meta ? Math.max(1, Math.round(meta.size / 1024)) : 0,
    uploadedAt: isoDate(createdAt),
    url: await ctx.storage.getUrl(storageId),
  };
}

/** Registrations awaiting review ("pending-review" + "info-requested" + "escalated"). */
export const pendingApprovals = query({
  args: {},
  handler: async (ctx): Promise<PendingApprovalView[]> => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const statuses = ["pending-review", "info-requested", "escalated"];
    const rows = (
      await Promise.all(
        statuses.map((s) =>
          ctx.db
            .query("verificationSubmissions")
            .withIndex("by_status_time", (q) => q.eq("status", s))
            .collect(),
        ),
      )
    ).flat();
    const collegeFor = await loadCollegeClassifier(ctx);
    const out: PendingApprovalView[] = [];
    for (const s of rows) {
      const user = await ctx.db.get(s.userId);
      // @no-privacy-required: admin verification review of the applicant's own submission; requireRole above.
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", s.userId))
        .unique();
      const snap = s.registryRecordSnapshot as
        | { name?: string; batch?: number; program?: string }
        | undefined;
      out.push({
        id: s._id,
        userId: s.userId,
        name: s.claimedName,
        initials: initialsOf(s.claimedName),
        email: user?.email ?? "—",
        claimedBatch: s.claimedBatch,
        claimedProgram: s.claimedProgram,
        college: collegeFor(s.claimedProgram),
        city: profile?.city ?? "",
        submittedAt: new Date(s.createdAt).toISOString(),
        status: s.status,
        method: s.idStorageId
          ? "ID upload"
          : s.diplomaStorageId
            ? "Diploma upload"
            : s.registryMatched
              ? "Registry match"
              : "School email",
        registryMatched: s.registryMatched,
        registryConfidence: s.registryConfidence ?? null,
        registryRecord:
          s.registryMatched && snap?.name
            ? { name: snap.name, batch: snap.batch ?? s.claimedBatch, program: snap.program ?? s.claimedProgram }
            : null,
        flags: s.flags,
        idDoc: await storageDoc(ctx, s.idStorageId, "alumni-id", s.createdAt),
        diplomaDoc: await storageDoc(ctx, s.diplomaStorageId, "diploma", s.createdAt),
        note: s.statusReason ?? null,
      });
    }
    return out.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  },
});

// --------------------------------------------------------------- events ---

export type EventAudienceView =
  | { kind: "everyone" }
  | { kind: "batch"; batches: number[] }
  | { kind: "program"; programs: string[] }
  | { kind: "batch-program"; batches: number[]; programs: string[] };

export type EventView = {
  id: string;
  title: string;
  description: string;
  category: string;
  startsAt: string; // "YYYY-MM-DDTHH:mm" Manila
  startsAtMs: number;
  location: string;
  onlineUrl: string | null;
  capacity: number | null;
  audience: EventAudienceView;
  /** Verified alumni the audience actually matches right now. */
  reach: number;
  rsvpYes: number;
  rsvpMaybe: number;
  rsvpWaitlist: number;
  rsvpCancelled: number;
  upcoming: boolean;
  cancelled: boolean;
  /** Shown to logged-out visitors on the marketing home page. */
  isPublic: boolean;
  createdAt: string;
};

async function buildEvents(ctx: QueryCtx, now: number, only?: Id<"events">): Promise<EventView[]> {
  const [events, rsvps, profiles] = await Promise.all([
    only ? ctx.db.get(only).then((e) => (e ? [e] : [])) : ctx.db.query("events").collect(),
    ctx.db.query("rsvps").collect(),
    // @no-privacy-required: admin-only audience reach count (batch/program only); requireRole in callers.
    ctx.db.query("profiles").collect(),
  ]);
  const verified = profiles.filter((p) => p.verifiedAt != null);
  return events
    .map((e) => {
      const batches = e.audienceFilter?.batches ?? [];
      const programs = e.audienceFilter?.programs ?? [];
      const audience: EventAudienceView =
        batches.length && programs.length
          ? { kind: "batch-program", batches, programs }
          : batches.length
            ? { kind: "batch", batches }
            : programs.length
              ? { kind: "program", programs }
              : { kind: "everyone" };
      const reach = verified.filter(
        (p) =>
          (!batches.length || batches.includes(p.batch)) &&
          (!programs.length || programs.includes(p.program)),
      ).length;
      const mine = rsvps.filter((r) => r.eventId === e._id);
      const n = (s: string) => mine.filter((r) => r.status === s).length;
      return {
        id: e._id,
        title: e.title,
        description: e.description,
        category: e.category ?? "other",
        startsAt: manilaDateTime(e.startsAt),
        startsAtMs: e.startsAt,
        location: e.locationLabel ?? (e.onlineUrl ? "Online" : "TBA"),
        onlineUrl: e.onlineUrl ?? null,
        capacity: e.capacity ?? null,
        audience,
        reach,
        rsvpYes: n("yes"),
        rsvpMaybe: n("maybe"),
        rsvpWaitlist: n("waitlist"),
        rsvpCancelled: n("cancelled"),
        upcoming: e.startsAt >= now && !e.cancelledAt,
        cancelled: e.cancelledAt != null,
        isPublic: e.isPublic === true,
        createdAt: isoDate(e.publishedAt),
      };
    })
    .sort((a, b) => a.startsAtMs - b.startsAtMs);
}

export const events = query({
  args: asOfArg,
  handler: async (ctx, { asOf }): Promise<EventView[]> => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    return buildEvents(ctx, nowOf(asOf));
  },
});

export const event = query({
  args: { id: v.string(), ...asOfArg },
  handler: async (ctx, { id, asOf }): Promise<EventView | null> => {
    await requireRole(ctx, [...ADMIN_ROLES]);
    const eventId = ctx.db.normalizeId("events", id);
    if (!eventId) return null;
    const [view] = await buildEvents(ctx, nowOf(asOf), eventId);
    return view ?? null;
  },
});
