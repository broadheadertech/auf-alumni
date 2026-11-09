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
  /* ----------------------------------------------------- admin: marketplace */
  {
    route: "/admin/employers",
    label: "Partner employers",
    steps: [
      {
        title: "Every organisation that can hire here",
        body: "Their tier, contract, documents on file and hiring activity.",
        placement: "center",
      },
      {
        target: "page-header",
        title: "The four numbers that matter",
        body: "Employers, active postings, applicants and hires through AUF.",
        placement: "bottom",
      },
      {
        target: "page-actions",
        title: "Onboard a new employer",
        body: "Add them, set a tier, then upload the MOA and NDA on their record.",
        placement: "left",
      },
      {
        target: "page-body",
        title: "Open any employer",
        body: "Contract dates, documents, every posting and its applicants. Contract colour warns you before one lapses.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/employers/*",
    exclude: ["/admin/employers/onboard"],
    label: "An employer record",
    steps: [
      {
        title: "Everything about one employer",
        body: "Contract, documents, postings and the people who applied to them.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Tier and contract",
        body: "Tier decides what they can do. Edit the contract dates here — the strip above turns amber inside 30 days and red once lapsed.",
        placement: "top",
      },
      {
        target: "page-body",
        title: "Suspending an employer",
        body: "Account status at the bottom hides them from the network. Reversible, and recorded in the audit log with your reason.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/jobs",
    label: "All job postings",
    steps: [
      {
        title: "Every posting across every employer",
        body: "For reading a pending submission in full, use Job moderation instead.",
        placement: "center",
      },
      {
        target: "page-header",
        title: "Pending review stands out",
        body: "That number is amber whenever something is waiting on you.",
        placement: "bottom",
      },
      {
        target: "page-body",
        title: "Approve or reject from the row",
        body: "Or open the posting to read it first. A rejection asks for a reason, and the employer sees it.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/jobs/*",
    label: "A job posting",
    steps: [
      {
        title: "One posting, in full",
        body: "What the employer wrote, and how it has performed.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Applicants and screening",
        body: "How many applied, how many CVs the employer actually opened, and how many were hired.",
        placement: "top",
      },
    ],
  },

  /* ----------------------------------------------------- admin: engagement */
  {
    route: "/admin/events",
    label: "Events",
    steps: [
      {
        title: "Alumni events and who they reach",
        body: "Everyone, or scoped to particular batches and programmes.",
        placement: "center",
      },
      {
        target: "page-actions",
        title: "Create an event",
        body: "Title, time, place and audience. Reach tells you how many verified alumni currently match.",
        placement: "left",
      },
      {
        target: "page-body",
        title: "Public or alumni only",
        body: "The chip on each row toggles it. Public events appear on the marketing home page to people who aren't signed in.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/events/*",
    exclude: ["/admin/events/new"],
    label: "An event",
    steps: [
      {
        title: "One event and its RSVPs",
        body: "Who is coming, who declined, and who hasn't answered.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Reminders and cancellation",
        body: "Send a reminder to everyone going. Cancelling notifies them rather than deleting the record.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/enquiries",
    label: "Enquiries",
    steps: [
      {
        title: "Messages from the public forms",
        body: "A copy is emailed to the AUF address for each topic; this is the record you can triage.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Work the queue",
        body: "Filter by topic or status, then mark each one handled so the next person knows.",
        placement: "top",
      },
    ],
  },

  /* ---------------------------------------------------------- admin: people */
  {
    route: "/admin/alumni/approvals",
    label: "Approving registrations",
    steps: [
      {
        title: "Nobody joins unchecked",
        body: "Every registration waits here until an admin verifies it.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Check the evidence",
        body: "The registry match and any uploaded document. Flagged rows are the ones the automatic check could not confirm.",
        placement: "top",
      },
      {
        target: "page-body",
        title: "Approve, reject, or ask",
        body: "Request more information rather than rejecting when a document is simply unclear — a rejection is a worse experience for a genuine alumnus than a second ask.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/directory",
    label: "The alumni directory",
    steps: [
      {
        title: "The full verified roster",
        body: "Admin-only. The directory is private to alumni and never exposed publicly.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Filter, then read across",
        body: "College narrows Programme. Batch takes a year or a range. The count tells you how much of the roster you are looking at.",
        placement: "top",
      },
    ],
  },

  /* --------------------------------------------- admin: trust and operations */
  {
    route: "/admin/audit",
    label: "The audit log",
    steps: [
      {
        title: "Every admin action, permanently",
        body: "Append-only: entries cannot be edited or removed, including by you.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Who did what, and why",
        body: "Filter by action or person. Anything that required a reason shows it here beside the change.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/compliance",
    label: "Compliance",
    steps: [
      {
        title: "Data rights and incidents",
        body: "Data Privacy Act requests, and the 72-hour incident window.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Data subject requests",
        body: "Export or erasure asked for by an alumnus. Each has a deadline you are accountable to.",
        placement: "top",
      },
      {
        target: "page-body",
        title: "Incidents",
        body: "Log one as soon as it is suspected. The clock starts at discovery, not at confirmation.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/reports",
    label: "Reports",
    steps: [
      {
        title: "Weekly and monthly summaries",
        body: "What happened across the network, ready to paste into a report.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "The operational picture",
        body: "Approvals, postings, applications and hires for the period.",
        placement: "top",
      },
    ],
  },

  /* ------------------------------------------------ admin: content management */
  {
    route: "/admin/content",
    label: "Editing the home page",
    steps: [
      {
        title: "The public home page, in your words",
        body: "Change the copy without a developer.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Edit any section",
        body: "Each field maps to a block on the live page. Reset returns one to its original wording.",
        placement: "top",
      },
      {
        target: "page-actions",
        title: "Check it before you leave",
        body: "View page opens the live home page in a new tab. Live figures come from the database and are not edited here.",
        placement: "left",
      },
    ],
  },
  {
    route: "/admin/articles",
    label: "The newsroom",
    steps: [
      {
        title: "News and announcements",
        body: "Drafts stay private; only published articles reach the public newsroom.",
        placement: "center",
      },
      {
        target: "page-actions",
        title: "Write one",
        body: "Title, body and an optional cover image. Save as a draft for as long as you like.",
        placement: "left",
      },
      {
        target: "page-body",
        title: "Published articles surface on the home page",
        body: "The three most recent appear in the Newsroom strip for visitors.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/articles/*",
    label: "Writing an article",
    steps: [
      {
        title: "One article",
        body: "Nothing here is public until you publish it.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "The URL is yours to set",
        body: "It becomes /news/your-slug. Changing it after publishing breaks any link already shared.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/settings",
    label: "Colleges and programmes",
    steps: [
      {
        title: "The academic structure",
        body: "What alumni choose from on their profile, and what every filter and report groups by.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Colleges hold programmes",
        body: "Add a college first, then its programmes. Selecting a college narrows the programme list everywhere in the app.",
        placement: "top",
      },
      {
        target: "page-body",
        title: "Archive rather than delete",
        body: "Archiving hides a programme from new selections without breaking the profiles already using it.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/lists/*",
    label: "Reference lists",
    steps: [
      {
        title: "The lists behind the dropdowns",
        body: "Areas, employment statuses and skill sets — edited here, used everywhere.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Add, rename, reorder",
        body: "Order here is the order alumni see. Renaming updates every profile already using the value.",
        placement: "top",
      },
      {
        target: "page-body",
        title: "Archiving is the safe removal",
        body: "It stops the value being offered to anyone new without changing the records that already have it.",
        placement: "top",
      },
    ],
  },
  {
    route: "/admin/cv-template",
    label: "The CV template",
    steps: [
      {
        title: "The official AUF CV",
        body: "Every alumnus generates theirs against this.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Branding and verification marks",
        body: "What appears on every generated CV, including the marks that make it checkable.",
        placement: "top",
      },
      {
        target: "page-actions",
        title: "Save when you're happy",
        body: "Changes apply to CVs generated from now on, not to ones already downloaded.",
        placement: "left",
      },
    ],
  },
  {
    route: "/admin/analytics/applications",
    label: "The records behind a number",
    steps: [
      {
        title: "Every application counted above",
        body: "You arrived from an analytics tile, and these are the rows it was counting.",
        placement: "center",
      },
      {
        target: "page-actions",
        title: "Take it with you",
        body: "Export CSV gives you exactly these rows, filters included.",
        placement: "left",
      },
    ],
  },

  /* ------------------------------------------------------------- employer */
  {
    route: "/employer/dashboard",
    label: "Your hiring at a glance",
    steps: [
      {
        title: "Where your hiring stands",
        body: "Live postings, applicants waiting, and what needs you today.",
        placement: "center",
      },
      {
        target: "nav-primary",
        title: "Everything from here",
        body: "Postings, applicants, messages, your company profile and billing.",
        placement: "right",
      },
    ],
  },
  {
    route: "/employer/company",
    label: "Your company profile",
    steps: [
      {
        title: "What alumni see about you",
        body: "This shows on your public company page and beside every posting.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Worth filling in properly",
        body: "A described company with a logo gets markedly more applications than a bare name.",
        placement: "top",
      },
    ],
  },
  {
    route: "/employer/analytics",
    label: "Your hiring performance",
    steps: [
      {
        title: "How your postings are doing",
        body: "Applications, screening and hires across everything you have posted.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Where candidates drop out",
        body: "The funnel shows which stage loses people. A wide gap between applied and screened usually means the posting is attracting the wrong candidates.",
        placement: "top",
      },
    ],
  },
  {
    route: "/employer/billing",
    label: "Billing",
    steps: [
      {
        title: "Your plan and invoices",
        body: "What you are on, what it includes, and what you have been charged.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Partner tiers post free",
        body: "If AUF has a partnership agreement with you, postings are included rather than charged per listing.",
        placement: "top",
      },
    ],
  },
  {
    route: "/employer/messages",
    label: "Messaging candidates",
    steps: [
      {
        title: "Conversations with applicants",
        body: "Only with people who applied to one of your postings.",
        placement: "center",
      },
      {
        target: "page-body",
        title: "Keep it on the platform",
        body: "Messages here are part of the application record, which protects both sides if anything is disputed later.",
        placement: "top",
      },
    ],
  },
  {
    route: "/employer/reports",
    label: "Employer reports",
    steps: [
      {
        title: "Your hiring, summarised",
        body: "Ready to pass to whoever asks for it internally.",
        placement: "center",
      },
    ],
  },

  /* --------------------------------------------------------------- alumni */
  {
    route: "/academy",
    label: "The Academy",
    steps: [
      {
        title: "Short courses from fellow alumni",
        body: "Written by people who have done the job, not by the university.",
        placement: "center",
      },
      {
        title: "Finish one and it shows",
        body: "Completed courses appear on your profile, which employers can see.",
        placement: "center",
      },
    ],
  },
  {
    route: "/events",
    label: "Events",
    steps: [
      {
        title: "What's coming up",
        body: "Reunions, talks and career nights, filtered to the ones you are eligible for.",
        placement: "center",
      },
      {
        title: "RSVP so they can plan",
        body: "Going, Maybe or Can't make it. You can change your answer at any time.",
        placement: "center",
      },
    ],
  },
  {
    route: "/messages",
    label: "Messages",
    steps: [
      {
        title: "Your conversations",
        body: "With fellow alumni you are connected to, and with employers you have applied to.",
        placement: "center",
      },
      {
        title: "Blocking is always available",
        body: "If a conversation goes wrong, block the person from their profile. They are not told.",
        placement: "center",
      },
    ],
  },
  {
    route: "/connections",
    label: "Your connections",
    steps: [
      {
        title: "Who you know here",
        body: "Accepted connections, and requests waiting on you.",
        placement: "center",
      },
      {
        title: "Connections unlock more of a profile",
        body: "Fields someone has set to connections-only become visible once you are connected.",
        placement: "center",
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
