/**
 * Universal search — one query behind the ⌘K bar in every shell.
 *
 * `social.globalSearch` only covered alumni, jobs and courses, so anything else
 * (events, articles, companies, and the whole admin surface) had no search at
 * all. This replaces it with a single role-aware query:
 *
 *   - everyone signed in gets alumni, jobs, courses, events, articles, companies
 *   - employer admins additionally get their own postings and applicants
 *   - moderators / super-admins additionally get user accounts, enquiries,
 *     pending verifications and every posting regardless of status
 *
 * Results carry their own `href`, resolved for the viewer's surface: an admin
 * searching "Delos Santos" wants the admin record, an alumnus wants the public
 * profile.
 *
 * Matching is in-memory substring scoring rather than a Convex `searchIndex`.
 * At this data size (hundreds of rows per table) the scan is cheap, and
 * substring beats token-prefix for the way people actually use this bar —
 * "info" should find "BS Information Technology", and "wyeth" should find
 * "Wyeth Philippines" typed mid-word. Revisit if any table passes ~5k rows.
 *
 * Viewer context is resolved ONCE and reused for every hit (see mentorship.ts
 * for the same pattern) — this query runs on every keystroke, so a per-result
 * `getViewerContext` would be a round trip per alumnus.
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { applyPrivacy, type ViewerContext } from "./helpers/privacy";

/** The kinds a hit can be. `page` is a navigation destination, not a record. */
export const SEARCH_KINDS = [
  "alumni",
  "job",
  "course",
  "event",
  "article",
  "company",
  "applicant",
  "user",
  "enquiry",
  "verification",
  "page",
] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export type SearchHit = {
  kind: SearchKind;
  /** Stable key for React and for de-duplication. */
  id: string;
  title: string;
  subtitle: string;
  /** Short status chip, e.g. "Draft" or "Suspended". */
  meta: string | null;
  href: string;
  score: number;
};

/** Which surface the viewer is on — decides where a hit links to. */
type Surface = "admin" | "employer" | "alumni" | "stranger";

const ADMIN_ROLES = ["super-admin", "moderator", "verifier"];
const ALUMNI_ROLES = ["alumnus", "current-student", ...ADMIN_ROLES];

/** Per-kind cap, so one noisy table can't crowd out the rest. */
const PER_KIND = 6;
const MIN_LENGTH = 2;
/** How many rows of each table we're willing to scan. */
const SCAN = 600;

/** Verification states still sitting in the approvals queue. */
const OPEN_VERIFICATION_STATUSES = new Set([
  "pending-review",
  "info-requested",
  "escalated",
]);

// ------------------------------------------------------------------ scoring ---

/**
 * Scores one candidate. `fields` is [text, weight] pairs — the title field
 * carries the highest weight so a name match outranks a bio match.
 *
 * Within a field: whole-value match beats a prefix, which beats a word start,
 * which beats a match buried mid-word. That ordering is what makes "ana" rank
 * "Ana Reyes" above "Diana Cruz" above "Management".
 */
function scoreFields(
  needle: string,
  fields: Array<[string | null | undefined, number]>,
): number {
  let best = 0;
  for (const [raw, weight] of fields) {
    if (!raw) continue;
    const text = raw.toLowerCase();
    const at = text.indexOf(needle);
    if (at === -1) continue;
    let positional: number;
    if (text === needle) positional = 4;
    else if (at === 0) positional = 3;
    else if (/[\s\-/(,.]/.test(text[at - 1] ?? "")) positional = 2;
    else positional = 1;
    best = Math.max(best, positional * weight);
  }
  return best;
}

// -------------------------------------------------------------- navigation ---

/**
 * Navigation destinations, so the bar answers "where is X?" as well as
 * "who/what is X?". Keywords cover the words people type that aren't in the
 * label — "approve" for the approvals queue, "kpi" for analytics.
 */
type Destination = {
  label: string;
  href: string;
  where: string;
  keywords: string;
  surfaces: Surface[];
};

const DESTINATIONS: Destination[] = [
  // Help — searchable from every surface, because "how do I post a job" should
  // find the walkthrough, not just the page.
  { label: "Guide: how to use this", href: "/guide", where: "Help", keywords: "help tutorial how to guide walkthrough manual steps instructions getting started training refresher", surfaces: ["alumni"] },
  { label: "Guide: how to use this", href: "/employer/guide", where: "Help", keywords: "help tutorial how to guide walkthrough manual steps instructions getting started training refresher", surfaces: ["employer"] },
  { label: "Guide: how to use this", href: "/admin/guide", where: "Help", keywords: "help tutorial how to guide walkthrough manual steps instructions getting started training refresher onboarding staff", surfaces: ["admin"] },

  // Alumni
  { label: "My feed", href: "/feed", where: "Alumni", keywords: "home timeline posts", surfaces: ["alumni", "admin"] },
  { label: "Jobs", href: "/jobs", where: "Alumni", keywords: "openings roles vacancies hiring board", surfaces: ["alumni", "admin"] },
  { label: "My applications", href: "/jobs/applications", where: "Alumni", keywords: "applied status pipeline", surfaces: ["alumni", "admin"] },
  { label: "Events", href: "/events", where: "Alumni", keywords: "rsvp reunion webinar meetup calendar", surfaces: ["alumni", "admin"] },
  { label: "Mentorship", href: "/mentorship", where: "Alumni", keywords: "mentor mentee coach guidance", surfaces: ["alumni", "admin"] },
  { label: "AUF Academy", href: "/academy", where: "Alumni", keywords: "courses learning lessons training", surfaces: ["alumni", "admin"] },
  { label: "Connections", href: "/connections", where: "Alumni", keywords: "network requests friends follow", surfaces: ["alumni", "admin"] },
  { label: "Messages", href: "/messages", where: "Alumni", keywords: "inbox dm chat conversations", surfaces: ["alumni", "admin"] },
  { label: "Edit my profile", href: "/profile/edit", where: "Alumni", keywords: "photo avatar bio skills privacy visibility", surfaces: ["alumni", "admin"] },
  { label: "Alumni ID card", href: "/id", where: "Alumni", keywords: "card badge activate", surfaces: ["alumni", "admin"] },
  { label: "Notification settings", href: "/settings/notifications", where: "Alumni", keywords: "email digest prefs unsubscribe", surfaces: ["alumni", "admin"] },
  { label: "Resume settings", href: "/settings/resume", where: "Alumni", keywords: "cv upload download", surfaces: ["alumni", "admin"] },

  // Employer
  { label: "Employer dashboard", href: "/employer/dashboard", where: "Employer", keywords: "overview summary", surfaces: ["employer", "admin"] },
  { label: "My job postings", href: "/employer/jobs", where: "Employer", keywords: "post a job create vacancy listing", surfaces: ["employer", "admin"] },
  { label: "Applicants", href: "/employer/applicants", where: "Employer", keywords: "candidates pipeline shortlist hire", surfaces: ["employer", "admin"] },
  { label: "Company profile", href: "/employer/company", where: "Employer", keywords: "about logo industry branding", surfaces: ["employer", "admin"] },
  { label: "Billing", href: "/employer/billing", where: "Employer", keywords: "invoice plan subscription payment quota", surfaces: ["employer", "admin"] },

  // Admin
  { label: "Admin dashboard", href: "/admin/dashboard", where: "Admin", keywords: "overview kpi summary analytics tiles", surfaces: ["admin"] },
  { label: "Alumni records", href: "/admin/alumni", where: "Admin", keywords: "roster members list", surfaces: ["admin"] },
  { label: "Approvals queue", href: "/admin/alumni/approvals", where: "Admin", keywords: "approve reject verify pending verification registry", surfaces: ["admin"] },
  { label: "Directory", href: "/admin/directory", where: "Admin", keywords: "browse alumni search roster", surfaces: ["admin"] },
  { label: "Employers", href: "/admin/employers", where: "Admin", keywords: "partners companies moa nda contract tier", surfaces: ["admin"] },
  { label: "Job postings", href: "/admin/jobs", where: "Admin", keywords: "listings vacancies review", surfaces: ["admin"] },
  { label: "Job moderation", href: "/admin/moderation/jobs", where: "Admin", keywords: "approve reject flag report queue", surfaces: ["admin"] },
  { label: "Analytics", href: "/admin/analytics", where: "Admin", keywords: "reports charts hires placements funnel", surfaces: ["admin"] },
  { label: "Events", href: "/admin/events", where: "Admin", keywords: "publish rsvp attendance", surfaces: ["admin"] },
  { label: "Enquiries", href: "/admin/enquiries", where: "Admin", keywords: "contact messages talk to auf inbox", surfaces: ["admin"] },
  { label: "Audit log", href: "/admin/audit", where: "Admin", keywords: "history trail who changed", surfaces: ["admin"] },
  { label: "Compliance", href: "/admin/compliance", where: "Admin", keywords: "dpa privacy dsr incidents retention", surfaces: ["admin"] },
  { label: "User accounts", href: "/admin/users", where: "Admin", keywords: "roles suspend permissions accounts", surfaces: ["admin"] },
  { label: "Main page content", href: "/admin/content", where: "Admin", keywords: "cms homepage copy hero edit", surfaces: ["admin"] },
  { label: "Articles", href: "/admin/articles", where: "Admin", keywords: "cms news blog newsroom publish", surfaces: ["admin"] },
  { label: "Colleges & programs", href: "/admin/settings", where: "Admin", keywords: "cms taxonomy degree course list", surfaces: ["admin"] },
  { label: "Areas", href: "/admin/lists/areas", where: "Admin", keywords: "cms cities locations list lookup", surfaces: ["admin"] },
  { label: "Statuses", href: "/admin/lists/statuses", where: "Admin", keywords: "cms employment status list lookup", surfaces: ["admin"] },
  { label: "Skill sets", href: "/admin/lists/skills", where: "Admin", keywords: "cms skills list lookup", surfaces: ["admin"] },
];

// ------------------------------------------------------------------- query ---

export const universal = query({
  args: {
    q: v.string(),
    /** Restrict to one kind — the bar's "Alumni / Jobs / …" chips. */
    kind: v.optional(v.string()),
  },
  handler: async (ctx, { q, kind }) => {
    const needle = q.trim().toLowerCase();
    const empty = { hits: [] as SearchHit[], counts: {} as Record<string, number>, total: 0, surface: "stranger" as Surface, truncated: false };
    if (needle.length < MIN_LENGTH) return empty;

    const me = await getAuthUserId(ctx);
    const meUser = me ? await ctx.db.get(me) : null;
    if (!meUser || meUser.deletedAt) return empty;

    const roles = meUser.roles ?? [];
    const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
    const isAlumnus = roles.some((r) => ALUMNI_ROLES.includes(r));
    // @full-scan-ok: employerOrgs membership is tested against the adminUserIds array, and Convex cannot index an array's elements
    const myOrgs = await ctx.db.query("employerOrgs").collect();
    const myEmployerOrgs = myOrgs.filter((o) => (o.adminUserIds ?? []).includes(meUser._id));
    const isEmployer = myEmployerOrgs.length > 0;
    const surface: Surface = isAdmin ? "admin" : isEmployer ? "employer" : isAlumnus ? "alumni" : "stranger";

    const wanted = (k: SearchKind) => !kind || kind === k;
    const hits: SearchHit[] = [];
    /** True when a section hit its cap — the bar says "showing the top N". */
    let truncated = false;

    /** Keeps only the best `PER_KIND` of a section, newest-relevance first. */
    const push = (rows: SearchHit[]) => {
      rows.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
      if (rows.length > PER_KIND) truncated = true;
      hits.push(...rows.slice(0, PER_KIND));
    };

    // -- alumni ------------------------------------------------------------
    if (wanted("alumni")) {
      // Resolve the viewer's relationships once, not per profile.
      const [profiles, sentLinks, recvLinks] = await Promise.all([
        ctx.db.query("profiles").take(SCAN),
        ctx.db
          .query("connections")
          .withIndex("by_requester_status", (qq) =>
            qq.eq("requesterId", meUser._id).eq("status", "connected"),
          )
          .collect(),
        ctx.db
          .query("connections")
          .withIndex("by_recipient_status", (qq) =>
            qq.eq("recipientId", meUser._id).eq("status", "connected"),
          )
          .collect(),
      ]);
      const connectedIds = new Set<string>([
        ...sentLinks.map((c) => c.recipientId as string),
        ...recvLinks.map((c) => c.requesterId as string),
      ]);
      const suspended = new Set<string>();
      for (const u of await ctx.db.query("users").take(SCAN)) {
        if (u.suspendedAt || u.deletedAt) suspended.add(u._id as string);
      }

      const rows: SearchHit[] = [];
      for (const p of profiles) {
        // Admins need to find unverified and suspended records — that is the
        // point of the approvals queue. Everyone else sees live alumni only.
        if (!isAdmin && (p.verifiedAt == null || suspended.has(p.userId as string))) continue;
        if (!isAdmin && p.excludeFromSearchEngines && surface === "stranger") continue;

        const viewer: ViewerContext =
          p.userId === meUser._id
            ? { kind: "self", userId: meUser._id }
            : connectedIds.has(p.userId as string)
              ? { kind: "connection", userId: meUser._id }
              : isAlumnus
                ? { kind: "alumnus", userId: meUser._id }
                : { kind: "stranger" };
        const safe = applyPrivacy(p, viewer);

        // Only score fields this viewer is actually allowed to see, so search
        // can't be used to probe a hidden company or role.
        const score = scoreFields(needle, [
          [safe.displayName, 10],
          [safe.currentRole, 6],
          [safe.company, 6],
          [safe.program, 4],
          [safe.city, 3],
          [(safe.skills ?? []).join(" "), 3],
          [safe.bio, 1],
        ]);
        if (score === 0) continue;

        rows.push({
          kind: "alumni",
          id: p._id as string,
          title: safe.displayName ?? "Alumnus",
          subtitle:
            [safe.currentRole, safe.company].filter(Boolean).join(" · ") ||
            [safe.program, safe.batch].filter(Boolean).join(" · "),
          meta:
            p.verifiedAt == null
              ? "Unverified"
              : suspended.has(p.userId as string)
                ? "Suspended"
                : safe.batch
                  ? `Batch ${safe.batch}`
                  : null,
          // Signed-in members get the in-app profile, which carries Connect
          // and Message; /u/ is the public page for everyone else.
          href: isAdmin
            ? `/admin/alumni/${p._id}`
            : isAlumnus
              ? `/profile/${p.slug}`
              : `/u/${p.slug}`,
          score,
        });
      }
      push(rows);
    }

    // -- jobs --------------------------------------------------------------
    if (wanted("job")) {
      const orgName = new Map(myOrgs.map((o) => [o._id as string, o.name]));
      // Admins moderate drafts and rejected posts, so they search all of them.
      const jobs = isAdmin
        ? await ctx.db.query("jobs").take(SCAN)
        : await ctx.db
            .query("jobs")
            .withIndex("by_status_time", (qq) => qq.eq("status", "published"))
            .order("desc")
            .take(SCAN);
      const rows: SearchHit[] = [];
      for (const j of jobs) {
        const company = orgName.get(j.employerOrgId as string) ?? "";
        const score = scoreFields(needle, [
          [j.title, 10],
          [company, 7],
          [j.location, 4],
          [(j.skills ?? []).join(" "), 4],
          [j.employmentType, 2],
          [j.description, 1],
        ]);
        if (score === 0) continue;
        const mine = myEmployerOrgs.some((o) => o._id === j.employerOrgId);
        rows.push({
          kind: "job",
          id: j._id as string,
          title: j.title,
          subtitle: [company, j.location].filter(Boolean).join(" · "),
          meta: j.status === "published" ? null : j.status,
          href: isAdmin
            ? `/admin/jobs/${j._id}`
            : mine
              ? `/employer/jobs`
              : `/jobs/${j._id}`,
          score,
        });
      }
      push(rows);
    }

    // -- courses -----------------------------------------------------------
    if (wanted("course")) {
      const courses = await ctx.db
        .query("academyCourses")
        .withIndex("by_status_published", (qq) => qq.eq("status", "published"))
        .order("desc")
        .take(SCAN);
      push(
        courses.flatMap((c) => {
          const score = scoreFields(needle, [
            [c.title, 10],
            [c.category, 5],
            [c.summary, 3],
            [c.level, 2],
          ]);
          return score === 0
            ? []
            : [{
                kind: "course" as const,
                id: c._id as string,
                title: c.title,
                subtitle: `${c.level} · ${c.category}`,
                meta: null,
                href: `/academy/${c.slug}`,
                score,
              }];
        }),
      );
    }

    // -- events ------------------------------------------------------------
    if (wanted("event")) {
      const events = await ctx.db.query("events").withIndex("by_starts_at").order("desc").take(SCAN);
      const now = Date.now();
      push(
        events.flatMap((e) => {
          const score = scoreFields(needle, [
            [e.title, 10],
            [e.locationLabel, 5],
            [e.category, 4],
            [e.description, 1],
          ]);
          return score === 0
            ? []
            : [{
                kind: "event" as const,
                id: e._id as string,
                title: e.title,
                subtitle: [
                  new Date(e.startsAt).toLocaleDateString("en-PH", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "Asia/Manila",
                  }),
                  e.locationLabel ?? (e.onlineUrl ? "Online" : null),
                ]
                  .filter(Boolean)
                  .join(" · "),
                meta: e.cancelledAt ? "Cancelled" : e.startsAt < now ? "Past" : null,
                href: isAdmin ? `/admin/events/${e._id}` : `/events/${e._id}`,
                score,
              }];
        }),
      );
    }

    // -- articles ----------------------------------------------------------
    if (wanted("article")) {
      // Drafts are admin-only; everyone else searches the published newsroom.
      const articles = isAdmin
        ? await ctx.db.query("articles").take(SCAN)
        : await ctx.db
            .query("articles")
            .withIndex("by_status_published", (qq) => qq.eq("status", "published"))
            .order("desc")
            .take(SCAN);
      push(
        articles.flatMap((a) => {
          const score = scoreFields(needle, [
            [a.title, 10],
            [a.category, 4],
            [a.excerpt, 3],
            [a.body, 1],
          ]);
          return score === 0
            ? []
            : [{
                kind: "article" as const,
                id: a._id as string,
                title: a.title,
                subtitle: a.excerpt?.slice(0, 90) ?? a.category ?? "Article",
                meta: a.status === "published" ? null : a.status,
                href: isAdmin ? `/admin/articles/${a._id}` : `/news/${a.slug}`,
                score,
              }];
        }),
      );
    }

    // -- companies ---------------------------------------------------------
    if (wanted("company")) {
      push(
        myOrgs.flatMap((o) => {
          const score = scoreFields(needle, [
            [o.name, 10],
            [o.industry, 5],
            [o.hqCity, 4],
            [o.tagline, 3],
            [o.about, 1],
          ]);
          return score === 0
            ? []
            : [{
                kind: "company" as const,
                id: o._id as string,
                title: o.name,
                subtitle: [o.industry, o.hqCity].filter(Boolean).join(" · ") || o.tier,
                meta: o.suspendedAt ? "Suspended" : o.tier === "partner" ? "Partner" : null,
                href: isAdmin ? `/admin/employers/${o._id}` : `/companies/${o.slug}`,
                score,
              }];
        }),
      );
    }

    // -- employer: my applicants ------------------------------------------
    if (isEmployer && !isAdmin && wanted("applicant")) {
      const myJobIds = new Set<string>();
      for (const o of myEmployerOrgs) {
        for (const j of await ctx.db
          .query("jobs")
          .withIndex("by_employer_time", (qq) => qq.eq("employerOrgId", o._id))
          .collect()) {
          myJobIds.add(j._id as string);
        }
      }
      const rows: SearchHit[] = [];
      for (const app of await ctx.db.query("applications").take(SCAN)) {
        if (!myJobIds.has(app.jobId as string)) continue;
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (qq) => qq.eq("userId", app.applicantId))
          .unique();
        // @no-privacy-required: an applicant deliberately disclosed their
        // profile to this employer by applying; the pipeline shows the same.
        if (!profile) continue;
        const score = scoreFields(needle, [
          [profile.displayName, 10],
          [profile.currentRole, 5],
          [profile.program, 4],
          [(profile.skills ?? []).join(" "), 3],
        ]);
        if (score === 0) continue;
        rows.push({
          kind: "applicant",
          id: app._id as string,
          title: profile.displayName,
          subtitle: [profile.program, profile.currentRole].filter(Boolean).join(" · "),
          meta: app.stage,
          href: `/employer/applicants?q=${encodeURIComponent(profile.displayName)}`,
          score,
        });
      }
      push(rows);
    }

    // -- admin: user accounts ---------------------------------------------
    if (isAdmin && wanted("user")) {
      const rows: SearchHit[] = [];
      for (const u of await ctx.db.query("users").take(SCAN)) {
        if (u.deletedAt) continue;
        const score = scoreFields(needle, [
          [u.email, 9],
          [u.name, 8],
          [(u.roles ?? []).join(" "), 3],
        ]);
        if (score === 0) continue;
        rows.push({
          kind: "user",
          id: u._id as string,
          title: u.name ?? u.email ?? "Account",
          subtitle: u.email ?? (u.roles ?? []).join(", "),
          meta: u.suspendedAt ? "Suspended" : (u.roles ?? [])[0] ?? null,
          href: `/admin/users?q=${encodeURIComponent(u.email ?? u.name ?? "")}`,
          score,
        });
      }
      push(rows);
    }

    // -- admin: enquiries --------------------------------------------------
    if (isAdmin && wanted("enquiry")) {
      const rows: SearchHit[] = [];
      for (const e of await ctx.db.query("enquiries").take(SCAN)) {
        const score = scoreFields(needle, [
          [e.name, 9],
          [e.organisation, 7],
          [e.email, 6],
          [e.topic, 4],
          [e.message, 2],
        ]);
        if (score === 0) continue;
        rows.push({
          kind: "enquiry",
          id: e._id as string,
          title: e.name,
          subtitle: [e.organisation, e.message.slice(0, 70)].filter(Boolean).join(" · "),
          meta: e.status === "new" ? "New" : e.status,
          href: `/admin/enquiries?q=${encodeURIComponent(e.email)}`,
          score,
        });
      }
      push(rows);
    }

    // -- admin: pending verifications -------------------------------------
    if (isAdmin && wanted("verification")) {
      const rows: SearchHit[] = [];
      for (const s of await ctx.db.query("verificationSubmissions").take(SCAN)) {
        if (!OPEN_VERIFICATION_STATUSES.has(s.status)) continue;
        const score = scoreFields(needle, [
          [s.claimedName, 9],
          [s.claimedProgram, 5],
          [String(s.claimedBatch ?? ""), 4],
          [s.flags.join(" "), 2],
        ]);
        if (score === 0) continue;
        rows.push({
          kind: "verification",
          id: s._id as string,
          title: s.claimedName ?? "Verification request",
          subtitle: [s.claimedProgram, s.claimedBatch].filter(Boolean).join(" · "),
          meta: s.status === "pending-review" ? "Pending" : s.status,
          href: `/admin/alumni/approvals?q=${encodeURIComponent(s.claimedName)}`,
          score,
        });
      }
      push(rows);
    }

    // -- navigation --------------------------------------------------------
    if (wanted("page")) {
      push(
        DESTINATIONS.flatMap((d) => {
          if (!d.surfaces.includes(surface)) return [];
          const score = scoreFields(needle, [
            [d.label, 8],
            [d.keywords, 4],
          ]);
          return score === 0
            ? []
            : [{
                kind: "page" as const,
                id: d.href,
                title: d.label,
                subtitle: `${d.where} · ${d.href}`,
                meta: null,
                href: d.href,
                score,
              }];
        }),
      );
    }

    const counts: Record<string, number> = {};
    for (const h of hits) counts[h.kind] = (counts[h.kind] ?? 0) + 1;
    hits.sort((a, b) => b.score - a.score);

    return { hits, counts, total: hits.length, surface, truncated };
  },
});

/**
 * The search bar's "see all N results in …" footer links. Kept separate from
 * `universal` so the bar can offer a handoff into a real filtered list page
 * (which persists the filter, paginates, and bulk-selects) instead of trying
 * to be that page itself.
 */
export const scopesFor = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const needle = q.trim();
    if (needle.length < MIN_LENGTH) return [] as Array<{ label: string; href: string }>;
    const me = await getAuthUserId(ctx);
    const meUser = me ? await ctx.db.get(me) : null;
    if (!meUser || meUser.deletedAt) return [];
    const roles = meUser.roles ?? [];
    const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
    const encoded = encodeURIComponent(needle);
    // @full-scan-ok: employerOrgs membership is tested against the adminUserIds array, and Convex cannot index an array's elements
    const orgs = await ctx.db.query("employerOrgs").collect();
    const isEmployer = orgs.some((o) => (o.adminUserIds ?? []).includes(meUser._id as Id<"users">));

    if (isAdmin) {
      return [
        { label: "Alumni records", href: `/admin/alumni?q=${encoded}&src=quick` },
        { label: "Directory", href: `/admin/directory?q=${encoded}&src=quick` },
        { label: "Employers", href: `/admin/employers?q=${encoded}&src=quick` },
        { label: "Job postings", href: `/admin/jobs?q=${encoded}&src=quick` },
        { label: "Enquiries", href: `/admin/enquiries?q=${encoded}&src=quick` },
        { label: "User accounts", href: `/admin/users?q=${encoded}&src=quick` },
      ];
    }
    if (isEmployer) {
      return [
        { label: "Applicants", href: `/employer/applicants?q=${encoded}&src=quick` },
        { label: "My postings", href: `/employer/jobs?q=${encoded}&src=quick` },
      ];
    }
    return [
      { label: "Jobs", href: `/jobs?q=${encoded}` },
      { label: "Mentors", href: `/mentorship?q=${encoded}&src=quick` },
      { label: "Events", href: `/events?q=${encoded}` },
      { label: "Academy", href: `/academy?q=${encoded}` },
    ];
  },
});
