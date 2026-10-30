/**
 * The in-app user guide — one step-by-step walkthrough per tab.
 *
 * Deliberately not a PDF or a printed handout: those go stale the moment a
 * screen changes and nobody can find them six months later. This lives inside
 * the product, beside the tabs it describes, so it works as a first-run guide
 * AND as a refresher you can jump back into from the page you're stuck on.
 *
 * Content is data, not JSX, so the same topics can be listed, searched,
 * deep-linked (/guide?topic=jobs) and indexed by the universal search bar.
 *
 * KEEPING THIS HONEST: every step below names a control that exists today. If
 * you move or rename a button, update its step in the same change — a guide
 * that describes buttons nobody can find is worse than no guide at all.
 */

export type Surface = "alumni" | "employer" | "admin";

export type GuideTopic = {
  /** Stable id used in the URL (?topic=) and for progress tracking. */
  slug: string;
  /** The tab's label, exactly as it reads in the sidebar. */
  tab: string;
  /**
   * Where the tab lives, so the guide can link straight to it. A dynamic
   * segment (e.g. /profile/[slug]) marks a screen you reach from elsewhere
   * rather than open directly — the guide then omits its "Open" button.
   */
  href: string;
  /**
   * Extra path prefixes this walkthrough also answers for, where the tab spans
   * routes its href doesn't cover — /admin/lists/statuses isn't under
   * /admin/lists/areas, but it's the same screen.
   */
  alsoCovers?: string[];
  surface: Surface;
  /** Which sidebar group this tab sits under. */
  group: string;
  /** One sentence: what this tab is for and who uses it. */
  purpose: string;
  /** The walkthrough. Each entry is one action the reader takes. */
  steps: string[];
  /** Things that aren't steps but save people time. */
  tips?: string[];
  /** Other topic slugs worth reading next. */
  seeAlso?: string[];
};

export const SURFACE_LABEL: Record<Surface, string> = {
  alumni: "For alumni",
  employer: "For employers",
  admin: "For AUF staff",
};

export const SURFACE_INTRO: Record<Surface, string> = {
  alumni:
    "Everything in your account, tab by tab. Each walkthrough is short — read the one you need, when you need it.",
  employer:
    "How to run your hiring on the AUF network, from your company page to the applicant pipeline and your monthly reports.",
  admin:
    "The Alumni Relations console, tab by tab: who to verify, what to moderate, what the numbers mean, and which lists feed the rest of the system.",
};

// ─────────────────────────────────────────────────────────────── alumni ───

const ALUMNI: GuideTopic[] = [
  {
    slug: "start-alumni",
    tab: "Start here",
    href: "/feed",
    surface: "alumni",
    group: "First steps",
    purpose:
      "The four things worth doing in your first ten minutes, in the order that makes the rest of the network useful.",
    steps: [
      "Finish your profile first. Open Profile → Edit profile and fill in your batch, program, current role and city. Almost everything else — job matching, mentor suggestions, who can find you — reads from these fields, so an empty profile makes the whole site look empty.",
      "Add a photo. On the same screen, press Upload next to your initials and pick any photo; it is resized for you, so a large phone photo is fine.",
      "Set your privacy. Still on Edit profile, each field has its own visibility: public, alumni-only, connections-only, or private. Set these once and the rest of the site honours them everywhere.",
      "Issue your Alumni ID. Open the Alumni ID tab and press Issue my ID — this is your proof of membership and takes a few seconds.",
      "Then look around: Jobs for roles matched to your profile, Mentorship to ask an alumnus for 30 minutes, Events for what's coming up.",
    ],
    tips: [
      "Press ⌘K (or Ctrl+K) anywhere to search people, jobs, events and pages — it is the fastest way to get around.",
      "You can reopen this guide at any time from the Guide link in the sidebar.",
    ],
    seeAlso: ["profile", "alumni-id", "jobs"],
  },
  {
    slug: "getting-verified",
    tab: "Signing up and getting verified",
    href: "/verification",
    alsoCovers: ["/verify", "/welcome", "/signup", "/activate-id"],
    surface: "alumni",
    group: "First steps",
    purpose:
      "How a new account becomes a verified one — the step between signing up and being able to use the network.",
    steps: [
      "Sign up with your name, batch year and program. Use the name AUF has on record, not a nickname — it is matched against the registrar.",
      "Your details are checked against the AUF registrar automatically. A clean match approves you straight away.",
      "If anything is ambiguous, your account goes to the Alumni Relations office for review, and you may be asked to upload a photo of your student ID, diploma or transcript.",
      "Watch your email — you are notified at every status change, and you can check progress when you sign in.",
      "Once approved, sign in and you land on your feed. Fill in your profile next.",
      "If you asked for a physical Alumni ID, you will get an email link to set a PIN. Open it and choose a PIN you keep private — staff never see it.",
    ],
    tips: [
      "Most accounts are verified within two business days. Reviews needing extra documents can take up to five.",
      "Graduated before 1990? Older records may not be digitised yet — email alumni@auf.edu.ph so your file can be prioritised.",
    ],
    seeAlso: ["start-alumni", "profile", "alumni-id"],
  },
  {
    slug: "signing-in",
    tab: "Signing in and password help",
    href: "/login",
    alsoCovers: ["/forgot-password", "/reset-password"],
    surface: "alumni",
    group: "First steps",
    purpose:
      "Getting back into your account, and what to do when you can't.",
    steps: [
      "Sign in with the email address you registered with and your password.",
      "Forgotten it? Press Forgot password on the sign-in screen and enter your email.",
      "Open the reset link in the email you receive and choose a new password. The link is single-use and expires, so request a fresh one if it has been sitting a while.",
      "Still stuck — for example the email never arrives, or you no longer have access to that address — contact the Alumni Relations office through the Contact page rather than making a second account.",
    ],
    tips: [
      "One account per person. A duplicate registration goes back into the verification queue and slows you down rather than speeding you up.",
    ],
    seeAlso: ["getting-verified", "settings"],
  },
  {
    slug: "viewing-profiles",
    tab: "Someone else's profile",
    href: "/profile/[slug]",
    alsoCovers: ["/profile", "/u"],
    surface: "alumni",
    group: "Everyday",
    purpose:
      "What you can see and do on another alumnus's profile — and why you sometimes see less than you expect.",
    steps: [
      "Open a profile from the feed, the search bar, a mentor card, or a job applicant list.",
      "Press Connect to send a connection request, or Message to start a conversation.",
      "Endorse a skill they have listed, if you can vouch for it.",
      "Use Follow to see their posts without connecting.",
      "Some fields may be hidden. Each person chooses, field by field, whether something is public, alumni-only, connections-only or private — so a connection sees more than a stranger does.",
    ],
    tips: [
      "If a field you expected is missing, it is almost always their privacy setting rather than an empty profile.",
      "Your own profile looks the same to others. Check yours with the preview on Edit profile.",
    ],
    seeAlso: ["profile", "connections", "messages"],
  },
  {
    slug: "home",
    tab: "Home",
    href: "/feed",
    surface: "alumni",
    group: "Everyday",
    purpose:
      "Your feed — what other alumni are posting, plus a side rail with jobs matched to you, upcoming events and people worth knowing.",
    steps: [
      "Write an update in the box at the top and press Post. Choose who sees it before posting — the visibility control sits on the composer.",
      "Scroll the feed to read posts from other alumni.",
      "On any post, use Message to start a conversation with the author, or Connect to send them a connection request.",
      "Use the right-hand rail as your shortcut list: matched jobs, upcoming events and suggested people all link straight through.",
    ],
    seeAlso: ["connections", "messages"],
  },
  {
    slug: "jobs",
    tab: "Jobs",
    href: "/jobs",
    surface: "alumni",
    group: "Everyday",
    purpose:
      "Every role employers have posted to the AUF network, ranked by how well it fits your profile.",
    steps: [
      "The board opens with every published role, best fit first. The percentage on a card is how well it matches your program, skills, batch and city.",
      "Tick Best matches only to narrow it to strong fits; untick it to see everything again.",
      "Narrow further with the controls along the top: search by title, company or keyword; employment type; work mode; minimum salary; or a specific company.",
      "Change the ordering with the sort control — Best match, Most recent, or Salary (high to low).",
      "Click any role to read it in the right-hand pane: About the role, Required skills, Key responsibilities, Requirements, and Benefits & perks.",
      "Press Apply now. In the dialog you can add a cover note, optionally share a salary expectation, and choose your CV: use your saved resume, upload a file just for this application, or apply without one.",
      "Send the application. The card then shows an Applied chip so you don't apply twice.",
    ],
    tips: [
      "Roles you've already applied to stay on the board, marked Applied — the count in the sidebar badge only counts strong matches you haven't applied to yet.",
      "A thin match score usually means your profile is thin. Adding skills and your program to your profile changes what you see here.",
    ],
    seeAlso: ["applications", "resume", "profile"],
  },
  {
    slug: "applications",
    tab: "My applications",
    href: "/jobs/applications",
    surface: "alumni",
    group: "Everyday",
    purpose:
      "Your own tracker for every job you've applied to, and where each one has reached.",
    steps: [
      "Open it from My applications at the top of the Jobs tab.",
      "Each row is one application, showing the role and its current pipeline stage.",
      "Check the CV reviewed marker — it appears only when the employer has actually opened your CV, so it tells you more than the stage alone.",
      "To follow up, open Messages and write to the employer; they can reply in the same thread.",
    ],
    tips: [
      "This screen is read-only. Stages change when the employer moves you, not when you refresh.",
    ],
    seeAlso: ["jobs", "messages"],
  },
  {
    slug: "mentorship",
    tab: "Mentorship",
    href: "/mentorship",
    surface: "alumni",
    group: "Everyday",
    purpose:
      "Short, structured 30-minute sessions with alumni who have volunteered to mentor — and the place you manage requests in both directions.",
    steps: [
      "On Find a mentor, narrow the list with the filter panel: college, program, batch and city.",
      "Read a card to see what that alumnus does now and what they can help with.",
      "Press Request mentorship. Say what you want to talk about, then propose up to three times that suit you.",
      "Send the request. The mentor picks one of your times or declines — you'll be notified either way.",
      "Switch to My requests to see Requests to you (people asking you to mentor them) and Requests you sent.",
      "On any request, use Message to open the conversation with that person, or View profile to read more about them.",
      "As a mentor, Accept or Decline incoming requests, and press Mark complete once a session has happened.",
    ],
    tips: [
      "To appear in this list yourself, open Edit profile and add Mentorship under “Open to”.",
      "Mentors answer far more often when your topic is specific. “How do I move from support into QA?” beats “career advice”.",
    ],
    seeAlso: ["profile", "messages"],
  },
  {
    slug: "academy",
    tab: "Academy",
    href: "/academy",
    surface: "alumni",
    group: "Everyday",
    purpose:
      "Short how-to courses taught by verified alumni — practical things people in the network actually know.",
    steps: [
      "Browse the courses, or narrow them by category and level.",
      "Open a course to read what it covers and who teaches it, then enrol.",
      "Work through the lessons in order. Each one you finish is ticked off, and your progress is kept.",
      "When you finish the last lesson a completion panel appears: share it to your feed, ask the instructor a question, request mentorship from them if they're open to it, or pick your next course from Keep going.",
    ],
    seeAlso: ["teach", "mentorship"],
  },
  {
    slug: "teach",
    tab: "Teach a course",
    href: "/academy/teach",
    surface: "alumni",
    group: "Everyday",
    purpose:
      "Your instructor dashboard — create and manage courses you teach on AUF Academy.",
    steps: [
      "From the Academy tab, press Teach a course.",
      "Press Create a course and give it a title, summary, category and level.",
      "Add your lessons in the order students should take them.",
      "Publish when it's ready. Until then it stays a draft that only you can see.",
      "Come back to this dashboard to edit a course or check who has enrolled.",
    ],
    seeAlso: ["academy"],
  },
  {
    slug: "events",
    tab: "Events",
    href: "/events",
    alsoCovers: ["/rsvp"],
    surface: "alumni",
    group: "Everyday",
    purpose: "Reunions, webinars and meetups, and your RSVP to each.",
    steps: [
      "Switch between Upcoming and Past, filter by category, or search by name.",
      "Open an event to read the details, the agenda and where it is — online events show a join link.",
      "RSVP with Yes or Maybe. Both are counted and both are visible to the organiser.",
      "If an event is full, press Join waitlist — you'll be moved up automatically if space opens.",
      "Changed your mind? Use Switch to Yes, Switch to Maybe, or Cancel RSVP on the same event.",
    ],
    tips: [
      "Some events are aimed at particular batches or programs. If you see “Not your audience”, the event is open only to a specific group.",
    ],
  },
  {
    slug: "messages",
    tab: "Messages",
    href: "/messages",
    surface: "alumni",
    group: "Everyday",
    purpose: "Your conversations with other alumni and with employers you've applied to.",
    steps: [
      "Pick a conversation from the list to read it.",
      "Type in the box at the bottom and send. The other person is notified.",
      "To start a new conversation, go to the person's profile and press Message — or use the Message button on their post in the feed.",
      "Opening a conversation marks it read and clears its notification.",
    ],
    tips: [
      "You can message verified alumni, and employers whose postings you applied to. If someone can't be messaged, the composer says so instead of failing silently.",
    ],
    seeAlso: ["connections"],
  },
  {
    slug: "alumni-id",
    tab: "Alumni ID",
    href: "/id",
    alsoCovers: ["/how-to-set-up-alumni-id", "/i", "/verify"],
    surface: "alumni",
    group: "Everyday",
    purpose:
      "Your digital AUF credential — proof you're a verified alumnus, with a QR code anyone can scan to check.",
    steps: [
      "Open the Alumni ID tab and press Issue my ID.",
      "Your card shows your name, batch, program, college, the date you were verified, and your Alumni ID number.",
      "Use Save / print to keep a copy on your phone or print it.",
      "Anyone can scan the QR code to confirm the card is genuine — it opens a verification page on this site.",
    ],
    tips: [
      "The ID only issues once your account is verified. If it says verification is pending, your registration is still with the Alumni Relations office.",
    ],
    seeAlso: ["profile"],
  },
  {
    slug: "connections",
    tab: "Connections",
    href: "/connections",
    surface: "alumni",
    group: "Your account",
    purpose: "The alumni you're connected to, and requests waiting on you.",
    steps: [
      "Open Connections from the sidebar.",
      "Under the pending tab, Accept or Decline each request waiting for you.",
      "Send a request from anyone's profile with the Connect button.",
      "Once connected you can message each other, and connections-only fields on their profile become visible to you.",
    ],
    seeAlso: ["messages", "profile"],
  },
  {
    slug: "profile",
    tab: "Edit profile",
    href: "/profile/edit",
    surface: "alumni",
    group: "Your account",
    purpose:
      "Everything other people see about you — and the single screen that most affects how useful the rest of the site is to you.",
    steps: [
      "Press Upload next to your initials to add a photo. Any common photo format works and large files are resized automatically.",
      "Fill in Identity: display name, batch, program and degree.",
      "Fill in your work: employment status, current role, company, city and country.",
      "Write a short About. Two or three sentences is plenty.",
      "Add your Skills. These drive job matching, so be specific and list the ones you'd actually want to be hired for.",
      "Set Open to — mentorship, job referrals, and so on. Adding Mentorship here is what puts you in the mentor list.",
      "Set the visibility of each field: public, alumni-only, connections-only, or private.",
      "Press Save changes.",
    ],
    tips: [
      "Your photo saves as soon as it uploads — it isn't waiting on Save changes.",
      "Use the preview to see your profile as a stranger, a fellow alumnus, or a connection would.",
    ],
    seeAlso: ["settings", "jobs", "mentorship"],
  },
  {
    slug: "settings",
    tab: "Settings",
    href: "/settings",
    surface: "alumni",
    group: "Your account",
    purpose:
      "Discovery banners, your data, and your account — including closing it.",
    steps: [
      "Turn on Open to work and add a short note if you want employers to see you're looking.",
      "Turn on Open to hire if you're the one hiring — this surfaces you on your company's page.",
      "Press Save discovery banners.",
      "Use Export my data to download everything the network holds about you.",
      "Delete my account removes your profile from the directory immediately; it is permanently deleted after a 30-day grace period, during which signing in again reactivates it.",
    ],
    seeAlso: ["notifications", "resume", "profile"],
  },
  {
    slug: "notifications",
    tab: "Notification preferences",
    href: "/settings/notifications",
    surface: "alumni",
    group: "Your account",
    purpose: "What the network emails you, and what it only shows in the app.",
    steps: [
      "Go through each kind of notification — messages, connection requests, event reminders and the rest.",
      "For each, choose whether you want it in the app, by email, or not at all.",
      "Set your Digest frequency, or set it to Off to stop digest emails entirely.",
      "Your choices save as you make them.",
    ],
    tips: [
      "Turning email off still leaves notifications in the bell icon — you just won't be emailed.",
    ],
    seeAlso: ["settings"],
  },
  {
    slug: "resume",
    tab: "Resume / CV",
    href: "/settings/resume",
    alsoCovers: ["/resume/preview"],
    surface: "alumni",
    group: "Your account",
    purpose:
      "Your default CV, reused on every job application — either a file you upload or one generated from your profile.",
    steps: [
      "To use your own CV, upload a PDF, DOC or DOCX. It's saved to your profile and offered on every application.",
      "To generate one instead, press the generate option — it opens an AUF-branded CV built from your profile in a new tab.",
      "In that tab, choose which optional sections to include, then print to PDF using your browser.",
      "Optionally upload that PDF back here so it becomes your saved CV.",
    ],
    tips: [
      "The generated CV uses AUF's official template, including the verification seal — so it's visibly a verified alumnus's CV.",
      "A generated CV is only as good as your profile. Fill in your experience and skills first.",
    ],
    seeAlso: ["profile", "jobs"],
  },
];

// ───────────────────────────────────────────────────────────── employer ───

const EMPLOYER: GuideTopic[] = [
  {
    slug: "start-employer",
    tab: "Start here",
    href: "/employer/dashboard",
    surface: "employer",
    group: "First steps",
    purpose:
      "Getting from a new employer account to your first application, in order.",
    steps: [
      "Complete your company profile first. Employers with a filled-in page get noticeably more applicants, because alumni can see who they'd be joining.",
      "Post your first role from Job postings. It goes to AUF for review before alumni see it.",
      "Wait for approval. AUF reviews every posting; you'll see the status change from Pending review to Published.",
      "Watch Applicants as candidates come in, and move them through your pipeline.",
      "Use Messages to talk to anyone who applied.",
    ],
    tips: [
      "Press ⌘K (or Ctrl+K) anywhere to search your postings, applicants and pages.",
    ],
    seeAlso: ["employer-company", "employer-jobs", "employer-applicants"],
  },
  {
    slug: "employer-dashboard",
    tab: "Dashboard",
    href: "/employer/dashboard",
    surface: "employer",
    group: "Everyday",
    purpose:
      "Your hiring at a glance: headline numbers, pipeline snapshot, how each posting is performing, and who just applied.",
    steps: [
      "Read the top row for your counts: postings, published, pending review and total applicants.",
      "Check the pipeline snapshot to see where candidates are stacking up.",
      "Scan posting performance to see which roles are attracting applicants and which aren't.",
      "Use the recent applicants list to jump straight to someone who just applied.",
    ],
    seeAlso: ["employer-analytics", "employer-applicants"],
  },
  {
    slug: "employer-company",
    tab: "Company profile",
    href: "/employer/company",
    surface: "employer",
    group: "Everyday",
    purpose:
      "Your public page on the AUF network — what alumni read before deciding whether to apply.",
    steps: [
      "Upload your logo.",
      "Write a tagline (one line) and an About section describing what you do.",
      "Fill in your industry, company size, founding year and headquarters.",
      "Add your website and a contact email.",
      "Save. Your page updates for alumni immediately.",
    ],
    tips: [
      "Your company name and trust tier are read-only here. They are what AUF verified, so changes go through the Alumni Relations office.",
    ],
    seeAlso: ["employer-jobs"],
  },
  {
    slug: "employer-jobs",
    tab: "Job postings",
    href: "/employer/jobs",
    surface: "employer",
    group: "Everyday",
    purpose:
      "Your listings, their status, and how many people have applied to each.",
    steps: [
      "Use the tabs to filter: All, Published, Pending, Suspended or Closed.",
      "Press Post a job to create a role.",
      "Fill in the basics: title, location, work mode, employment type and experience level.",
      "Write the description, then fill in Key responsibilities, Requirements and Benefits as separate lists — alumni see these as their own sections, and postings that have them get taken more seriously.",
      "Add the required skill sets for the role. These drive how well the posting matches each alumnus, so they decide who sees it high on their board.",
      "Optionally set a salary range and a closing date.",
      "Submit. The posting is created as Pending review and goes to AUF; it reaches alumni once an admin approves it.",
    ],
    tips: [
      "Each posting shows a stage breakdown, so you can see at a glance where its candidates are.",
      "Your plan sets how many posts you can run — see Billing.",
    ],
    seeAlso: ["employer-applicants", "employer-billing"],
  },
  {
    slug: "employer-applicants",
    tab: "Applicants",
    href: "/employer/applicants",
    surface: "employer",
    group: "Everyday",
    purpose:
      "Every candidate who applied to your postings, and the pipeline you move them through.",
    steps: [
      "Narrow the list with the filter panel: search, posting, stage, college and program, batch year or range, city, CV review state, and applied date range.",
      "Open a candidate to read their profile as they chose to share it, plus their cover note and CV.",
      "Move them through the pipeline as you go — the stage is saved and the candidate sees it on their own tracker.",
      "Press Message to contact them directly; they can reply from their Messages tab.",
      "Press Reset filters to clear everything and start again.",
    ],
    tips: [
      "Your filters are remembered as you move around the site, so you don't lose your place.",
      "Opening a CV marks it reviewed, and the candidate can see that. It's a signal worth using deliberately.",
    ],
    seeAlso: ["employer-messages", "employer-analytics"],
  },
  {
    slug: "employer-messages",
    tab: "Messages",
    href: "/employer/messages",
    surface: "employer",
    group: "Everyday",
    purpose: "Conversations with alumni who applied to your postings.",
    steps: [
      "Your contacts are the people who applied to your roles — one entry per person.",
      "Pick a conversation, or start one from a candidate in Applicants.",
      "Write and send. They're notified and can reply from their own Messages tab.",
      "Unread conversations show a count on the Messages item in the sidebar.",
    ],
    seeAlso: ["employer-applicants"],
  },
  {
    slug: "employer-analytics",
    tab: "Analytics",
    href: "/employer/analytics",
    surface: "employer",
    group: "Insights",
    purpose:
      "How your hiring is actually performing: hire rate, funnel, trend over time, and time-to-hire.",
    steps: [
      "Set the date range you care about.",
      "Read the funnel to see where candidates drop out — that's usually where the problem is.",
      "Check time-to-hire. A long one costs you candidates to faster employers.",
      "Use the breakdowns by posting and by applicant college to see which roles and which parts of the network are working for you.",
    ],
    tips: [
      "These numbers come from the same records as your Reports tab and AUF's own analytics, so they agree with what the school sees.",
    ],
    seeAlso: ["employer-reports", "employer-dashboard"],
  },
  {
    slug: "employer-reports",
    tab: "Reports",
    href: "/employer/reports",
    surface: "employer",
    group: "Insights",
    purpose: "Exportable hiring summaries, for your own records or your board.",
    steps: [
      "Choose the period you want to report on.",
      "Read the monthly table: applications, interviews, offers, hires and your hire rate.",
      "Export what you need as CSV — the applicant list, posting performance, or the college breakdown.",
      "The file downloads straight to your computer; open it in Excel or Sheets.",
    ],
    seeAlso: ["employer-analytics"],
  },
  {
    slug: "employer-billing",
    tab: "Billing",
    href: "/employer/billing",
    surface: "employer",
    group: "Insights",
    purpose: "Your plan, your posting allowance, and your payment history.",
    steps: [
      "Check your current plan and how many posts it includes each month.",
      "Review your recent billing events.",
      "To change plan, start checkout from here.",
      "Plans are monthly with a posting allowance — Starter (1 post), Growth (5 posts), or Scale (unlimited, by arrangement).",
    ],
    tips: [
      "Unused posts don't roll over to the next month.",
    ],
    seeAlso: ["employer-jobs"],
  },
];

// ──────────────────────────────────────────────────────────────── admin ───

const ADMIN: GuideTopic[] = [
  {
    slug: "start-admin",
    tab: "Start here",
    href: "/admin/dashboard",
    surface: "admin",
    group: "First steps",
    purpose:
      "What an Alumni Relations officer does each day, and which tab each job lives on.",
    steps: [
      "Open the Dashboard and read the Needs attention band — approvals waiting, contracts expiring, postings to review. That's your to-do list.",
      "Clear the approval queue: Approvals, under People. Every registration waits there until someone decides.",
      "Clear the posting queue: Job moderation, under Marketplace. Nothing reaches alumni until it's approved.",
      "Answer anything in Enquiries, under Trust & operations — that's the public contact form.",
      "Once a week, look at Analytics for how hiring is going, and Reports for the summary.",
    ],
    tips: [
      "Press ⌘K (or Ctrl+K) anywhere and type what you want — a person, a company, or a page like “approvals”.",
      "Every decision you make is written to the Audit log with your name against it.",
    ],
    seeAlso: ["admin-approvals", "admin-job-moderation", "admin-enquiries"],
  },
  {
    slug: "admin-dashboard",
    tab: "Dashboard",
    href: "/admin/dashboard",
    surface: "admin",
    group: "Overview",
    purpose:
      "The office's at-a-glance view, from headline counts down to what needs doing today.",
    steps: [
      "Read the core counts at the top: employers, alumni, postings and hire rate.",
      "Work the Needs attention band — approvals, expiring contracts, postings to review.",
      "Read the Insights strip, where the dashboard interprets its own numbers for you.",
      "Check Outcomes: hires, time-to-hire, and supply against demand.",
      "Look at Engagement for new signups, the registration trend, and upcoming events.",
      "Use the View list link on any tile to jump to the full, pre-filtered list behind that number.",
    ],
    seeAlso: ["admin-analytics", "admin-approvals"],
  },
  {
    slug: "admin-alumni",
    tab: "Alumni",
    href: "/admin/alumni",
    surface: "admin",
    group: "People",
    purpose:
      "The full roster of registered alumni with their employment signals — who's hired, who's looking, who's applying to what.",
    steps: [
      "Filter with the panel: college and program, batch year or range, work status, employment status and more.",
      "Read each row for hired or open-to-work status, what roles they're applying to, whether they have a CV, and their top skills.",
      "Open a record for the full detail on one alumnus.",
      "Press Reset filters to start over.",
    ],
    seeAlso: ["admin-directory", "admin-approvals"],
  },
  {
    slug: "admin-approvals",
    tab: "Approvals",
    href: "/admin/alumni/approvals",
    surface: "admin",
    group: "People",
    purpose:
      "The verification queue — every registration waiting on a decision. This is the gate the whole network's trust rests on.",
    steps: [
      "Open Approvals. Each entry is one person waiting to be admitted.",
      "Read what they claimed: name, batch year and program.",
      "Check the registry match and any flags — a name mismatch, no registry match, or a low-quality ID all appear here.",
      "Open their uploaded ID or diploma if one was provided.",
      "Decide: Approve to admit them, Reject, or Request more info if something is missing.",
      "Decided entries leave the queue immediately.",
    ],
    tips: [
      "Request more info rather than rejecting when a document is simply unclear — a rejection is a worse experience for a genuine alumnus than a second ask.",
      "Every decision is audited, with your name and the reason you gave.",
    ],
    seeAlso: ["admin-alumni", "admin-audit"],
  },
  {
    slug: "admin-directory",
    tab: "Directory",
    href: "/admin/directory",
    surface: "admin",
    group: "People",
    purpose:
      "Browse the whole verified-alumni roster. Admin-only by design — alumni have no directory of their own, because field-level privacy is a hard requirement.",
    steps: [
      "Use the filter panel to narrow by college, program, batch, city and more.",
      "Search by name, role or company.",
      "Open anyone's record to see their full profile.",
      "The filters live in the URL, so you can copy the address and send a colleague exactly the view you're looking at.",
    ],
    seeAlso: ["admin-alumni"],
  },
  {
    slug: "admin-cv-template",
    tab: "CV template",
    href: "/admin/cv-template",
    surface: "admin",
    group: "People",
    purpose:
      "The official AUF CV template that alumni generate their resumes from.",
    steps: [
      "Set the branding: band colour, organisation name, subtitle and tagline.",
      "Configure the verification watermark and seal.",
      "Write the footer line that appears on every generated CV.",
      "For each section, choose whether it's required, optional, or hidden. Required sections always appear; optional ones the alumnus can toggle.",
      "Check the live band preview to see what alumni will get, then save.",
    ],
    seeAlso: ["admin-content"],
  },
  {
    slug: "admin-employers",
    tab: "Employers",
    href: "/admin/employers",
    surface: "admin",
    group: "Marketplace",
    purpose:
      "Every employer organisation: who they are, what you've signed with them, and how much hiring they're actually doing.",
    steps: [
      "Filter by search, trust tier, contract status, industry, HQ city, or whether documents are on file.",
      "Read each row for the contract window, uploaded MOA/NDA, number of postings and number of applicants.",
      "Sort by any column to find, for example, partners whose contracts are about to lapse.",
      "Open an employer for the full record, where you can edit their details and upload documents.",
      "Use Onboard to add a new employer organisation.",
    ],
    tips: [
      "Contract expiry shows on the Dashboard's Needs attention band, so lapsing partners surface before they lapse.",
    ],
    seeAlso: ["admin-job-postings", "admin-enquiries"],
  },
  {
    slug: "admin-job-postings",
    tab: "Job postings",
    href: "/admin/jobs",
    surface: "admin",
    group: "Marketplace",
    purpose: "Every posting across every employer, in one list.",
    steps: [
      "Filter by search, status, company, employment type, location or posted-date range.",
      "Sort by applicants or by recency to find the roles that matter.",
      "Approve or reject a pending post inline.",
      "Open a posting to read it in full.",
    ],
    tips: [
      "For a considered decision on a pending posting, use Job moderation instead — it shows the entire posting, not just a row.",
    ],
    seeAlso: ["admin-job-moderation"],
  },
  {
    slug: "admin-job-moderation",
    tab: "Job moderation",
    href: "/admin/moderation/jobs",
    surface: "admin",
    group: "Marketplace",
    purpose:
      "The review queue for employer-submitted postings. Nothing reaches alumni until it passes through here.",
    steps: [
      "Open the queue — every posting awaiting review is listed.",
      "Read the full posting: overview, responsibilities, requirements, benefits, compensation and who it's targeted at.",
      "Approve to publish it to alumni, or Reject with a reason the employer will see.",
      "To clear several at once, use Select all (or tick them individually), then approve or reject — you give one reason for the batch.",
    ],
    tips: [
      "Check that the targeting is reasonable. A posting aimed at a batch or program it has nothing to do with will annoy the alumni it reaches.",
    ],
    seeAlso: ["admin-job-postings", "admin-audit"],
  },
  {
    slug: "admin-analytics",
    tab: "Analytics",
    href: "/admin/analytics",
    surface: "admin",
    group: "Marketplace",
    purpose:
      "The network's performance: how many alumni are being hired, by whom, out of which colleges — and what the numbers imply.",
    steps: [
      "Set the slice you want: company, college and date range.",
      "Read the hiring KPIs, including period-over-period movement and how you're tracking against target.",
      "Read the auto-generated insights strip — it calls out what changed without you hunting for it.",
      "Look at hardest-to-fill postings, not just the most popular ones. That's where employers need help.",
      "Compare supply against demand by college to see where the network is over- or under-supplied.",
      "Use the quick links on any figure to open the list behind it.",
    ],
    seeAlso: ["admin-reports", "admin-dashboard"],
  },
  {
    slug: "admin-events",
    tab: "Events",
    href: "/admin/events",
    surface: "admin",
    group: "Engagement",
    purpose: "Every published event, who it reaches, and who has said yes.",
    steps: [
      "Filter by search, status, category, or audience — including by college, program and batch.",
      "Read the reach figure: how many verified alumni the audience rules match right now.",
      "Check RSVP counts — going, maybe, and waitlisted.",
      "Press New event to publish one. Set the title, description, date and location, and optionally target it at particular batches or programs.",
      "Open an event to edit it or see who's attending.",
    ],
    tips: [
      "Set the audience before you publish. Reach is calculated from it, so you can see how many people an event will actually go to.",
    ],
  },
  {
    slug: "admin-enquiries",
    tab: "Enquiries",
    href: "/admin/enquiries",
    surface: "admin",
    group: "Trust & operations",
    purpose:
      "Everything sent through the public contact forms — employer partnership requests, support questions, privacy requests.",
    steps: [
      "Filter by status, topic, date, or search the text.",
      "Read an enquiry. The topic tells you which AUF address it was also emailed to.",
      "Press Reply to open your mail client with the sender's address ready.",
      "Mark it In progress while you're working on it, then Closed when it's handled.",
      "Add an internal note — the sender never sees it.",
      "To handle several at once, select them and use the bulk status buttons.",
    ],
    tips: [
      "Employer partnership enquiries carry the plan the company was looking at, so you know what they want before you reply.",
      "This list is the record. The email copy is a convenience and may be missed.",
    ],
    seeAlso: ["admin-employers"],
  },
  {
    slug: "admin-audit",
    tab: "Audit log",
    href: "/admin/audit",
    surface: "admin",
    group: "Trust & operations",
    purpose:
      "Who did what, when, and why — every administrative action on the system.",
    steps: [
      "Filter by action type or by the kind of thing that was acted on.",
      "Read each entry: when it happened, which admin did it, what they acted on, and the reason they gave.",
      "Use Clear filters to go back to the full log.",
    ],
    tips: [
      "This is your answer when someone asks why an account was suspended or a posting rejected. It's also why reasons are worth writing properly at the time.",
    ],
    seeAlso: ["admin-compliance", "admin-users"],
  },
  {
    slug: "admin-compliance",
    tab: "Compliance",
    href: "/admin/compliance",
    surface: "admin",
    group: "Trust & operations",
    purpose:
      "Data-protection obligations: security incidents and the data subject rights log. Super-admin only.",
    steps: [
      "Under Incidents, press Start incident response and record what happened, its severity and a description.",
      "Work the notification duties: mark NPC notified once the National Privacy Commission has been told, and mark Subjects notified once affected people have been.",
      "Watch for NPC overdue — it flags an incident where the notification window has passed.",
      "Close the incident with what happened, what you changed, and what you learned.",
      "Under Data subject rights, track each request: when it was requested, acknowledged and fulfilled, and the outcome.",
    ],
    tips: [
      "Fill in the closing notes properly. Under the Data Privacy Act this log is what you produce when asked to show your handling was adequate.",
    ],
    seeAlso: ["admin-audit"],
  },
  {
    slug: "admin-reports",
    tab: "Reports",
    href: "/admin/reports",
    surface: "admin",
    group: "Trust & operations",
    purpose: "Weekly operating summaries and the scheduled digests that go out.",
    steps: [
      "Read This week for approvals handled, median turnaround and how that compares with target.",
      "Check Scheduled summaries to see which recurring reports are set up and their status.",
    ],
    seeAlso: ["admin-analytics"],
  },
  {
    slug: "admin-users",
    tab: "Users",
    href: "/admin/users",
    surface: "admin",
    group: "Trust & operations",
    purpose:
      "Account administration — who holds which role, and suspending accounts that abuse the network.",
    steps: [
      "Filter by search, role or status.",
      "To act on one account, use the row actions.",
      "To act on several, tick them (or use Select all), then choose Suspend, Unsuspend, Grant role or Revoke role.",
      "Give a reason — it goes into the audit log with your name.",
    ],
    tips: [
      "Your own account is skipped by bulk actions, so you can't lock yourself out.",
      "Every change is audited individually, even when done in bulk.",
    ],
    seeAlso: ["admin-audit"],
  },
  {
    slug: "admin-content",
    tab: "Main page",
    href: "/admin/content",
    surface: "admin",
    group: "Content management",
    purpose:
      "Edit the public homepage copy without a developer.",
    steps: [
      "Work down the form — it mirrors the sections of the public homepage.",
      "Edit any field. Each one shows its length limit.",
      "Press Reset on a single field to restore its built-in default.",
      "Press Save changes. The public homepage picks up the new copy on its next load.",
    ],
    tips: ["Nothing is live until you press Save changes."],
    seeAlso: ["admin-articles"],
  },
  {
    slug: "admin-public-site",
    tab: "The public website",
    href: "/",
    alsoCovers: ["/about", "/for-alumni", "/for-employers", "/colleges", "/admissions", "/trust", "/guidelines", "/help", "/legal", "/careers", "/companies", "/news", "/contact", "/report", "/verification"],
    surface: "admin",
    group: "Content management",
    purpose:
      "What the public site contains, and which parts you can change yourself versus which need a developer.",
    steps: [
      "Homepage copy — edit it yourself under Main page. Headline, how-it-works steps, featured-jobs heading and the rest. Save, and the public homepage picks it up on its next load.",
      "News and announcements — write them yourself under Articles. Published ones appear at /news.",
      "College and program lists — maintained under Colleges & programs. These feed the public pages as well as profiles and filters.",
      "Open roles at /careers and hiring partners at /companies are generated from real data. You change what appears there by approving postings and onboarding employers, not by editing the page.",
      "Pricing on the employer page mirrors the plan tiers in billing. If the plans change, that page changes with them.",
      "Everything else — About, For alumni, For employers, Trust & safety, Guidelines, Help centre, and the legal pages — is fixed text that needs a developer to change. Raise it with whoever maintains the site.",
    ],
    tips: [
      "Enquiries sent from the public Contact page land in your Enquiries tab, not in someone's personal inbox.",
      "Before asking for a wording change, check whether the text is on the homepage — if it is, you can edit it yourself in seconds.",
    ],
    seeAlso: ["admin-content", "admin-articles", "admin-enquiries"],
  },
  {
    slug: "admin-articles",
    tab: "Articles",
    href: "/admin/articles",
    surface: "admin",
    group: "Content management",
    purpose: "The newsroom — announcements and stories on the public site.",
    steps: [
      "Filter by search, status or category.",
      "Press to create a draft, then open it to write.",
      "Give it a title, excerpt, body and category, and upload a cover image.",
      "Publish when it's ready, or leave it as a draft. Published articles appear on the public news page.",
      "Archive anything that's no longer current rather than deleting it.",
    ],
    seeAlso: ["admin-content"],
  },
  {
    slug: "admin-taxonomy",
    tab: "Colleges & programs",
    href: "/admin/settings",
    surface: "admin",
    group: "Content management",
    purpose:
      "The canonical list of colleges and the programs under each — the source every college and program picker in the system reads from.",
    steps: [
      "Add a college, then add its programs beneath it.",
      "Rename anything that's changed name.",
      "Re-home a program if it moves to a different college.",
      "Archive programs that are no longer offered instead of deleting them.",
    ],
    tips: [
      "This list feeds profiles, verification, and every College → Program filter in the admin console. Changing it here changes all of them at once, with no code change.",
      "Archiving hides an item from pickers but leaves existing alumni records untouched.",
    ],
    seeAlso: ["admin-lists"],
  },
  {
    slug: "admin-lists",
    tab: "Areas, Statuses, Skill sets",
    href: "/admin/lists/areas",
    alsoCovers: ["/admin/lists"],
    surface: "admin",
    group: "Content management",
    purpose:
      "The three reference lists the rest of the system picks from: areas (locations), employment statuses, and skill sets.",
    steps: [
      "Pick the list you want from the sidebar: Areas, Statuses or Skill sets.",
      "Add an item, or rename an existing one.",
      "Group and reorder items so the most-used ones come first in pickers.",
      "Archive anything obsolete.",
    ],
    tips: [
      "Archiving hides an item from pickers but leaves existing profile values alone — nobody's profile breaks.",
      "Skill sets matter most: they're what employers tag roles with and what job matching scores against.",
    ],
    seeAlso: ["admin-taxonomy"],
  },
];

export const GUIDE_TOPICS: GuideTopic[] = [...ALUMNI, ...EMPLOYER, ...ADMIN];

export function topicsFor(surface: Surface): GuideTopic[] {
  return GUIDE_TOPICS.filter((t) => t.surface === surface);
}

export function topicBySlug(slug: string): GuideTopic | undefined {
  return GUIDE_TOPICS.find((t) => t.slug === slug);
}

/**
 * Finds the walkthrough for the page someone is currently on, so the shells can
 * offer "How this page works" without each one hard-coding a mapping.
 * Longest matching href wins, so /jobs/applications beats /jobs.
 */
export function topicForPath(pathname: string, surface: Surface): GuideTopic | undefined {
  let best: GuideTopic | undefined;
  // Compare against the base that actually matched, not the topic's href — a
  // topic can match via a short alsoCovers prefix while carrying a long href
  // (/profile/[slug] matching on "/profile"), and comparing hrefs would let it
  // outrank the more specific /profile/edit.
  let bestLength = -1;
  for (const t of GUIDE_TOPICS) {
    if (t.surface !== surface) continue;
    if (t.slug.startsWith("start-")) continue; // never the contextual answer
    const paths = [
      ...(t.href.includes("[") ? [] : [t.href]),
      ...(t.alsoCovers ?? []),
    ];
    for (const base of paths) {
      if (pathname === base || pathname.startsWith(base + "/")) {
        if (base.length > bestLength) {
          best = t;
          bestLength = base.length;
        }
      }
    }
  }
  return best;
}

/** Section order within a surface. */
export function groupsFor(surface: Surface): string[] {
  const seen: string[] = [];
  for (const t of topicsFor(surface)) {
    if (!seen.includes(t.group)) seen.push(t.group);
  }
  return seen;
}

/** False for screens reached from elsewhere (dynamic routes), which can't be opened directly. */
export function isOpenable(topic: GuideTopic): boolean {
  return !topic.href.includes("[");
}
