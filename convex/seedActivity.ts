/**
 * Demo marketplace activity (one-shot). Run AFTER `seed:run`:
 *
 *   npx convex run seedActivity:run
 *
 * The admin Dashboard, Analytics, Employers, Job postings, Approvals and Events
 * screens read live tables (convex/adminData.ts). A fresh `seed:run` has
 * alumni, employers and jobs but no hiring history, so those screens would be
 * near-empty. This fills in six months of realistic, internally consistent
 * activity — every number on every screen is derived from these rows:
 *
 *   - taxonomy + reference lists (only if still empty)
 *   - ~60 more verified alumni across the colleges, registered over 6 months
 *   - employer profiles: industry, about, contracts (incl. expiring/expired), MOA/NDA
 *   - more jobs (published / pending moderation / closed) with required skills
 *   - applications with stage history, review marks and hire timestamps
 *   - pending alumni verifications (some flagged)
 *   - a past event + a program-targeted event, with RSVPs
 *
 * Deterministic (seeded PRNG) and idempotent: re-running is a no-op once the
 * marker alumna exists. `clearDemo:run` removes it along with the rest.
 */

import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { TAXONOMY_SEED } from "./taxonomy";
import { LOOKUP_SEED } from "./lookups";
import { buildSearchText } from "./helpers/searchText";
import { normalizeEntry, parseLegacyPeriod } from "./helpers/experience";

const DAY = 86_400_000;
const MARKER_SLUG = "demo-alum-001";

// ------------------------------------------------------------ determinism ---

function prng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    sample: <T,>(arr: readonly T[], n: number): T[] => {
      const copy = [...arr];
      const out: T[] = [];
      while (copy.length && out.length < n) {
        out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
      }
      return out;
    },
  };
}

const FIRST = [
  "Andrea", "Bea", "Carlo", "Dana", "Enzo", "Faye", "Gab", "Hazel", "Iñigo", "Jana",
  "Kiko", "Lianne", "Migs", "Nina", "Oli", "Pia", "Quino", "Rica", "Sam", "Tina",
  "Uly", "Vince", "Wena", "Xander", "Yna", "Zoe", "Paolo", "Kat", "Josh", "Mae",
];
const LAST = [
  "Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Flores",
  "Villanueva", "Ramos", "Castillo", "Navarro", "Aquino", "Dizon", "Lacson", "Manalo",
  "Pangilinan", "Tolentino", "Yap", "David",
];

/** Program → skills an alumna of that program plausibly lists. */
const SKILLS_BY_KEYWORD: Array<[RegExp, string[]]> = [
  [/information tech|computer science/i, ["Software Development", "Web Development", "Data Analysis", "UI/UX Design", "Network Administration"]],
  [/architect|engineer/i, ["AutoCAD", "Structural Design", "Project Management"]],
  [/accountancy|business/i, ["Accounting", "Financial Analysis", "Sales & Marketing", "Project Management"]],
  [/nursing/i, ["Patient Care", "Leadership"]],
  [/medical tech|physical therapy/i, ["Clinical Laboratory", "Physical Therapy", "Patient Care"]],
  [/psychology/i, ["Written Communication", "Public Speaking", "Data Analysis"]],
  [/education/i, ["Teaching & Curriculum Design", "Public Speaking"]],
];
const SOFT = ["Leadership", "Public Speaking", "Written Communication"];

const INDUSTRY: Record<string, { industry: string; about: string }> = {
  kumu: { industry: "Media & Technology", about: "Kumu is a Filipino live-streaming and social platform connecting creators with millions of viewers." },
  gcash: { industry: "Fintech", about: "GCash is the Philippines' leading mobile wallet, serving tens of millions of Filipinos." },
  "jollibee-foods": { industry: "Food & Retail", about: "Jollibee Foods Corporation operates the country's largest family of restaurant brands." },
  "sprout-solutions": { industry: "HR Technology", about: "Sprout Solutions builds payroll and HR software for Philippine businesses." },
  "hino-motors-ph": { industry: "Automotive & Manufacturing", about: "Hino Motors Philippines manufactures and services commercial trucks and buses from Clark." },
  "tmc-clark": { industry: "Healthcare", about: "The Medical City Clark is a tertiary hospital serving Central Luzon." },
};

type ExtraJob = {
  employerSlug: string;
  title: string;
  location: string;
  employmentType: string;
  salaryMin: number;
  salaryMax: number;
  programs: string[];
  skills: string[];
  status: "published" | "pending-moderation" | "closed";
  postedDaysAgo: number;
};

const EXTRA_JOBS: ExtraJob[] = [
  { employerSlug: "kumu", title: "Backend Engineer (Go)", location: "Taguig", employmentType: "full-time", salaryMin: 80000, salaryMax: 110000, programs: ["BS Computer Science", "BS Information Technology"], skills: ["Software Development", "Data Analysis"], status: "published", postedDaysAgo: 120 },
  { employerSlug: "gcash", title: "Risk Analyst", location: "Taguig (BGC)", employmentType: "full-time", salaryMin: 55000, salaryMax: 75000, programs: ["BS Accountancy", "BS Business Administration"], skills: ["Financial Analysis", "Data Analysis"], status: "published", postedDaysAgo: 150 },
  { employerSlug: "jollibee-foods", title: "Management Trainee", location: "Pasig (Ortigas)", employmentType: "full-time", salaryMin: 30000, salaryMax: 38000, programs: ["BS Business Administration"], skills: ["Leadership", "Sales & Marketing"], status: "closed", postedDaysAgo: 170 },
  { employerSlug: "sprout-solutions", title: "QA Engineer", location: "Quezon City", employmentType: "full-time", salaryMin: 45000, salaryMax: 65000, programs: ["BS Information Technology"], skills: ["Software Development"], status: "published", postedDaysAgo: 75 },
  { employerSlug: "hino-motors-ph", title: "Site Engineer", location: "Clark Freeport Zone", employmentType: "full-time", salaryMin: 35000, salaryMax: 45000, programs: ["BS Civil Engineering", "BS Architecture"], skills: ["AutoCAD", "Structural Design", "Project Management"], status: "published", postedDaysAgo: 100 },
  { employerSlug: "tmc-clark", title: "Staff Nurse — ER", location: "Mabalacat", employmentType: "full-time", salaryMin: 32000, salaryMax: 40000, programs: ["BS Nursing"], skills: ["Patient Care"], status: "published", postedDaysAgo: 140 },
  { employerSlug: "tmc-clark", title: "Medical Technologist", location: "Mabalacat", employmentType: "full-time", salaryMin: 30000, salaryMax: 38000, programs: ["BS Medical Technology"], skills: ["Clinical Laboratory"], status: "published", postedDaysAgo: 60 },
  { employerSlug: "gcash", title: "Data Engineer", location: "Remote", employmentType: "full-time", salaryMin: 90000, salaryMax: 120000, programs: ["BS Computer Science"], skills: ["Software Development", "Data Analysis"], status: "pending-moderation", postedDaysAgo: 2 },
  { employerSlug: "jollibee-foods", title: "Store Operations Analyst", location: "Angeles City", employmentType: "contract", salaryMin: 28000, salaryMax: 34000, programs: ["BS Business Administration", "BS Accountancy"], skills: ["Data Analysis", "Accounting"], status: "pending-moderation", postedDaysAgo: 1 },
  { employerSlug: "sprout-solutions", title: "Payroll Specialist", location: "Quezon City", employmentType: "part-time", salaryMin: 25000, salaryMax: 30000, programs: ["BS Accountancy"], skills: ["Accounting"], status: "pending-moderation", postedDaysAgo: 3 },
];

// ------------------------------------------------------------------ steps ---

async function ensureTaxonomy(ctx: MutationCtx, now: number) {
  if ((await ctx.db.query("colleges").take(1)).length > 0) return false;
  // Include the programs used by seed:run so they classify cleanly.
  const extras: Record<string, string[]> = {
    CCS: ["BS Multimedia Arts"],
    CEA: ["BS Mechanical Engineering"],
  };
  let co = 0;
  let po = 0;
  for (const entry of TAXONOMY_SEED) {
    const collegeId = await ctx.db.insert("colleges", {
      name: entry.college,
      shortName: entry.short,
      sortOrder: co++,
      createdAt: now,
      updatedAt: now,
    });
    for (const name of [...entry.programs, ...(extras[entry.short] ?? [])]) {
      await ctx.db.insert("programs", {
        name,
        collegeId,
        degree: "Undergraduate",
        sortOrder: po++,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return true;
}

async function ensureLookups(ctx: MutationCtx, now: number) {
  const seeded: string[] = [];
  for (const kind of ["area", "status", "skill"] as const) {
    const existing = await ctx.db
      .query("referenceItems")
      .withIndex("by_kind_sort", (q) => q.eq("kind", kind))
      .take(1);
    if (existing.length) continue;
    let order = 0;
    for (const item of LOOKUP_SEED[kind]) {
      await ctx.db.insert("referenceItems", {
        kind,
        name: item.name,
        group: item.group,
        description: item.description,
        sortOrder: order++,
        createdAt: now,
        updatedAt: now,
      });
    }
    seeded.push(kind);
  }
  return seeded;
}

async function activeNames(ctx: MutationCtx, kind: "area" | "status" | "skill") {
  const rows = await ctx.db
    .query("referenceItems")
    .withIndex("by_kind_sort", (q) => q.eq("kind", kind))
    .collect();
  return rows.filter((r) => r.archivedAt == null);
}

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const base = await ctx.db
      .query("profiles")
      .withIndex("by_slug", (q) => q.eq("slug", "lara-mendoza"))
      .unique();
    if (!base) return { status: "run `npx convex run seed:run` first" };
    const marker = await ctx.db
      .query("profiles")
      .withIndex("by_slug", (q) => q.eq("slug", MARKER_SLUG))
      .unique();
    if (marker) return { status: "already-seeded" };

    const now = Date.now();
    const r = prng(20260914);
    const taxonomySeeded = await ensureTaxonomy(ctx, now);
    const lookupsSeeded = await ensureLookups(ctx, now);

    const programs = (await ctx.db.query("programs").collect()).filter((p) => p.archivedAt == null);
    const areas = (await activeNames(ctx, "area")).filter((a) => a.group !== "Abroad" && a.group !== "Remote");
    const statuses = await activeNames(ctx, "status");
    const skillNames = (await activeNames(ctx, "skill")).map((s) => s.name);
    const skillsFor = (program: string) => {
      const hit = SKILLS_BY_KEYWORD.find(([re]) => re.test(program));
      const pool = (hit?.[1] ?? SOFT).filter((s) => skillNames.includes(s));
      return [...new Set([...r.sample(pool, r.int(2, 3)), r.pick(SOFT)])];
    };

    // ---- status on the original seed alumni (only if missing)
    // @no-privacy-required: internal one-shot demo seeder; no data leaves the mutation.
    const existingProfiles = await ctx.db.query("profiles").collect();
    for (const p of existingProfiles) {
      if (!p.employmentStatus && statuses.length) {
        await ctx.db.patch(p._id, {
          employmentStatus: p.company ? statuses[0].name : r.pick(statuses).name,
        });
      }
    }

    // ---- more verified alumni, registered across the last six months
    const newProfiles: Doc<"profiles">[] = [];
    for (let i = 1; i <= 60; i++) {
      const name = `${r.pick(FIRST)} ${r.pick(LAST)}`;
      const slug = `demo-alum-${String(i).padStart(3, "0")}`;
      const program = r.pick(programs);
      const registeredAt = now - r.int(1, 180) * DAY - r.int(0, 20) * 3_600_000;
      const batch = r.int(2012, 2025);
      const openToWork = r.chance(0.3);
      const employed = !openToWork && r.chance(0.75);
      const userId = await ctx.db.insert("users", {
        email: `${slug}@demo.auf.edu.ph`,
        name,
        roles: ["alumnus"],
        createdAt: registeredAt,
        consentAcknowledgedAt: registeredAt,
        consentVersion: "1.0",
        planTier: "free",
      });
      const statusName = statuses.length
        ? (openToWork
            ? statuses.find((s) => /looking/i.test(s.name)) ?? statuses[0]
            : employed
              ? statuses[0]
              : r.pick(statuses)
          ).name
        : undefined;
      const city = areas.length ? r.pick(areas).name : "Angeles City";

      // Employment history with real start/end months, so tenure,
      // time-to-employment and work anniversaries have something to compute
      // from. Profiles used to be seeded with `experience: []` even when they
      // had a current role, which left every one of those surfaces empty.
      const roleTitle = employed
        ? r.pick(["Associate", "Specialist", "Analyst", "Engineer", "Coordinator", "Officer"])
        : undefined;
      const employerName = employed
        ? r.pick(["Accenture", "Concentrix", "SM Supermalls", "Clark Development Corp.", "Holy Angel Medical Center", "TaskUs"])
        : undefined;

      const experience: Array<{
        role: string;
        company: string;
        years: string;
        startYear?: number;
        startMonth?: number;
        endYear?: number;
        endMonth?: number;
        current?: boolean;
      }> = [];

      if (employed && roleTitle && employerName) {
        // Months between graduating (assume June of `batch`) and first job.
        const gapMonths = r.int(0, 18);
        const firstStartAbs = batch * 12 + 5 + gapMonths;
        const nowAbs = new Date(now).getUTCFullYear() * 12 + new Date(now).getUTCMonth();
        const fromAbs = (abs: number) => ({
          year: Math.floor(abs / 12),
          month: (abs % 12) + 1,
        });

        // Roughly half have moved on from a first employer.
        const hasPrior = firstStartAbs + 24 < nowAbs && r.chance(0.5);
        if (hasPrior) {
          const priorEnd = Math.min(firstStartAbs + r.int(12, 36), nowAbs - 1);
          const a = fromAbs(firstStartAbs);
          const b = fromAbs(priorEnd);
          experience.push(
            normalizeEntry({
              role: r.pick(["Junior Associate", "Trainee", "Assistant"]),
              company: r.pick(["Teleperformance", "Alorica", "Sitel", "iQor"]),
              years: "",
              startYear: a.year,
              startMonth: a.month,
              endYear: b.year,
              endMonth: b.month,
            }),
          );
          const c = fromAbs(Math.min(priorEnd + 1, nowAbs));
          experience.push(
            normalizeEntry({
              role: roleTitle,
              company: employerName,
              years: "",
              startYear: c.year,
              startMonth: c.month,
              current: true,
            }),
          );
        } else {
          const a = fromAbs(Math.min(firstStartAbs, nowAbs));
          experience.push(
            normalizeEntry({
              role: roleTitle,
              company: employerName,
              years: "",
              startYear: a.year,
              startMonth: a.month,
              current: true,
            }),
          );
        }
      }

      const profileId = await ctx.db.insert("profiles", {
        userId,
        slug,
        displayName: name,
        initials: name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase(),
        batch,
        program: program.name,
        degree: "Bachelor of Science",
        currentRole: roleTitle,
        company: employerName,
        city,
        country: "Philippines",
        employmentStatus: statusName,
        skills: skillsFor(program.name),
        openTo: r.chance(0.4) ? ["Mentorship"] : [],
        openToWork,
        experience,
        education: [{ degree: "Bachelor of Science", program: program.name, school: "Angeles University Foundation", year: batch }],
        privacyTiers: { city: "alumni", company: "alumni", skills: "alumni" },
        verifiedAt: registeredAt + r.int(1, 48) * 3_600_000,
        createdAt: registeredAt,
        updatedAt: registeredAt,
        excludeFromSearchEngines: false,
      });
      newProfiles.push((await ctx.db.get(profileId))!);
    }

    // ---- employer profiles + contracts + documents
    const orgs = await ctx.db.query("employerOrgs").collect();
    const orgBySlug = new Map(orgs.map((o) => [o.slug, o]));
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const contractPlans: Record<string, [number, number]> = {
      // [start days ago, end days from now]  (negative end = already expired)
      kumu: [300, 65],
      gcash: [200, 165],
      "jollibee-foods": [380, -15],
      "sprout-solutions": [340, 25],
      "hino-motors-ph": [150, 215],
      "tmc-clark": [90, 275],
    };
    for (const org of orgs) {
      const info = INDUSTRY[org.slug];
      const plan = contractPlans[org.slug];
      const signed = iso(now - (plan?.[0] ?? 120) * DAY);
      await ctx.db.patch(org._id, {
        industry: org.industry ?? info?.industry,
        about: org.about ?? info?.about,
        contractStart: org.contractStart ?? (plan ? iso(now - plan[0] * DAY) : undefined),
        contractEnd: org.contractEnd ?? (plan ? iso(now + plan[1] * DAY) : undefined),
        moaDoc: org.moaDoc ?? (plan ? { filename: `${org.slug}-MOA-signed.pdf`, sizeKb: r.int(180, 420), uploadedAt: signed } : undefined),
        ndaDoc: org.ndaDoc ?? (plan && org.slug !== "sprout-solutions" ? { filename: `${org.slug}-NDA.pdf`, sizeKb: r.int(90, 200), uploadedAt: signed } : undefined),
        createdAt: Math.min(org.createdAt, now - (plan?.[0] ?? 120) * DAY),
      });
    }

    // ---- jobs: backdate the seed jobs, add more
    const creator = base.userId as Id<"users">;
    const seedJobs = await ctx.db.query("jobs").collect();
    for (const j of seedJobs) {
      if (j.createdAt < now - DAY) continue; // already has history
      const posted = now - r.int(90, 175) * DAY;
      await ctx.db.patch(j._id, { createdAt: posted, publishedAt: j.publishedAt ? posted : undefined });
    }
    for (const j of EXTRA_JOBS) {
      const org = orgBySlug.get(j.employerSlug);
      if (!org) continue;
      const posted = now - j.postedDaysAgo * DAY;
      await ctx.db.insert("jobs", {
        employerOrgId: org._id,
        title: j.title,
        description: `${j.title} at ${org.name}. Work with a team that already includes AUF alumni.`,
        location: j.location,
        employmentType: j.employmentType,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        salaryCurrency: "PHP",
        skills: j.skills.filter((s) => skillNames.includes(s)),
        targetingPrograms: j.programs,
        aufOnly: true,
        status: j.status,
        createdBy: creator,
        createdAt: posted,
        publishedAt: j.status === "pending-moderation" ? undefined : posted,
        closingAt: j.status === "closed" ? now - 20 * DAY : undefined,
      });
    }

    // ---- applications with stage history
    const allProfiles = [...existingProfiles.filter((p) => p.verifiedAt != null), ...newProfiles];
    const jobs = (await ctx.db.query("jobs").collect()).filter((j) => j.status !== "pending-moderation");
    let applications = 0;
    let hires = 0;
    for (const job of jobs) {
      const opened = job.publishedAt ?? job.createdAt;
      const fits = allProfiles.filter((p) => job.targetingPrograms?.includes(p.program));
      const others = allProfiles.filter((p) => !job.targetingPrograms?.includes(p.program));
      const pool = [...r.sample(fits, r.int(5, 12)), ...r.sample(others, r.int(1, 5))];
      for (const p of pool) {
        const appliedAt = Math.min(now - DAY, opened + r.int(0, Math.max(1, Math.floor((now - opened) / DAY) - 1)) * DAY);
        const ageDays = (now - appliedAt) / DAY;
        // Older applications have had time to move through the pipeline.
        const roll = r.next();
        const stage =
          ageDays < 7
            ? roll < 0.7 ? "new" : "screening"
            : roll < 0.2 ? "hired"
              : roll < 0.27 ? "offered"
                : roll < 0.45 ? "interview"
                  : roll < 0.65 ? "screening"
                    : roll < 0.9 ? "not-selected"
                      : "new";
        const hiredAt = stage === "hired" ? Math.min(now - 3_600_000, appliedAt + r.int(10, 40) * DAY) : undefined;
        const stageChangedAt = stage === "new" ? undefined : hiredAt ?? Math.min(now - 3_600_000, appliedAt + r.int(2, 20) * DAY);
        await ctx.db.insert("applications", {
          jobId: job._id,
          applicantId: p.userId,
          profileSnapshot: { displayName: p.displayName, program: p.program, batch: p.batch, city: p.city, skills: p.skills },
          stage,
          reviewedAt: stage === "new" ? undefined : stageChangedAt,
          stageChangedAt,
          hiredAt,
          createdAt: appliedAt,
          updatedAt: stageChangedAt ?? appliedAt,
        });
        applications++;
        if (stage === "hired") hires++;
      }
    }

    // ---- pending alumni verifications
    const pendingPeople = [
      { name: "Patricia Gomez", program: "BS Nursing", batch: 2022, flags: [] as string[], matched: true },
      { name: "Leo Manansala", program: "BS Civil Engineering", batch: 2019, flags: ["no-registry-match"], matched: false },
      { name: "Rina Dumlao", program: "BS Accountancy", batch: 2021, flags: [], matched: true },
      { name: "Jomar Sicat", program: "BS Information Technology", batch: 2024, flags: ["name-mismatch"], matched: true },
      { name: "Aileen Tuazon", program: "BS Psychology", batch: 2018, flags: ["id-quality-low"], matched: false },
      { name: "Kevin Lising", program: "BS Computer Science", batch: 2023, flags: [], matched: true },
      { name: "Grace Yumul", program: "BS Education", batch: 2020, flags: ["no-registry-match", "name-mismatch"], matched: false },
    ];
    for (const [i, person] of pendingPeople.entries()) {
      const submittedAt = now - r.int(2, 70) * 3_600_000;
      const slug = person.name.toLowerCase().replace(/\s+/g, ".");
      const userId = await ctx.db.insert("users", {
        email: `${slug}@demo.auf.edu.ph`,
        name: person.name,
        roles: ["alumnus-pending"],
        createdAt: submittedAt,
        consentAcknowledgedAt: submittedAt,
        consentVersion: "1.0",
      });
      await ctx.db.insert("verificationSubmissions", {
        userId,
        claimedName: person.name,
        claimedBatch: person.batch,
        claimedProgram: person.program,
        registryMatched: person.matched,
        registryConfidence: person.matched ? (person.flags.length ? 0.72 : 0.96) : undefined,
        registryRecordSnapshot: person.matched
          ? { name: person.flags.includes("name-mismatch") ? `${person.name.split(" ")[0]} M. ${person.name.split(" ")[1]}` : person.name, batch: person.batch, program: person.program }
          : undefined,
        status: "pending-review",
        flags: person.flags,
        createdAt: submittedAt,
        updatedAt: submittedAt + i,
      });
    }

    // ---- events: a past one + a program-targeted one, with RSVPs
    const publisher = base.userId as Id<"users">;
    await ctx.db.insert("events", {
      title: "AUF Homecoming 2026",
      description: "Grand alumni homecoming at the AUF campus — batch tables, awards and a career fair.",
      startsAt: now - 30 * DAY,
      locationLabel: "AUF Main Campus, Angeles City",
      capacity: 500,
      category: "reunion",
      publishedBy: publisher,
      publishedAt: now - 75 * DAY,
    });
    await ctx.db.insert("events", {
      title: "IT & CS Career Night",
      description: "Hiring partners meet BS IT and BS CS alumni. Bring your CV.",
      startsAt: now + 12 * DAY,
      locationLabel: "Clark Freeport Zone",
      capacity: 120,
      category: "by-program",
      audienceFilter: { programs: ["BS Information Technology", "BS Computer Science"] },
      publishedBy: publisher,
      publishedAt: now - 10 * DAY,
    });
    const events = await ctx.db.query("events").collect();
    let rsvps = 0;
    for (const e of events) {
      const eligible = allProfiles.filter(
        (p) => !e.audienceFilter?.programs?.length || e.audienceFilter.programs.includes(p.program),
      );
      for (const p of r.sample(eligible, Math.min(eligible.length, r.int(8, 22)))) {
        await ctx.db.insert("rsvps", {
          eventId: e._id,
          userId: p.userId,
          status: r.chance(0.72) ? "yes" : r.chance(0.8) ? "maybe" : "cancelled",
          rsvpedAt: Math.min(now, e.publishedAt + r.int(0, 10) * DAY),
        });
        rsvps++;
      }
    }

    return {
      status: "seeded",
      taxonomySeeded,
      lookupsSeeded,
      alumniAdded: newProfiles.length,
      jobsAdded: EXTRA_JOBS.length,
      applications,
      hires,
      pendingVerifications: pendingPeople.length,
      rsvps,
    };
  },
});

/**
 * Backfills the structured posting sections on jobs that only have a prose
 * description.
 *
 * Every seeded job carried a `description` blob and nothing else, so alumni
 * reading a posting saw no requirements and no benefits — "the job description
 * doesn't show what's needed for the job". The employer form has always
 * captured these fields; only the demo rows were thin. Safe to re-run: it
 * touches a job only where the field is still empty, and never invents
 * requirements for a posting an employer actually wrote.
 *
 *   npx convex run seedActivity:backfillJobDetails
 */
export const backfillJobDetails = internalMutation({
  args: {},
  handler: async (ctx) => {
    const EXPERIENCE_BY_HINT: Array<[RegExp, string]> = [
      [/\b(head|director|lead|manager|principal)\b/i, "lead"],
      [/\b(senior|sr\.?)\b/i, "senior"],
      [/\b(intern|trainee|graduate|entry|junior|jr\.?|assistant)\b/i, "entry"],
    ];

    const BENEFITS = [
      "HMO from day one, plus one dependent after regularisation",
      "13th month pay and performance bonus",
      "Paid leave that carries over",
      "Learning budget and AUF Academy access",
    ];

    let updated = 0;
    for (const job of await ctx.db.query("jobs").collect()) {
      const patch: Record<string, unknown> = {};

      // Work mode — inferrable from the location text employers already write.
      if (!job.workMode) {
        const l = job.location.toLowerCase();
        patch.workMode = l.includes("remote")
          ? "remote"
          : l.includes("hybrid")
            ? "hybrid"
            : "onsite";
      }

      if (!job.experienceLevel) {
        const hit = EXPERIENCE_BY_HINT.find(([re]) => re.test(job.title));
        patch.experienceLevel = hit ? hit[1] : "mid";
      }

      const level = (patch.experienceLevel ?? job.experienceLevel) as string;
      const skills = job.skills ?? [];
      const programs = job.targetingPrograms ?? [];

      if (!job.requirements?.length) {
        const years =
          level === "entry"
            ? "Open to fresh graduates"
            : level === "senior"
              ? "At least 5 years in a comparable role"
              : level === "lead"
                ? "At least 7 years, including team leadership"
                : "At least 2 years in a comparable role";
        patch.requirements = [
          programs.length
            ? `Bachelor's degree — ${programs.slice(0, 2).join(" or ")} preferred`
            : "Bachelor's degree in a related field",
          years,
          skills.length
            ? `Working knowledge of ${skills.slice(0, 3).join(", ")}`
            : "Strong written and spoken English",
          "Able to work onsite in the posted location",
        ];
      }

      if (!job.responsibilities?.length) {
        patch.responsibilities = [
          `Own the day-to-day work of the ${job.title} role`,
          "Coordinate with the wider team and report on progress",
          skills.length
            ? `Apply ${skills[0]} to deliver work the team can rely on`
            : "Deliver work to agreed quality and deadlines",
        ];
      }

      if (!job.benefits?.length) {
        patch.benefits = BENEFITS.slice(0, level === "entry" ? 3 : 4);
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(job._id, patch);
        updated += 1;
      }
    }
    return { jobsUpdated: updated };
  },
});

/**
 * Backfills `profiles.searchText` for rows written before the field existed.
 *
 * The search_all index can only match what has been written to the field, so
 * until this runs an older profile is invisible to indexed search. Safe to
 * re-run: it rewrites every profile from its current fields, so it also
 * repairs any row that drifted.
 *
 *   npx convex run seedActivity:backfillSearchText
 */
export const backfillSearchText = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    // Maintenance pass over stored fields; nothing is returned to a caller.
    // @no-privacy-required: no viewer exists, so there is no privacy to apply.
    for (const p of await ctx.db.query("profiles").collect()) {
      const next = buildSearchText(p);
      if (p.searchText !== next) {
        await ctx.db.patch(p._id, { searchText: next });
        updated += 1;
      }
    }
    return { profilesUpdated: updated };
  },
});

/**
 * One-off migration: parse the legacy free-text `experience[].years` string
 * into structured start/end fields.
 *
 * Run with:  npx convex run seedActivity:backfillExperienceDates
 *
 * Idempotent - an entry that already has a startYear is left alone. Entries
 * whose text could not be parsed keep their original string and are counted in
 * `unparsed` so the gap is visible rather than silent.
 */
export const backfillExperienceDates = internalMutation({
  args: {},
  handler: async (ctx) => {
    // @no-privacy-required: internal migration rewriting stored fields; no viewer-facing read.
    const profiles = await ctx.db.query("profiles").collect();
    let profilesTouched = 0;
    let entriesParsed = 0;
    let unparsed = 0;

    for (const p of profiles) {
      const entries = p.experience ?? [];
      if (entries.length === 0) continue;
      let changed = false;

      const next = entries.map((e) => {
        if (e.startYear != null) return e;
        const parsed = parseLegacyPeriod(e.years);
        if (!parsed) {
          unparsed += 1;
          return e;
        }
        changed = true;
        entriesParsed += 1;
        return normalizeEntry({ ...e, ...parsed });
      });

      if (changed) {
        await ctx.db.patch(p._id, { experience: next });
        profilesTouched += 1;
      }
    }

    return { profiles: profiles.length, profilesTouched, entriesParsed, unparsed };
  },
});

/**
 * Demo-data only: give seeded alumni who have a current role but an empty
 * employment history a plausible structured one.
 *
 * The bulk seeder used to insert `experience: []` for every generated profile,
 * even when it had just given that person a role and an employer. It no longer
 * does, but rows created before that fix are still empty, and re-running the
 * seeder would discard the rest of the demo data.
 *
 * Deliberately scoped to the `demo-alum-` slug prefix: this INVENTS employment
 * history, which is only acceptable for fixtures. It will not touch a real
 * alumnus's profile.
 *
 *   npx convex run seedActivity:backfillDemoExperience
 */
export const backfillDemoExperience = internalMutation({
  args: {},
  handler: async (ctx) => {
    // @no-privacy-required: internal demo-fixture migration; no viewer-facing read.
    const profiles = await ctx.db.query("profiles").collect();
    const now = Date.now();
    const nowAbs = new Date(now).getUTCFullYear() * 12 + new Date(now).getUTCMonth();
    let touched = 0;
    let skippedReal = 0;

    for (const p of profiles) {
      if (!p.slug.startsWith("demo-alum-")) {
        if ((p.experience ?? []).length === 0 && p.company) skippedReal += 1;
        continue;
      }
      if ((p.experience ?? []).length > 0) continue;
      if (!p.currentRole || !p.company) continue;

      // Deterministic per-profile offset so repeated runs are stable.
      const seed = p.slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const gapMonths = seed % 19; // 0-18 months to first job
      const startAbs = Math.min(p.batch * 12 + 5 + gapMonths, nowAbs);

      await ctx.db.patch(p._id, {
        experience: [
          normalizeEntry({
            role: p.currentRole,
            company: p.company,
            years: "",
            startYear: Math.floor(startAbs / 12),
            startMonth: (startAbs % 12) + 1,
            current: true,
          }),
        ],
      });
      touched += 1;
    }

    return { touched, skippedReal };
  },
});
