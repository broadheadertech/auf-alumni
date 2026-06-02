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

/**
 * Idempotent Academy-only seeder. Safe to run after the main `run` has
 * already short-circuited — it inserts the demo courses if their slugs
 * aren't already in `academyCourses`.
 */
export const runAcademy = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const userIdBySlug = new Map<string, Id<"users">>();
    const allProfiles = await ctx.db.query("profiles").collect();
    for (const p of allProfiles) {
      userIdBySlug.set(p.slug, p.userId);
    }

    type AcademySeed = {
      instructorSlug: string;
      slug: string;
      title: string;
      summary: string;
      description: string;
      category: string;
      level: "beginner" | "intermediate" | "advanced";
      lessons: Array<{
        title: string;
        kind: "video" | "article";
        videoUrl?: string;
        articleMarkdown?: string;
        durationMinutes?: number;
      }>;
    };

    const ACADEMY_SEEDS: AcademySeed[] = [
      {
        instructorSlug: "anjelica-pineda",
        slug: "land-your-first-frontend-role",
        title: "Land your first frontend role",
        summary:
          "A senior frontend at Kumu walks you from BS IT '25 grad to first offer in 90 days — without going through cold portals.",
        description:
          "**Who this is for**\n\nFresh AUF grads in BS IT, BS CS, or BS MMA who want their first frontend role at a Filipino product company.\n\n**What you'll learn**\n\n- How to read a job posting and decide if you're a real fit\n- Building a 3-project portfolio that's actually hireable\n- Reaching out to AUF alumni at the company instead of cold-applying\n- Interview prep specific to Philippine product teams (Kumu, GCash, Coins.ph)\n- Negotiating your first salary band\n\n**Time investment**: ~3 hours of video + reading.",
        category: "career",
        level: "beginner",
        lessons: [
          {
            title: "Why cold portal applications don't work",
            kind: "article",
            articleMarkdown:
              "The cold-portal funnel converts at roughly 0.3% for fresh grads in PH tech. Here's the math, and what to do instead.\n\n**The 3 numbers**\n\n- ~250 applications per job posting at a series-A company\n- ~25 phone screens\n- 1-2 offers\n\n**Why AUF alumni referrals beat the portal**\n\n1. You skip the resume screen — the referring alumna can vouch directly\n2. Your CV lands in the *referred* pile, not the inbound flood\n3. You get a real-name internal advocate, not a recruiter\n\n**Action step**: list 3 Filipino product companies you'd want to work at. Search the AUF directory for alumni at each.",
            durationMinutes: 12,
          },
          {
            title: "Build a hireable 3-project portfolio",
            kind: "video",
            videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            durationMinutes: 28,
          },
          {
            title: "DMing alumni without being awkward",
            kind: "article",
            articleMarkdown:
              "Reaching out to a senior alumna feels weird. It shouldn't. Here's the script I've used to ask for 40+ referrals.\n\n**The 4-line message**\n\n> Hi [Name] — I'm [Your name], BS IT '24 from AUF. I noticed you're at [Company] and saw they're hiring a [Role]. I built [1-sentence portfolio link]. Would you be open to a 15-min chat or willing to refer if you think I'm a fit? No pressure either way.\n\n**Why it works**\n\n- Names the alumni connection up front (one-degree-of-separation principle)\n- Asks ONE specific thing (a chat OR a referral)\n- Gives them an easy out\n- Includes a portfolio link so they can decide quickly",
            durationMinutes: 8,
          },
        ],
      },
      {
        instructorSlug: "marvin-cabrera",
        slug: "bsn-abroad-pgh-to-singapore",
        title: "BSN abroad: PGH to Singapore",
        summary:
          "How I went from charity-ward rotation at PGH to a critical-care role in Singapore — visa, exams, and the long-game financial math.",
        description:
          "**The path I actually took**\n\n1. AUF BSN '19 → 2 years at Med City Clark to build clinical hours\n2. Took the SNB exam (Singapore Nursing Board) in year 3\n3. Applied to NUH critical-care residency in year 4\n4. Settled in year 5\n\nIf you're a BSN '23-'25 and thinking about working abroad, this course gives you the realistic timeline, the costs, and the trade-offs nobody on YouTube tells you about.",
        category: "healthcare",
        level: "intermediate",
        lessons: [
          {
            title: "The 5-year timeline (don't skip steps)",
            kind: "article",
            articleMarkdown:
              "Year 1-2 in PH builds clinical hours that count abroad. Year 3 is exams. Year 4 is applications. Year 5 you're settling in. **Skipping years usually backfires.**\n\nHere's what each year actually costs in ₱ and what you should be doing.",
            durationMinutes: 14,
          },
          {
            title: "Passing the SNB on the first try",
            kind: "video",
            videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            durationMinutes: 22,
          },
          {
            title: "Money: what you'll actually take home",
            kind: "article",
            articleMarkdown:
              "The headline SGD 4,500/mo looks great. After housing, food, and remittances back to your family — here's what actually lands in your account.\n\n**Real numbers from my first year:**\n- Gross: SGD 4,500\n- Tax + CPF: SGD 760\n- Housing (shared HDB): SGD 800\n- Food + transport: SGD 600\n- Remittance home: SGD 1,500\n- **Net to save: SGD 840/mo**\n\nNot bad, but it's not the magic-money story you see on TikTok.",
            durationMinutes: 11,
          },
        ],
      },
      {
        instructorSlug: "mark-lim",
        slug: "crit-stage-product-design",
        title: "Crit-stage product design",
        summary:
          "How designers at GCash run weekly crits — and how to use the same playbook to level up at any PH product company.",
        description:
          "Product design crits are the single biggest leverage on a designer's growth. This course teaches you the GCash crit playbook: how to present, how to receive feedback, and how to run them when you eventually lead a team.",
        category: "design",
        level: "intermediate",
        lessons: [
          {
            title: "Why crits matter more than 1:1s",
            kind: "video",
            videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            durationMinutes: 18,
          },
          {
            title: "Presenting work without being defensive",
            kind: "article",
            articleMarkdown:
              "The instinct is to defend every decision. The pros walk into a crit *expecting* to change their mind.\n\nHere's the 3-slide structure: **Context → Decision points → Open questions.**",
            durationMinutes: 9,
          },
        ],
      },
    ];

    let academyCourses = 0;
    let academyLessons = 0;
    for (const c of ACADEMY_SEEDS) {
      // Skip if a course with this slug already exists.
      const existing = await ctx.db
        .query("academyCourses")
        .withIndex("by_slug", (q) => q.eq("slug", c.slug))
        .unique();
      if (existing) continue;
      const instructorId = userIdBySlug.get(c.instructorSlug);
      if (!instructorId) continue;
      const totalMinutes = c.lessons.reduce(
        (acc, l) => acc + (l.durationMinutes ?? 0),
        0,
      );
      const courseId = await ctx.db.insert("academyCourses", {
        instructorId,
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        description: c.description,
        category: c.category,
        level: c.level,
        durationMinutes: totalMinutes,
        status: "published",
        publishedAt: now - 7 * MS_PER_DAY,
        createdAt: now - 14 * MS_PER_DAY,
        updatedAt: now - 7 * MS_PER_DAY,
      });
      academyCourses += 1;
      for (let i = 0; i < c.lessons.length; i += 1) {
        const l = c.lessons[i];
        await ctx.db.insert("academyLessons", {
          courseId,
          order: i + 1,
          title: l.title,
          kind: l.kind,
          videoUrl: l.videoUrl,
          articleMarkdown: l.articleMarkdown,
          durationMinutes: l.durationMinutes,
          createdAt: now - 14 * MS_PER_DAY,
          updatedAt: now - 7 * MS_PER_DAY,
        });
        academyLessons += 1;
      }
    }

    return { status: "academy-seeded", academyCourses, academyLessons };
  },
});

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

    // -------- AUF Academy courses --------
    type AcademySeed = {
      instructorSlug: string;
      slug: string;
      title: string;
      summary: string;
      description: string;
      category: string;
      level: "beginner" | "intermediate" | "advanced";
      lessons: Array<{
        title: string;
        kind: "video" | "article";
        videoUrl?: string;
        articleMarkdown?: string;
        durationMinutes?: number;
      }>;
    };

    const ACADEMY_SEEDS: AcademySeed[] = [
      {
        instructorSlug: "anjelica-pineda",
        slug: "land-your-first-frontend-role",
        title: "Land your first frontend role",
        summary:
          "A senior frontend at Kumu walks you from BS IT '25 grad to first offer in 90 days — without going through cold portals.",
        description:
          "**Who this is for**\n\nFresh AUF grads in BS IT, BS CS, or BS MMA who want their first frontend role at a Filipino product company.\n\n**What you'll learn**\n\n- How to read a job posting and decide if you're a real fit\n- Building a 3-project portfolio that's actually hireable\n- Reaching out to AUF alumni at the company instead of cold-applying\n- Interview prep specific to Philippine product teams (Kumu, GCash, Coins.ph)\n- Negotiating your first salary band\n\n**Time investment**: ~3 hours of video + reading.",
        category: "career",
        level: "beginner",
        lessons: [
          {
            title: "Why cold portal applications don't work",
            kind: "article",
            articleMarkdown:
              "The cold-portal funnel converts at roughly 0.3% for fresh grads in PH tech. Here's the math, and what to do instead.\n\n**The 3 numbers**\n\n- ~250 applications per job posting at a series-A company\n- ~25 phone screens\n- 1-2 offers\n\n**Why AUF alumni referrals beat the portal**\n\n1. You skip the resume screen — the referring alumna can vouch directly\n2. Your CV lands in the *referred* pile, not the inbound flood\n3. You get a real-name internal advocate, not a recruiter\n\n**Action step**: list 3 Filipino product companies you'd want to work at. Search the AUF directory for alumni at each.",
            durationMinutes: 12,
          },
          {
            title: "Build a hireable 3-project portfolio",
            kind: "video",
            videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            durationMinutes: 28,
          },
          {
            title: "DMing alumni without being awkward",
            kind: "article",
            articleMarkdown:
              "Reaching out to a senior alumna feels weird. It shouldn't. Here's the script I've used to ask for 40+ referrals.\n\n**The 4-line message**\n\n> Hi [Name] — I'm [Your name], BS IT '24 from AUF. I noticed you're at [Company] and saw they're hiring a [Role]. I built [1-sentence portfolio link]. Would you be open to a 15-min chat or willing to refer if you think I'm a fit? No pressure either way.\n\n**Why it works**\n\n- Names the alumni connection up front (one-degree-of-separation principle)\n- Asks ONE specific thing (a chat OR a referral)\n- Gives them an easy out\n- Includes a portfolio link so they can decide quickly\n\n**What to expect**\n\n- 60% no reply\n- 30% nice but \"I'm not on the hiring team\"\n- 10% \"sure, send me your CV\" — these are the ones that change your life",
            durationMinutes: 8,
          },
        ],
      },
      {
        instructorSlug: "marvin-cabrera",
        slug: "bsn-abroad-pgh-to-singapore",
        title: "BSN abroad: PGH to Singapore",
        summary:
          "How I went from charity-ward rotation at PGH to a critical-care role in Singapore — visa, exams, and the long-game financial math.",
        description:
          "**The path I actually took**\n\n1. AUF BSN '19 → 2 years at Med City Clark to build clinical hours\n2. Took the SNB exam (Singapore Nursing Board) in year 3\n3. Applied to NUH critical-care residency in year 4\n4. Settled in year 5\n\nIf you're a BSN '23-'25 and thinking about working abroad, this course gives you the realistic timeline, the costs, and the trade-offs nobody on YouTube tells you about.",
        category: "healthcare",
        level: "intermediate",
        lessons: [
          {
            title: "The 5-year timeline (don't skip steps)",
            kind: "article",
            articleMarkdown:
              "Year 1-2 in PH builds clinical hours that count abroad. Year 3 is exams. Year 4 is applications. Year 5 you're settling in. **Skipping years usually backfires.**\n\nHere's what each year actually costs in ₱ and what you should be doing.",
            durationMinutes: 14,
          },
          {
            title: "Passing the SNB on the first try",
            kind: "video",
            videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            durationMinutes: 22,
          },
          {
            title: "Money: what you'll actually take home",
            kind: "article",
            articleMarkdown:
              "The headline SGD 4,500/mo looks great. After housing, food, and remittances back to your family — here's what actually lands in your account.\n\n**Real numbers from my first year:**\n- Gross: SGD 4,500\n- Tax + CPF: SGD 760\n- Housing (shared HDB): SGD 800\n- Food + transport: SGD 600\n- Remittance home: SGD 1,500\n- **Net to save: SGD 840/mo**\n\nNot bad, but it's not the magic-money story you see on TikTok.",
            durationMinutes: 11,
          },
        ],
      },
      {
        instructorSlug: "mark-lim",
        slug: "crit-stage-product-design",
        title: "Crit-stage product design",
        summary:
          "How designers at GCash run weekly crits — and how to use the same playbook to level up at any PH product company.",
        description:
          "Product design crits are the single biggest leverage on a designer's growth. This course teaches you the GCash crit playbook: how to present, how to receive feedback, and how to run them when you eventually lead a team.",
        category: "design",
        level: "intermediate",
        lessons: [
          {
            title: "Why crits matter more than 1:1s",
            kind: "video",
            videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            durationMinutes: 18,
          },
          {
            title: "Presenting work without being defensive",
            kind: "article",
            articleMarkdown:
              "The instinct is to defend every decision. The pros walk into a crit *expecting* to change their mind.\n\nHere's the 3-slide structure: **Context → Decision points → Open questions.**",
            durationMinutes: 9,
          },
        ],
      },
    ];

    let academyCourses = 0;
    let academyLessons = 0;
    for (const c of ACADEMY_SEEDS) {
      const instructorId = userIdBySlug.get(c.instructorSlug);
      if (!instructorId) continue;
      const totalMinutes = c.lessons.reduce(
        (acc, l) => acc + (l.durationMinutes ?? 0),
        0,
      );
      const courseId = await ctx.db.insert("academyCourses", {
        instructorId,
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        description: c.description,
        category: c.category,
        level: c.level,
        durationMinutes: totalMinutes,
        status: "published",
        publishedAt: now - 7 * MS_PER_DAY,
        createdAt: now - 14 * MS_PER_DAY,
        updatedAt: now - 7 * MS_PER_DAY,
      });
      academyCourses += 1;
      for (let i = 0; i < c.lessons.length; i += 1) {
        const l = c.lessons[i];
        await ctx.db.insert("academyLessons", {
          courseId,
          order: i + 1,
          title: l.title,
          kind: l.kind,
          videoUrl: l.videoUrl,
          articleMarkdown: l.articleMarkdown,
          durationMinutes: l.durationMinutes,
          createdAt: now - 14 * MS_PER_DAY,
          updatedAt: now - 7 * MS_PER_DAY,
        });
        academyLessons += 1;
      }
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
        academyCourses,
        academyLessons,
      },
    };
  },
});
