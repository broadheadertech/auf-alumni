/**
 * Editable-page registry for the CMS (convex/siteContent.ts).
 *
 * Pure data — no Convex imports — so marketing pages can also import it to
 * fall back to the default copy if the backend is unreachable.
 */

export type FieldDef = {
  key: string;
  label: string;
  default: string;
  max: number;
  multiline?: boolean;
  help?: string;
};
export type SectionDef = { title: string; fields: FieldDef[] };
export type PageDef = { title: string; path: string; sections: SectionDef[] };

export const PAGES: Record<string, PageDef> = {
  home: {
    title: "Main page",
    path: "/",
    sections: [
      {
        title: "Hero",
        fields: [
          { key: "heroBadge", label: "Badge", default: "Now open to all AUF alumni", max: 60 },
          {
            key: "heroTitleLead",
            label: "Headline — opening words",
            default: "Where",
            max: 40,
            help: "The headline reads: opening words + brand-colour phrase, line break, middle words + gold-highlight phrase.",
          },
          { key: "heroTitleAccent", label: "Headline — brand-colour phrase", default: "AUF alumni", max: 40 },
          { key: "heroTitleMiddle", label: "Headline — middle words", default: "hire", max: 40 },
          { key: "heroTitleHighlight", label: "Headline — gold-highlight phrase", default: "AUF alumni.", max: 40 },
          {
            key: "heroSubtitle",
            label: "Subtitle",
            default:
              "The official career and mentorship network for Angeles University Foundation alumni — verified by the registrar, trusted by 1,400+ employers, and built so a referral is never more than one alum away.",
            max: 300,
            multiline: true,
          },
          { key: "heroPrimaryCta", label: "Primary button", default: "Join the network", max: 30 },
          { key: "heroSecondaryCta", label: "Secondary button", default: "Post a job", max: 30 },
          { key: "heroSocialProofNumber", label: "Social proof — number", default: "12,847", max: 20 },
          { key: "heroSocialProofText", label: "Social proof — text", default: "alumni joined in the past 90 days", max: 80 },
        ],
      },
      {
        title: "How it works",
        fields: [
          { key: "howEyebrow", label: "Eyebrow", default: "How it works", max: 40 },
          {
            key: "howTitle",
            label: "Title",
            default: "A career platform with\nyour AUF batch built in.",
            max: 120,
            multiline: true,
            help: "Line breaks are kept.",
          },
          { key: "howStep1Title", label: "Step 1 — title", default: "Verify you're AUF", max: 60 },
          {
            key: "howStep1Body",
            label: "Step 1 — description",
            default:
              "Sign up with your student ID or grad year. We check the registrar so the network stays trusted alumni-only.",
            max: 240,
            multiline: true,
          },
          { key: "howStep2Title", label: "Step 2 — title", default: "Find your people", max: 60 },
          {
            key: "howStep2Body",
            label: "Step 2 — description",
            default:
              "Search 38K+ alumni by college, batch, industry, or city. Every connection is one degree from a referral.",
            max: 240,
            multiline: true,
          },
          { key: "howStep3Title", label: "Step 3 — title", default: "Land the job — together", max: 60 },
          {
            key: "howStep3Body",
            label: "Step 3 — description",
            default:
              "Every job posting shows who from AUF works there. Skip the cold portal — DM the alum directly.",
            max: 240,
            multiline: true,
          },
        ],
      },
      {
        title: "Featured jobs",
        fields: [
          { key: "jobsEyebrow", label: "Eyebrow", default: "Hiring now", max: 40 },
          {
            key: "jobsTitle",
            label: "Title",
            default: "Jobs your batchmates\nalready work at.",
            max: 120,
            multiline: true,
          },
        ],
      },
      {
        title: "Mentorship",
        fields: [
          { key: "mentorsEyebrow", label: "Eyebrow", default: "Mentorship", max: 40 },
          { key: "mentorsTitle", label: "Title", default: "Real mentors. Real time. Real careers.", max: 120 },
          {
            key: "mentorsBody",
            label: "Description",
            default:
              "Match with senior AUF alums who've been in your field 5, 10, 20 years. Office hours, mock interviews, portfolio reviews — booked in two clicks.",
            max: 400,
            multiline: true,
          },
          {
            key: "mentorsBullets",
            label: "Checklist",
            default:
              "Industry-vetted mentors\nCoffee chats from ₱0\n1:1 + cohort options\nBoth PH-based and abroad\nBooked in 2 clicks\nFree for verified alumni",
            max: 400,
            multiline: true,
            help: "One item per line.",
          },
        ],
      },
      {
        title: "Testimonial",
        fields: [
          {
            key: "testimonialQuote",
            label: "Quote",
            default:
              "I had my AUF degree on my CV for 8 years. The day I joined the alumni network, three batchmates reached out — and I had a referral at GCash within the week. This is the network we should've had since 2017.",
            max: 500,
            multiline: true,
          },
          { key: "testimonialName", label: "Name", default: "Mark Lim", max: 80 },
          { key: "testimonialRole", label: "Role line", default: "Product Designer, GCash · BS Multimedia Arts '19", max: 120 },
        ],
      },
      {
        title: "Closing call-to-action",
        fields: [
          { key: "ctaEyebrow", label: "Eyebrow", default: "Class of '71 through '26", max: 60 },
          { key: "ctaTitle", label: "Title", default: "Your AUF batch is online. Are you?", max: 120 },
          {
            key: "ctaBody",
            label: "Description",
            default:
              "Free for all verified alumni. Built and operated by AUF. No spam, no recruiters cold-DMing you.",
            max: 300,
            multiline: true,
          },
        ],
      },
    ],
  },
};

export function defaultsFor(page: PageDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of page.sections) {
    for (const f of section.fields) out[f.key] = f.default;
  }
  return out;
}
