/**
 * Demo seed (one-shot). Run with:
 *
 *   npx convex run seed:run
 *
 * Idempotent — re-running checks for a marker profile (slug = "lara-mendoza")
 * and returns early. Populates:
 *
 *   - ~10 verified alumni (no auth — directory ghosts)
 *   - 6 employer orgs (Partner + Verified tiers)
 *   - 6 published jobs across those employers
 *   - 2 upcoming events
 *   - 3 feed posts (incl. one referral, one milestone)
 *   - A handful of connections between the seeded alumni
 *
 * Used to make the AUF stakeholder demo show real content instead of empty
 * lists. Not called by any cron — strictly manual.
 */

import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ALUMNI_SEEDS: Array<{
  slug: string;
  name: string;
  email: string;
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
}> = [
  {
    slug: "lara-mendoza",
    name: "Lara Mendoza",
    email: "lara.mendoza@demo.auf.edu.ph",
    batch: 2021,
    program: "BS Information Technology",
    degree: "Bachelor of Science",
    currentRole: "Junior Frontend Developer",
    company: "HealthLink PH",
    city: "Angeles City",
    country: "Philippines",
    bio: "Junior frontend engineer with 1.5 years in production React. Looking to move into a product-led team where I can grow into a senior IC over the next 2 years.",
    skills: ["React", "TypeScript", "Next.js", "Tailwind", "Accessibility"],
    openTo: ["Mentorship", "Job referrals", "Freelance"],
  },
  {
    slug: "anjelica-pineda",
    name: "Anjelica Pineda",
    email: "anjelica.p@demo.auf.edu.ph",
    batch: 2021,
    program: "BS Information Technology",
    degree: "Bachelor of Science",
    currentRole: "Senior Frontend Engineer",
    company: "Kumu",
    city: "Taguig",
    country: "Philippines",
    bio: "Sr. Frontend at Kumu. Open to refer fellow AUF alumni — DM before you apply.",
    skills: ["React", "TypeScript", "Live-streaming", "WebRTC"],
    openTo: ["Refer"],
  },
  {
    slug: "mark-lim",
    name: "Mark Lim",
    email: "mark.lim@demo.auf.edu.ph",
    batch: 2019,
    program: "BS Multimedia Arts",
    degree: "Bachelor of Science",
    currentRole: "Product Designer",
    company: "GCash",
    city: "Manila",
    country: "Philippines",
    bio: "Designing payment flows used by 80M+ Filipinos. Happy to share my path from AUF to GCash.",
    skills: ["Figma", "Product Design", "Fintech", "B2C"],
    openTo: ["Mentorship", "Refer"],
  },
  {
    slug: "marvin-cabrera",
    name: "Marvin Cabrera",
    email: "marvin.c@demo.auf.edu.ph",
    batch: 2019,
    program: "BS Nursing",
    degree: "Bachelor of Science",
    currentRole: "Nursing Coordinator",
    company: "The Medical City Clark",
    city: "Mabalacat",
    country: "Philippines",
    bio: "ICU coordinator at TMC Clark. Host shadowing days for BSN seniors — DM me to join the next batch.",
    skills: ["Critical Care", "Team Lead", "Healthcare Ops"],
    openTo: ["Mentorship", "Refer"],
  },
  {
    slug: "carla-jimenez",
    name: "Carla Jimenez",
    email: "carla.j@demo.auf.edu.ph",
    batch: 2018,
    program: "BS Accountancy",
    degree: "Bachelor of Science",
    currentRole: "Senior Data Analyst",
    company: "Jollibee Foods Corp.",
    city: "Pasig",
    country: "Philippines",
    bio: "Build analytics that powers the Philippines' largest restaurant brand.",
    skills: ["SQL", "Tableau", "Python", "Finance"],
    openTo: ["Mentorship"],
  },
  {
    slug: "rico-punzalan",
    name: "Rico Punzalan",
    email: "rico.p@demo.auf.edu.ph",
    batch: 2023,
    program: "BS Mechanical Engineering",
    degree: "Bachelor of Science",
    currentRole: "Project Engineer",
    company: "Hino Motors PH",
    city: "Clark",
    country: "Philippines",
    bio: "ME at Hino. AUF Engineering '23.",
    skills: ["Mechanical Design", "CAD", "Manufacturing"],
    openTo: ["Refer"],
  },
  {
    slug: "trish-aguilar",
    name: "Trish Aguilar",
    email: "trish.a@demo.auf.edu.ph",
    batch: 2020,
    program: "BS Psychology",
    degree: "Bachelor of Science",
    currentRole: "Customer Success Lead",
    company: "Sprout Solutions",
    city: "Quezon City",
    country: "Philippines",
    bio: "Leading a team of 5 CSMs at Sprout. Hiring directly — DM me if you're keen.",
    skills: ["SaaS", "HR Tech", "Customer Success"],
    openTo: ["Mentorship", "Refer"],
  },
  {
    slug: "paolo-santos",
    name: "Paolo Santos",
    email: "paolo.s@demo.auf.edu.ph",
    batch: 2017,
    program: "BS Architecture",
    degree: "Bachelor of Science",
    currentRole: "Design Lead",
    company: "GCash",
    city: "Remote",
    country: "Philippines",
    bio: "Design lead at GCash. Mentor for AUF MMA + Architecture grads.",
    skills: ["Design Systems", "Leadership", "Fintech"],
    openTo: ["Mentorship"],
  },
  {
    slug: "rhea-sotto",
    name: "Rhea Sotto",
    email: "rhea.s@demo.auf.edu.ph",
    batch: 2022,
    program: "BS Computer Science",
    degree: "Bachelor of Science",
    currentRole: "Backend Engineer",
    company: "Kumu",
    city: "Taguig",
    country: "Philippines",
    bio: "Backend at Kumu — open to referrals for ENG roles on my team.",
    skills: ["Go", "Postgres", "Distributed Systems"],
    openTo: ["Refer"],
  },
  {
    slug: "jojo-tan",
    name: "Jojo Tan",
    email: "jojo.t@demo.auf.edu.ph",
    batch: 2020,
    program: "BS Information Technology",
    degree: "Bachelor of Science",
    currentRole: "Frontend Engineer",
    company: "Kumu",
    city: "Taguig",
    country: "Philippines",
    bio: "Frontend engineer at Kumu — work alongside Anjelica.",
    skills: ["React", "Vue", "Performance"],
    openTo: ["Mentorship"],
  },
];

const EMPLOYER_SEEDS: Array<{
  slug: string;
  name: string;
  tier: "partner" | "verified";
  websiteUrl: string;
  hqCity: string;
  planTier: string;
}> = [
  { slug: "kumu", name: "Kumu", tier: "partner", websiteUrl: "https://kumu.ph", hqCity: "Taguig", planTier: "partner-free" },
  { slug: "gcash", name: "GCash", tier: "partner", websiteUrl: "https://gcash.com", hqCity: "Manila", planTier: "partner-free" },
  { slug: "jollibee-foods", name: "Jollibee Foods Corp.", tier: "verified", websiteUrl: "https://jfc.com.ph", hqCity: "Pasig", planTier: "growth" },
  { slug: "sprout-solutions", name: "Sprout Solutions", tier: "verified", websiteUrl: "https://sprout.ph", hqCity: "Quezon City", planTier: "starter" },
  { slug: "hino-motors-ph", name: "Hino Motors PH", tier: "partner", websiteUrl: "https://hino.com.ph", hqCity: "Clark", planTier: "partner-free" },
  { slug: "tmc-clark", name: "The Medical City Clark", tier: "partner", websiteUrl: "https://themedicalcity.com", hqCity: "Mabalacat", planTier: "partner-free" },
];

type JobSeed = {
  employerSlug: string;
  title: string;
  description: string;
  location: string;
  employmentType: string;
  salaryMin?: number;
  salaryMax?: number;
  targetingPrograms?: string[];
};

const JOB_SEEDS: JobSeed[] = [
  {
    employerSlug: "kumu",
    title: "Frontend Engineer",
    description:
      "Build the next generation of live-streaming UX for Kumu's web platform. Ship features across web (Next.js) and our component library.",
    location: "Taguig, NCR · Hybrid",
    employmentType: "full-time",
    salaryMin: 70000,
    salaryMax: 95000,
    targetingPrograms: ["BS Information Technology", "BS Computer Science"],
  },
  {
    employerSlug: "gcash",
    title: "Product Designer (Mid)",
    description:
      "Design payment flows used by 80M+ Filipinos. Tight design crit culture; we ship weekly.",
    location: "Remote · Philippines",
    employmentType: "full-time",
    salaryMin: 90000,
    salaryMax: 130000,
    targetingPrograms: ["BS Multimedia Arts", "BS Information Technology"],
  },
  {
    employerSlug: "jollibee-foods",
    title: "Data Analyst",
    description:
      "Join the analytics team behind the Philippines' largest restaurant brand. SQL + Tableau day-to-day.",
    location: "Pasig, NCR · On-site",
    employmentType: "full-time",
    salaryMin: 45000,
    salaryMax: 60000,
    targetingPrograms: ["BS Accountancy", "BS Computer Science"],
  },
  {
    employerSlug: "sprout-solutions",
    title: "Customer Success Lead",
    description: "Lead a team of 5 CSMs supporting enterprise HR clients.",
    location: "Quezon City · Hybrid",
    employmentType: "full-time",
    salaryMin: 60000,
    salaryMax: 80000,
  },
  {
    employerSlug: "hino-motors-ph",
    title: "Mechanical Engineering Intern",
    description: "10-week summer internship for graduating ME students.",
    location: "Clark, Pampanga · On-site",
    employmentType: "internship",
    salaryMin: 22000,
    salaryMax: 22000,
    targetingPrograms: ["BS Mechanical Engineering"],
  },
  {
    employerSlug: "tmc-clark",
    title: "Nursing Coordinator",
    description:
      "Coordinate ICU staffing for the 200-bed Clark facility. BSN + 3yrs critical-care required.",
    location: "Mabalacat, Pampanga · On-site",
    employmentType: "full-time",
    salaryMin: 48000,
    salaryMax: 58000,
    targetingPrograms: ["BS Nursing"],
  },
];

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Idempotency guard
    const marker = await ctx.db
      .query("profiles")
      .withIndex("by_slug", (q) => q.eq("slug", "lara-mendoza"))
      .unique();
    if (marker) {
      return { status: "already-seeded", existingMarker: marker._id };
    }

    const now = Date.now();
    const userIdBySlug = new Map<string, Id<"users">>();
    const profileIdBySlug = new Map<string, Id<"profiles">>();
    const employerIdBySlug = new Map<string, Id<"employerOrgs">>();

    // -------- alumni (users + profiles) --------
    for (const a of ALUMNI_SEEDS) {
      const userId = await ctx.db.insert("users", {
        email: a.email,
        name: a.name,
        roles: ["alumnus"],
        createdAt: now,
        consentAcknowledgedAt: now,
        consentVersion: "1.0",
        planTier: "free",
      });
      userIdBySlug.set(a.slug, userId);

      const initials = a.name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("");

      const profileId = await ctx.db.insert("profiles", {
        userId,
        slug: a.slug,
        displayName: a.name,
        initials,
        batch: a.batch,
        program: a.program,
        degree: a.degree,
        currentRole: a.currentRole,
        company: a.company,
        city: a.city,
        country: a.country,
        bio: a.bio,
        skills: a.skills,
        openTo: a.openTo,
        experience: a.currentRole && a.company
          ? [
              {
                role: a.currentRole,
                company: a.company,
                years: `${a.batch} — Present`,
              },
            ]
          : [],
        education: [
          {
            degree: a.degree,
            program: a.program,
            school: "Angeles University Foundation",
            year: a.batch,
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
      profileIdBySlug.set(a.slug, profileId);
    }

    // -------- employers --------
    for (const e of EMPLOYER_SEEDS) {
      const id = await ctx.db.insert("employerOrgs", {
        name: e.name,
        slug: e.slug,
        tier: e.tier,
        websiteUrl: e.websiteUrl,
        hqCity: e.hqCity,
        planTier: e.planTier,
        jobPostsUsed: 0,
        createdAt: now,
        updatedAt: now,
      });
      employerIdBySlug.set(e.slug, id);
    }

    // -------- jobs (all published; skip moderation) --------
    const laraId = userIdBySlug.get("lara-mendoza")!;
    for (const j of JOB_SEEDS) {
      const empId = employerIdBySlug.get(j.employerSlug);
      if (!empId) continue;
      await ctx.db.insert("jobs", {
        employerOrgId: empId,
        title: j.title,
        description: j.description,
        location: j.location,
        employmentType: j.employmentType,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        salaryCurrency: "PHP",
        targetingPrograms: j.targetingPrograms,
        aufOnly: true,
        status: "published",
        createdBy: laraId,
        createdAt: now,
        publishedAt: now,
      });
    }

    // -------- events --------
    await ctx.db.insert("events", {
      title: "AUF Tech Alumni Mixer",
      description:
        "Casual mixer for AUF tech alumni in Pampanga. Drinks on us. Bring your batch.",
      startsAt: now + 21 * MS_PER_DAY,
      locationLabel: "Marquee Mall, Angeles City",
      publishedBy: laraId,
      publishedAt: now,
    });
    await ctx.db.insert("events", {
      title: "Nursing Careers Panel",
      description:
        "BSN alumni panel — Med City, St. Luke's, MGH. Q&A with current students.",
      startsAt: now + 40 * MS_PER_DAY,
      onlineUrl: "https://zoom.us/auf-nursing-panel",
      publishedBy: userIdBySlug.get("marvin-cabrera")!,
      publishedAt: now,
    });

    // -------- feed posts --------
    await ctx.db.insert("posts", {
      authorId: userIdBySlug.get("anjelica-pineda")!,
      kind: "text",
      content:
        "Hey AUF folks — my team is opening 2 Frontend Engineer roles at Kumu. Comment or DM me and I'll refer you directly (skip the cold portal). Hybrid in BGC, ₱70–95K, mid level.",
      visibilityTier: "alumni",
      autoGenerated: false,
      createdAt: now - 2 * 60 * 60 * 1000,
    });
    await ctx.db.insert("posts", {
      authorId: userIdBySlug.get("marvin-cabrera")!,
      kind: "text",
      content:
        "Hosted 4 BSN seniors at Med City last week for a shadowing day. If you're graduating in '26 and want to see ICU workflow IRL — DM me, we'll set up the next batch.",
      visibilityTier: "alumni",
      autoGenerated: false,
      createdAt: now - 5 * 60 * 60 * 1000,
    });
    await ctx.db.insert("posts", {
      authorId: userIdBySlug.get("mark-lim")!,
      kind: "work-anniversary",
      content:
        "Mark Lim celebrates 5 years at GCash. Wild to think I came in fresh from AUF in 2019.",
      visibilityTier: "alumni",
      autoGenerated: true,
      relatedMetadata: { role: "Product Designer", company: "GCash", years: 5 },
      createdAt: now - 24 * 60 * 60 * 1000,
    });

    // -------- connections (Lara connected to a few alumni) --------
    const connectTo = ["anjelica-pineda", "mark-lim", "marvin-cabrera", "trish-aguilar"];
    for (const otherSlug of connectTo) {
      const other = userIdBySlug.get(otherSlug);
      if (!other) continue;
      const [a, b] = laraId < other ? [laraId, other] : [other, laraId];
      await ctx.db.insert("connections", {
        requesterId: laraId,
        recipientId: other,
        userA: a,
        userB: b,
        status: "connected",
        createdAt: now - 10 * MS_PER_DAY,
        decidedAt: now - 9 * MS_PER_DAY,
      });
    }

    // One pending request *to* Lara so the sidebar shows a pending count
    const pendingFrom = userIdBySlug.get("rhea-sotto")!;
    {
      const [a, b] = laraId < pendingFrom ? [laraId, pendingFrom] : [pendingFrom, laraId];
      await ctx.db.insert("connections", {
        requesterId: pendingFrom,
        recipientId: laraId,
        userA: a,
        userB: b,
        status: "pending",
        note: "Hey Lara — saw your work at HealthLink. Would love to connect.",
        createdAt: now - 2 * MS_PER_DAY,
      });
    }

    return {
      status: "seeded",
      counts: {
        alumni: ALUMNI_SEEDS.length,
        employers: EMPLOYER_SEEDS.length,
        jobs: JOB_SEEDS.length,
        events: 2,
        posts: 3,
        connections: connectTo.length + 1,
      },
    };
  },
});
