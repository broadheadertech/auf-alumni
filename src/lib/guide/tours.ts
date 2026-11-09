/**
 * Per-page guided tours.
 *
 * The written guide explains a screen; this walks you through it. Each step
 * points at a real element on the page — the actual Search box, the actual
 * Reset button — so the instruction and the thing it describes are never more
 * than a few pixels apart.
 *
 * Targets are `data-tour` attributes rather than CSS classes or structural
 * selectors, so restyling a page cannot silently break its tour. A step whose
 * target is missing is skipped at runtime rather than showing an arrow
 * pointing at nothing, which means a tour degrades quietly on a screen where
 * a feature is hidden by role or empty state.
 *
 * Keep steps short. This is a tooltip beside a control, not a paragraph —
 * anything longer than two sentences belongs in the written guide, which the
 * last step links to.
 */

export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

export type TourStep = {
  /** Value of the data-tour attribute to highlight. Omit for a centred step. */
  target?: string;
  title: string;
  body: string;
  placement?: TourPlacement;
};

export type Tour = {
  /** Exact pathname, or a prefix when it ends in "*". */
  route: string;
  /**
   * Exact paths a prefix route must not claim. `/admin/alumni/*` is meant for
   * `/admin/alumni/<id>`, not for the sibling `/admin/alumni/approvals`,
   * which is a different screen entirely.
   */
  exclude?: string[];
  /** Shown in the offer prompt and the tour header. */
  label: string;
  steps: TourStep[];
};

export const TOURS: Tour[] = [
  /* ------------------------------------------------------------- alumni */
  {
    route: "/feed",
    label: "Your home feed",
    steps: [
      {
        title: "This is your network's home",
        body: "Everything your fellow alumni post, plus what the university publishes. Four quick stops and you'll know your way around.",
        placement: "center",
      },
      {
        target: "nav-primary",
        title: "Everything lives here",
        body: "Jobs, Mentorship, Academy, Events, Messages and your Alumni ID. The badge on Messages counts unread replies.",
        placement: "right",
      },
      {
        target: "global-search",
        title: "One search for everything",
        body: "People, jobs, events and pages. Press ⌘K or Ctrl+K from anywhere — it's the fastest way to get around.",
        placement: "bottom",
      },
      {
        target: "network-panel",
        title: "Your connections at a glance",
        body: "Pending requests and how many alumni are open to mentoring right now.",
        placement: "left",
      },
      {
        target: "page-help",
        title: "Stuck on any screen?",
        body: "This button runs the tour for whichever page you're on, and links to the full written guide.",
        placement: "bottom",
      },
    ],
  },
  {
    route: "/profile/edit",
    label: "Building your profile",
    steps: [
      {
        title: "Your profile drives everything",
        body: "Job matching, mentor suggestions and who can find you all read these fields. It's worth ten minutes.",
        placement: "center",
      },
      {
        target: "profile-sections",
        title: "Work through the tabs",
        body: "Identity, Work, About, Contact, Experience and Education. The ring shows how complete you are.",
        placement: "right",
      },
      {
        target: "profile-sections",
        title: "Contact is closed by default",
        body: "Phone, address and your social links. Phone starts visible only to connections and your address only to you \u2014 open them up deliberately, never by accident.",
        placement: "right",
      },
      {
        target: "profile-sections",
        title: "Employment history takes real dates",
        body: "Under Experience, each role has From and To month pickers and an \"I currently work here\" tick. The dates are what tracer-study reporting counts.",
        placement: "right",
      },
      {
        title: "Every field has its own privacy",
        body: "Public, alumni-only, connections-only or private. Set it once and the whole site honours it.",
        placement: "left",
      },
      {
        target: "profile-save",
        title: "Save when you're done",
        body: "You can come back and change any of this at any time.",
        placement: "top",
      },
    ],
  },
  {
    route: "/jobs",
    label: "Finding a role",
    steps: [
      {
        title: "Roles from verified employers",
        body: "Every posting here is from an employer the university has checked, and reviewed before going live.",
        placement: "center",
      },
      {
        title: "Narrow it down",
        body: "Work mode, employment type and experience level. Your filters are remembered while you browse.",
        placement: "bottom",
      },
      {
        target: "jobs-list",
        title: "Sorted by fit",
        body: "Roles matching your skills and program come first, rather than just the newest.",
        placement: "right",
      },
    ],
  },
  {
    route: "/jobs/applications",
    label: "Tracking your applications",
    steps: [
      {
        title: "Where each application stands",
        body: "Updated by the employer as they move you along, so you're not left guessing.",
        placement: "center",
      },
      {
        title: "Your pipeline",
        body: "The stage chip shows where you are. \"CV reviewed\" means the employer has actually opened it.",
        placement: "top",
      },
      {
        target: "interview-invite",
        title: "Interview invitations appear here",
        body: "The time, place and any note from the employer, with buttons to confirm or decline.",
        placement: "top",
      },
      {
        target: "interview-invite",
        title: "Declining doesn't withdraw you",
        body: "If the time doesn't suit, say so and suggest when would \u2014 you stay in the process and they can propose another.",
        placement: "top",
      },
    ],
  },
  {
    route: "/id",
    label: "Your Alumni ID",
    steps: [
      {
        title: "Proof you're an AUF alumnus",
        body: "A digital card with a QR code, usable on campus and at partner events.",
        placement: "center",
      },
      {
        title: "Your card",
        body: "The QR code resolves to a public verification page, so anyone can check it's genuine without seeing your details.",
        placement: "right",
      },
      {
        title: "Issue, activate or replace",
        body: "Set a PIN when you activate. Report it lost here and the old one stops working immediately.",
        placement: "left",
      },
    ],
  },
  {
    route: "/mentorship",
    label: "Mentorship",
    steps: [
      {
        title: "Ask an alumnus for 30 minutes",
        body: "Alumni who've opted in to mentoring, filtered by what you want to talk about.",
        placement: "center",
      },
      {
        target: "mentorship-filters",
        title: "Find the right person",
        body: "By college, program or topic. Everyone listed has agreed to be approached.",
        placement: "bottom",
      },
      {
        title: "Send a request",
        body: "Say what you'd like to discuss. A specific ask gets a reply far more often than a general one.",
        placement: "right",
      },
    ],
  },

  /* ----------------------------------------------------------- employer */
  {
    route: "/employer/applicants",
    label: "Working through applicants",
    steps: [
      {
        title: "Everyone who applied",
        body: "Across all your postings, with the filters and actions you need to move people along.",
        placement: "center",
      },
      {
        target: "applicants-filters",
        title: "Narrow the list",
        body: "By posting, stage, college, batch or whether you've reviewed the CV yet.",
        placement: "bottom",
      },
      {
        target: "applicants-list",
        title: "Open a candidate",
        body: "Click a row for their profile snapshot, cover note, CV and salary expectation.",
        placement: "top",
      },
      {
        target: "interview-scheduler",
        title: "Schedule a screening",
        body: "Set a time, length, format and place. The candidate is notified and asked to confirm, and the application moves to the interview stage for you.",
        placement: "top",
      },
      {
        target: "interview-scheduler",
        title: "You can tell confirmed from unanswered",
        body: "\"Awaiting confirmation\" means they haven't replied yet; \"Confirmed\" means they have. Rescheduling clears a previous confirmation.",
        placement: "top",
      },
    ],
  },
  {
    route: "/employer/jobs",
    label: "Posting a job",
    steps: [
      {
        title: "Your postings",
        body: "Create a role, track applicants, and close it when you've hired.",
        placement: "center",
      },
      {
        target: "post-job",
        title: "Start here",
        body: "Title, location, work mode, salary and the skills you need. Required skills drive who sees it first.",
        placement: "bottom",
      },
      {
        target: "jobs-list",
        title: "Every posting is reviewed",
        body: "An AUF admin checks it before alumni see it. Status shows where yours is.",
        placement: "top",
      },
    ],
  },

  /* -------------------------------------------------------------- admin */
  {
    route: "/admin/dashboard",
    label: "Reading the dashboard",
    steps: [
      {
        title: "The whole network at a glance",
        body: "Live figures, not a snapshot. Four things worth knowing about this screen.",
        placement: "center",
      },
      {
        target: "dash-counts",
        title: "The headline numbers",
        body: "Employers, alumni, postings and hire rate. Each tile links to the records behind it.",
        placement: "bottom",
      },
      {
        target: "dash-attention",
        title: "What needs you today",
        body: "Only these are coloured, and only when something needs a decision — approvals waiting, contracts lapsing, postings to moderate.",
        placement: "bottom",
      },
      {
        target: "dash-insights",
        title: "The numbers, interpreted",
        body: "Generated from the live data — where the funnel leaks, which college places best, whether you're demand- or supply-constrained.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/alumni",
    label: "The alumni roster",
    steps: [
      {
        title: "Every registered graduate",
        body: "Their employment status, applications and verification state.",
        placement: "center",
      },
      {
        target: "roster-stats",
        title: "The roster in four numbers",
        body: "How many registered, open to work, hired through AUF, and actively applying.",
        placement: "bottom",
      },
      {
        target: "roster-filters",
        title: "Filter and search",
        body: "College narrows Program automatically. Batch takes a year or a range like 2018-2022. Filters survive navigating away and back.",
        placement: "bottom",
      },
      {
        target: "roster-table",
        title: "Open anyone",
        body: "Their full record: applications, CV, Alumni ID, account status, and the employment-status override.",
        placement: "top",
      },
    ],
  },
  {
    // Prefix: the route carries the alumnus id.
    route: "/admin/alumni/*",
    exclude: ["/admin/alumni/approvals"],
    label: "An alumnus record",
    steps: [
      {
        title: "Everything about one graduate",
        body: "Their applications, CV, Alumni ID and account status \u2014 and the one field an admin can override.",
        placement: "center",
      },
      {
        target: "employment-override",
        title: "Correcting employment status",
        body: "Alumni set this themselves, so it goes stale. If you learn otherwise \u2014 a tracer-study call, say \u2014 you can correct it here.",
        placement: "left",
      },
      {
        target: "employment-override",
        title: "A reason is required",
        body: "You're changing someone else's profile, so the reason is mandatory and goes into the audit log alongside the change.",
        placement: "left",
      },
    ],
  },
  {
    route: "/admin/users",
    label: "Managing accounts",
    steps: [
      {
        title: "Roles and account status",
        body: "Who can do what, and who's been suspended.",
        placement: "center",
      },
      {
        target: "users-filters",
        title: "Find an account",
        body: "By email or name, filtered by role or status.",
        placement: "bottom",
      },
      {
        target: "users-bulk",
        title: "Act on several at once",
        body: "Tick rows, or Select all, then suspend or change roles together. Each change is logged separately.",
        placement: "bottom",
      },
      {
        target: "users-table",
        title: "Per-row actions",
        body: "The ⋯ menu grants or revokes a role, or suspends the account. Suspension always asks for a reason, and the reason goes into the audit log.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/analytics",
    label: "Reading the analytics",
    steps: [
      {
        title: "How the marketplace is performing",
        body: "Sliceable by company, college and date — and every number links to its records.",
        placement: "center",
      },
      {
        target: "analytics-filters",
        title: "Choose your slice",
        body: "KPIs compare against the previous equal period, so a narrower range gives you a real comparison.",
        placement: "bottom",
      },
      {
        target: "analytics-kpis",
        title: "The four that matter",
        body: "Hire rate, applications, hires and time to hire, each against its target.",
        placement: "bottom",
      },
      {
        title: "Take it away",
        body: "Export CSV gives you the filtered rows for your own reporting.",
        placement: "left",
      },
    ],
  },
  {
    route: "/admin/moderation/jobs",
    label: "Moderating postings",
    steps: [
      {
        title: "Nothing reaches alumni unreviewed",
        body: "Every posting waits here until an admin approves it.",
        placement: "center",
      },
      {
        title: "Approve or reject",
        body: "Read the posting, check the employer's tier, then decide. Rejections ask for a reason the employer will see.",
        placement: "top",
      },
    ],
  },
];

/**
 * The tour for a pathname, or null.
 *
 * An exact route always beats a prefix one: `/admin/alumni` is the roster and
 * `/admin/alumni/<id>` is one record, and a prefix that also matched the bare
 * base would have given the roster the record's tour. Among prefixes, the
 * longest wins.
 */
export function tourForPath(pathname: string): Tour | null {
  const exact = TOURS.find((t) => !t.route.endsWith("*") && t.route === pathname);
  if (exact) return exact;

  let best: Tour | null = null;
  let bestLength = -1;

  for (const tour of TOURS) {
    if (!tour.route.endsWith("*")) continue;
    const base = tour.route.slice(0, -1);
    // Require something after the base, or a prefix would claim its own root.
    if (!pathname.startsWith(base) || pathname.length <= base.length) continue;
    if (tour.exclude?.includes(pathname)) continue;
    if (base.length > bestLength) {
      best = tour;
      bestLength = base.length;
    }
  }
  return best;
}
