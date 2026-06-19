/**
 * Weekly digest composition model (Epic 11 Story 11.2).
 *
 * Pure functions only — NO Convex imports — so the compose logic is
 * unit-testable in vitest without the Convex runtime. `convex/digest.ts`
 * gathers the raw rows and calls `buildDigestModel`; the React Email
 * template (`src/emails/WeeklyDigest.tsx`) renders the resulting model.
 *
 * Governing principles (see spec):
 * - Specificity over abundance: every section names names, never bare counts.
 * - Each section is independently optional; all-empty → null (send nothing).
 * - Dates render in Asia/Manila time.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ---------- raw-row input shapes ----------

export type DigestRecipient = {
  displayName: string;
  batch: number;
  program: string;
  city?: string;
};

/**
 * Peer rows arrive privacy-filtered (applyPrivacy with an "alumnus" viewer),
 * so every tier-gated field (batch/program/city/openTo) may be absent. The
 * section builders treat a missing field as "peer excluded from any section
 * that needs it" — a hidden value must never reach an email.
 * displayName/slug/createdAt/verifiedAt are always-include fields.
 */
export type DigestPeer = {
  displayName: string;
  slug: string;
  batch?: number;
  program?: string;
  city?: string;
  openTo?: string[];
  createdAt: number;
  verifiedAt?: number;
};

export type DigestJob = {
  id: string;
  title: string;
  companyName?: string;
  location: string;
  status: string;
  targetingBatches?: number[];
  targetingPrograms?: string[];
};

export type DigestEvent = {
  id: string;
  title: string;
  startsAt: number;
  locationLabel?: string;
  cancelledAt?: number;
};

export type BuildDigestInput = {
  recipient: DigestRecipient;
  peers: DigestPeer[];
  jobs: DigestJob[];
  events: DigestEvent[];
  now: number;
  appUrl: string;
  /** Absolute URL of the notification-preferences page (email footer link). */
  settingsUrl: string;
};

// ---------- section models ----------

export type BatchmateItem = {
  name: string;
  detail: string;
  profileUrl: string;
};

export type BatchmateSection = { items: BatchmateItem[] };

export type MentorshipSection = {
  headline: string;
  sampleNames: string[];
  directoryUrl: string;
};

export type JobItem = {
  title: string;
  companyName?: string;
  location: string;
  jobUrl: string;
};

export type JobsSection = { items: JobItem[] };

export type EventSection = {
  title: string;
  whenLabel: string;
  locationLabel?: string;
  eventUrl: string;
};

export type DigestModel = {
  recipientName: string;
  batchmates: BatchmateSection | null;
  mentorship: MentorshipSection | null;
  jobs: JobsSection | null;
  event: EventSection | null;
  settingsUrl: string;
};

// ---------- helpers ----------

/** Format an epoch-ms timestamp in Asia/Manila time, e.g. "Wed, Jun 10, 7:00 PM". */
export function formatManila(ts: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

/** "2018" → "'18" (cohort shorthand used in the mentorship headline). */
function batchShorthand(batch: number): string {
  return `'${String(batch % 100).padStart(2, "0")}`;
}

function isOpenToMentorship(peer: DigestPeer): boolean {
  return (peer.openTo ?? []).some((t) => t.toLowerCase() === "mentorship");
}

/** A job with no targeting matches everyone; otherwise batch/program must match. */
export function jobMatchesRecipient(
  job: DigestJob,
  recipient: Pick<DigestRecipient, "batch" | "program">,
): boolean {
  if (job.status !== "published") return false;
  if (
    job.targetingBatches &&
    job.targetingBatches.length > 0 &&
    !job.targetingBatches.includes(recipient.batch)
  ) {
    return false;
  }
  if (
    job.targetingPrograms &&
    job.targetingPrograms.length > 0 &&
    !job.targetingPrograms.includes(recipient.program)
  ) {
    return false;
  }
  return true;
}

// ---------- section builders ----------

function buildBatchmateSection(
  input: BuildDigestInput,
): BatchmateSection | null {
  const { recipient, peers, now, appUrl } = input;
  const cutoff = now - WEEK_MS;
  const recent = peers
    // Verified peers only — unverified signups never appear in a digest.
    // A peer whose privacy tier hides `batch` from alumni is excluded too.
    .filter((p) => p.verifiedAt != null && p.batch === recipient.batch)
    .map((p) => {
      const verifiedRecently = p.verifiedAt != null && p.verifiedAt >= cutoff;
      const joinedRecently = p.createdAt >= cutoff;
      if (!verifiedRecently && !joinedRecently) return null;
      return {
        peer: p,
        at: verifiedRecently ? (p.verifiedAt as number) : p.createdAt,
        detail: verifiedRecently
          ? "was verified this week"
          : "joined the network this week",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.at - a.at)
    .slice(0, 5);
  if (recent.length === 0) return null;
  return {
    items: recent.map(({ peer, detail }) => ({
      name: peer.displayName,
      detail,
      profileUrl: `${appUrl}/profile/${peer.slug}`,
    })),
  };
}

function buildMentorshipSection(
  input: BuildDigestInput,
): MentorshipSection | null {
  const { recipient, peers, appUrl } = input;
  const cohort = peers.filter(
    (p) =>
      // Verified peers only; tier-hidden batch/program/openTo excludes a peer.
      p.verifiedAt != null &&
      p.batch === recipient.batch &&
      p.program === recipient.program &&
      isOpenToMentorship(p),
  );
  if (cohort.length === 0) return null;

  // Prefer the recipient's own city when cohort members live there — the
  // headline and deep link narrow to that city; otherwise cover the cohort.
  // Exact-match semantics (same as directory.ts city filtering) so the
  // headline count equals the deep-link result count.
  const city = recipient.city;
  const inCity = city ? cohort.filter((p) => p.city === city) : [];
  const pool = inCity.length > 0 ? inCity : cohort;
  const cityLabel = inCity.length > 0 ? city : undefined;

  const count = pool.length;
  const grads = count === 1 ? "grad" : "grads";
  const verb = count === 1 ? "is" : "are";
  const headline = `${count} ${recipient.program} ${batchShorthand(recipient.batch)} ${grads}${cityLabel ? ` in ${cityLabel}` : ""} ${verb} open to mentorship`;

  const params = new URLSearchParams();
  params.set("batch", String(recipient.batch));
  params.set("program", recipient.program);
  if (cityLabel) params.set("city", cityLabel);
  params.set("openTo", "mentorship");

  return {
    headline,
    sampleNames: pool.slice(0, 3).map((p) => p.displayName),
    directoryUrl: `${appUrl}/directory?${params.toString()}`,
  };
}

function buildJobsSection(input: BuildDigestInput): JobsSection | null {
  const { recipient, jobs, appUrl } = input;
  const matching = jobs
    .filter((j) => jobMatchesRecipient(j, recipient))
    .slice(0, 3);
  if (matching.length === 0) return null;
  return {
    items: matching.map((j) => ({
      title: j.title,
      companyName: j.companyName,
      location: j.location,
      jobUrl: `${appUrl}/jobs/${j.id}`,
    })),
  };
}

function buildEventSection(input: BuildDigestInput): EventSection | null {
  const { events, now, appUrl } = input;
  const upcoming = events
    .filter((e) => e.cancelledAt == null && e.startsAt > now)
    .sort((a, b) => a.startsAt - b.startsAt);
  const next = upcoming[0];
  if (!next) return null;
  return {
    title: next.title,
    whenLabel: formatManila(next.startsAt),
    locationLabel: next.locationLabel,
    eventUrl: `${appUrl}/events/${next.id}`,
  };
}

/**
 * Named highlight for the email subject line ("Your AUF Alumni week — …").
 * Mirrors the section priority of the template's preview text: always leads
 * with a specific name/headline, never a bare count.
 */
export function digestHighlight(model: DigestModel): string {
  if (model.batchmates) {
    const items = model.batchmates.items;
    const first = items[0].name;
    return items.length > 1
      ? `${first} and ${items.length - 1} more from your batch`
      : `${first} from your batch`;
  }
  if (model.mentorship) return model.mentorship.headline;
  if (model.jobs) {
    const job = model.jobs.items[0];
    return job.companyName ? `${job.title} at ${job.companyName}` : job.title;
  }
  if (model.event) return model.event.title;
  return "your network this week";
}

// ---------- entry point ----------

/**
 * Map raw rows to the digest section model. Returns `null` when every
 * section is empty (zero-content rule: send nothing for that user).
 */
export function buildDigestModel(input: BuildDigestInput): DigestModel | null {
  const batchmates = buildBatchmateSection(input);
  const mentorship = buildMentorshipSection(input);
  const jobs = buildJobsSection(input);
  const event = buildEventSection(input);
  if (!batchmates && !mentorship && !jobs && !event) return null;
  return {
    recipientName: input.recipient.displayName,
    batchmates,
    mentorship,
    jobs,
    event,
    settingsUrl: input.settingsUrl,
  };
}
