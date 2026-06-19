import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Foundational schema (Stories 1.2 + 1.8 + Epic 2).
 *
 * Includes auth tables from @convex-dev/auth + our domain tables. The auth
 * library manages `users`, `authAccounts`, `authSessions`, `authVerifiers`,
 * `authRefreshTokens`, `authVerificationCodes`, `authRateLimits`. We extend
 * the auth `users` table with our domain fields (roles, planTier, DPA
 * consent, lifecycle timestamps).
 *
 * Schema is incremental — new tables land with their respective epic stories.
 */
export default defineSchema({
  ...authTables,

  // ---------- users (extended from authTables.users) ----------
  // Convex Auth manages email, emailVerificationTime, etc.
  // We extend with domain-specific fields.
  users: defineTable({
    // From authTables.users
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Our additions — all optional because Convex Auth INSERTs the row before
    // bootstrapAfterSignup fills domain fields in. The bootstrap mutation
    // enforces presence at the application level.
    roles: v.optional(v.array(v.string())),
    createdAt: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedAtHardDeleteScheduledFor: v.optional(v.number()),
    suspendedAt: v.optional(v.number()),
    suspendedReason: v.optional(v.string()),
    consentAcknowledgedAt: v.optional(v.number()),
    consentVersion: v.optional(v.string()),
    planTier: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    usageLimits: v.optional(
      v.object({
        connectionsPerDay: v.optional(v.number()),
        messagesPerDay: v.optional(v.number()),
      }),
    ),
  }).index("email", ["email"]),

  // ---------- profiles ----------
  profiles: defineTable({
    userId: v.id("users"),
    slug: v.string(),
    displayName: v.string(),
    registryName: v.optional(v.string()),
    initials: v.string(),
    batch: v.number(),
    program: v.string(),
    degree: v.string(),
    currentRole: v.optional(v.string()),
    company: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    bio: v.optional(v.string()),
    skills: v.array(v.string()),
    openTo: v.array(v.string()),
    experience: v.array(
      v.object({
        role: v.string(),
        company: v.string(),
        years: v.string(),
      }),
    ),
    education: v.array(
      v.object({
        degree: v.string(),
        program: v.string(),
        school: v.string(),
        year: v.number(),
      }),
    ),
    photoStorageId: v.optional(v.id("_storage")),
    // Default resume — uploaded once on the profile and reusable across job
    // applications. The apply flow can either reuse this or accept a
    // per-application upload.
    resumeStorageId: v.optional(v.id("_storage")),
    resumeFilename: v.optional(v.string()),
    resumeUploadedAt: v.optional(v.number()),
    // Discovery banners — opt-in flags surfaced to viewers + recruiters.
    openToWork: v.optional(v.boolean()),
    openToWorkNote: v.optional(v.string()),
    openToWorkUpdatedAt: v.optional(v.number()),
    openToHire: v.optional(v.boolean()),
    openToHireNote: v.optional(v.string()),
    privacyTiers: v.record(v.string(), v.string()),
    verifiedAt: v.optional(v.number()),
    // Stable, opaque virtual Alumni-ID — minted once on the first ID-card
    // request for a verified profile. Format: `AUF-{batch}-{6-digit-seq}`.
    // The QR on the digital ID encodes this so anyone can hit
    // `/verify/{alumniId}` to confirm authenticity.
    alumniId: v.optional(v.string()),
    alumniIdIssuedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    excludeFromSearchEngines: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_userId", ["userId"])
    .index("by_batch_program", ["batch", "program"])
    .index("by_alumni_id", ["alumniId"]),

  // ---------- verificationSubmissions (Epic 2 Stories 2.3, 2.4) ----------
  verificationSubmissions: defineTable({
    userId: v.id("users"),
    // User-claimed identity
    claimedName: v.string(),
    claimedBatch: v.number(),
    claimedProgram: v.string(),
    // Upload artifacts (Sensitive Personal Information — segregated storage)
    idStorageId: v.optional(v.id("_storage")),
    diplomaStorageId: v.optional(v.id("_storage")),
    // Registry hook result (snapshotted at submission time for audit)
    registryMatched: v.boolean(),
    registryConfidence: v.optional(v.number()),
    registryRecordSnapshot: v.optional(v.any()),
    // Status machine
    status: v.string(),
    // "pending-review" | "approved-fast-path" | "approved" | "rejected" |
    // "info-requested" | "escalated"
    statusReason: v.optional(v.string()),
    flags: v.array(v.string()),
    // ("name-mismatch" | "no-registry-match" | "id-quality-low")[]
    // Decision metadata
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.id("users")),
    artifactsPurgedAt: v.optional(v.number()),
    // Lifecycle
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status_time", ["status", "updatedAt"]),

  // ---------- connections (Epic 5) ----------
  // One row per directed request. When status becomes "connected", that single
  // row represents the bidirectional connection (we don't duplicate).
  // Status: "pending" | "connected" | "declined"
  // Lookup pair is normalised so the (userA, userB) index is order-independent:
  // userA always < userB (string compare) regardless of who sent the request.
  connections: defineTable({
    requesterId: v.id("users"),
    recipientId: v.id("users"),
    userA: v.id("users"), // lower-id of the pair (canonical ordering)
    userB: v.id("users"), // higher-id of the pair
    status: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index("by_requester_status", ["requesterId", "status"])
    .index("by_recipient_status", ["recipientId", "status"])
    .index("by_pair", ["userA", "userB"]),

  // ---------- blocks (Epic 5 Story 5.4) ----------
  blocks: defineTable({
    blockerId: v.id("users"),
    blockedId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_blocker_blocked", ["blockerId", "blockedId"])
    .index("by_blocked_blocker", ["blockedId", "blockerId"]),

  // ---------- jobs (Epic 13) ----------
  jobs: defineTable({
    employerOrgId: v.id("employerOrgs"),
    title: v.string(),
    description: v.string(),
    location: v.string(),
    employmentType: v.string(), // "full-time" | "part-time" | "contract" | "internship"
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    salaryCurrency: v.optional(v.string()),
    targetingBatches: v.optional(v.array(v.number())),
    targetingPrograms: v.optional(v.array(v.string())),
    targetingSkills: v.optional(v.array(v.string())),
    targetingCity: v.optional(v.string()),
    aufOnly: v.boolean(),
    status: v.string(), // "pending-moderation" | "published" | "suspended" | "closed"
    statusReason: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    publishedAt: v.optional(v.number()),
    closingAt: v.optional(v.number()),
    suspendedAt: v.optional(v.number()),
    decidedBy: v.optional(v.id("users")),
  })
    .index("by_status_time", ["status", "createdAt"])
    .index("by_employer_time", ["employerOrgId", "createdAt"])
    .index("by_published", ["publishedAt"]),

  applications: defineTable({
    jobId: v.id("jobs"),
    applicantId: v.id("users"),
    coverNote: v.optional(v.string()),
    profileSnapshot: v.any(), // privacy-filtered snapshot at submission time
    stage: v.string(), // "new" | "screening" | "interview" | "offered" | "hired" | "not-selected"
    referredBy: v.optional(v.id("users")),
    // Optional applicant-disclosed salary expectation. Captured at apply
    // time; visible to the posting employer + moderators only.
    salaryExpectation: v.optional(
      v.object({
        min: v.number(),
        max: v.number(),
        currency: v.string(), // ISO 4217 — "PHP" by default
        period: v.string(), // "monthly" | "annual"
      }),
    ),
    // Optional resume / CV uploaded via Convex storage at apply time.
    // The PDF/DOC binary lives in storage; we keep only the pointer.
    resumeStorageId: v.optional(v.id("_storage")),
    resumeFilename: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job_stage", ["jobId", "stage"])
    .index("by_applicant_time", ["applicantId", "createdAt"]),

  // ---------- mentorshipRequests (Epic 14) ----------
  mentorshipRequests: defineTable({
    requesterId: v.id("users"),
    mentorId: v.id("users"),
    topic: v.string(),
    proposedTimes: v.array(v.string()),
    status: v.string(), // "requested" | "scheduled" | "completed" | "cancelled" | "declined"
    scheduledFor: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    feedback: v.optional(v.string()),
    rating: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_mentor_status", ["mentorId", "status"])
    .index("by_requester_status", ["requesterId", "status"]),

  referrals: defineTable({
    referrerId: v.id("users"),
    refereeId: v.id("users"),
    jobId: v.id("jobs"),
    note: v.optional(v.string()),
    appliedAt: v.optional(v.number()),
    hiredAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_referrer_time", ["referrerId", "createdAt"]),

  // ---------- billing (Epic 16) ----------
  subscriptions: defineTable({
    employerOrgId: v.id("employerOrgs"),
    processor: v.string(), // "stripe" | "paymongo" | "maya" | "manual-comp"
    processorSubscriptionId: v.optional(v.string()),
    planTier: v.string(),
    status: v.string(), // "active" | "past_due" | "canceled" | "comp"
    quotaPerMonth: v.optional(v.number()),
    activatedAt: v.number(),
    cancelledAt: v.optional(v.number()),
  })
    .index("by_employer_status", ["employerOrgId", "status"]),

  billingEvents: defineTable({
    employerOrgId: v.id("employerOrgs"),
    processor: v.string(),
    eventId: v.string(), // deduplication key from processor webhook
    eventType: v.string(),
    amountMinor: v.optional(v.number()), // amount in minor units (centavos)
    currency: v.optional(v.string()),
    raw: v.any(),
    receivedAt: v.number(),
  })
    .index("by_event_id", ["eventId"])
    .index("by_employer_time", ["employerOrgId", "receivedAt"]),

  // ---------- posts (Epic 8) ----------
  posts: defineTable({
    authorId: v.id("users"),
    kind: v.string(), // "text" | "image" | "work-anniversary" | "milestone"
    content: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    visibilityTier: v.string(), // "connections" | "alumni"
    autoGenerated: v.boolean(),
    relatedMetadata: v.optional(v.any()),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_author_time", ["authorId", "createdAt"])
    .index("by_time", ["createdAt"]),

  // ---------- events (Epic 9) ----------
  events: defineTable({
    title: v.string(),
    description: v.string(),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    locationLabel: v.optional(v.string()),
    onlineUrl: v.optional(v.string()),
    capacity: v.optional(v.number()),
    audienceFilter: v.optional(
      v.object({
        batches: v.optional(v.array(v.number())),
        programs: v.optional(v.array(v.string())),
      }),
    ),
    publishedBy: v.id("users"),
    publishedAt: v.number(),
    cancelledAt: v.optional(v.number()),
    coverImageStorageId: v.optional(v.id("_storage")),
    category: v.optional(
      v.union(
        v.literal("reunion"),
        v.literal("webinar"),
        v.literal("meetup"),
        v.literal("other"),
      ),
    ),
    agenda: v.optional(
      v.array(
        v.object({
          time: v.string(),
          title: v.string(),
          description: v.optional(v.string()),
        }),
      ),
    ),
  })
    .index("by_starts_at", ["startsAt"])
    .index("by_published_at", ["publishedAt"]),

  rsvps: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    status: v.string(), // "yes" | "maybe" | "waitlist" | "cancelled"
    rsvpedAt: v.number(),
    remindedAt24h: v.optional(v.number()),
    remindedAt1h: v.optional(v.number()),
  })
    .index("by_event_status", ["eventId", "status"])
    .index("by_user_status", ["userId", "status"]),

  // ---------- messages (Epic 10) ----------
  messageThreads: defineTable({
    userA: v.id("users"),
    userB: v.id("users"),
    lastMessageAt: v.number(),
    lastMessagePreview: v.string(),
    unreadForUserA: v.number(),
    unreadForUserB: v.number(),
  })
    .index("by_pair", ["userA", "userB"])
    .index("by_lastA", ["userA", "lastMessageAt"])
    .index("by_lastB", ["userB", "lastMessageAt"]),

  messages: defineTable({
    threadId: v.id("messageThreads"),
    senderId: v.id("users"),
    recipientId: v.id("users"),
    content: v.string(),
    sentAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_thread_time", ["threadId", "sentAt"])
    .index("by_recipient_sent", ["recipientId", "sentAt"]),

  reports: defineTable({
    reporterId: v.id("users"),
    reportedUserId: v.id("users"),
    category: v.string(), // "spam" | "harassment" | "impersonation" | "other"
    details: v.string(),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id("users")),
    resolution: v.optional(v.string()),
  })
    .index("by_status_time", ["resolvedAt", "createdAt"])
    .index("by_reporter", ["reporterId"]),

  // ---------- notifications + preferences (Epic 11) ----------
  notifications: defineTable({
    userId: v.id("users"),
    kind: v.string(), // "connection-request" | "connection-accepted" | "dm" | "rsvp-reminder" | …
    title: v.string(),
    body: v.string(),
    href: v.optional(v.string()),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user_time", ["userId", "createdAt"])
    .index("by_user_unread", ["userId", "readAt"]),

  notificationPrefs: defineTable({
    userId: v.id("users"),
    // Map of channel-name → boolean. Channels: connectionRequestEmail,
    // connectionRequestInApp, dmEmail, dmInApp, mentorshipEmail, etc.
    prefs: v.record(v.string(), v.boolean()),
    digestFrequency: v.optional(v.string()), // "weekly" | "off"
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ---------- dataSubjectRequests (Epic 7 Story 7.2) ----------
  // Tracks DPA rights requests for NFR33 SLA evidence.
  dataSubjectRequests: defineTable({
    userId: v.id("users"),
    type: v.string(),
    // "access" | "correction" | "erasure" | "portability" | "objection" | "complaint"
    requestedAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
    fulfilledAt: v.optional(v.number()),
    outcome: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_type_time", ["type", "requestedAt"]),

  // ---------- incidents (Epic 7 Story 7.3) ----------
  // Tracks privacy / security incidents and the NFR34 72-hour notification clock.
  incidents: defineTable({
    title: v.string(),
    severity: v.string(), // "low" | "medium" | "high" | "critical"
    description: v.string(),
    startedAt: v.number(),
    startedBy: v.id("users"),
    affectedScope: v.optional(v.string()),
    npcNotifiedAt: v.optional(v.number()),
    subjectsNotifiedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    closedBy: v.optional(v.id("users")),
    closureNotes: v.optional(v.string()),
  })
    .index("by_started_at", ["startedAt"])
    .index("by_severity", ["severity"]),

  // ---------- auditEntries (NFR11 invariant) ----------
  auditEntries: defineTable({
    actorId: v.optional(v.id("users")),
    actorType: v.string(),
    actionType: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    reason: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("by_actor_time", ["actorId", "timestamp"])
    .index("by_action_time", ["actionType", "timestamp"])
    .index("by_target", ["targetType", "targetId"]),

  // ---------- employerOrgs (Story 1.8 — Phase 3 schema) ----------
  employerOrgs: defineTable({
    name: v.string(),
    slug: v.string(),
    tier: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    websiteUrl: v.optional(v.string()),
    hqCity: v.optional(v.string()),
    mouAcknowledgedAt: v.optional(v.number()),
    planTier: v.string(),
    subscriptionId: v.optional(v.string()),
    jobPostQuota: v.optional(v.number()),
    jobPostsUsed: v.number(),
    // Users with employer-admin authority over this org. Only these users
    // (plus super-admin / moderator) can list, post jobs to, or view the
    // pipeline of this employer org. v1 stores admins inline; if many-to-many
    // grows beyond a handful of admins per org, migrate to a join table.
    adminUserIds: v.optional(v.array(v.id("users"))),
    createdAt: v.number(),
    updatedAt: v.number(),
    suspendedAt: v.optional(v.number()),
    suspendedReason: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_tier", ["tier"]),

  // ---------- AUF Academy (Epic 17) ----------
  // On-demand "how to" courses taught by verified alumni instructors.
  // Pairs with mentorship: every course exposes a 1-click DM-to-instructor.
  academyCourses: defineTable({
    instructorId: v.id("users"),
    slug: v.string(),
    title: v.string(),
    summary: v.string(), // 1-2 sentence elevator pitch
    description: v.string(), // longer markdown body
    category: v.string(), // "career" | "tech" | "healthcare" | "design" | "leadership" | "soft-skills" | …
    level: v.string(), // "beginner" | "intermediate" | "advanced"
    durationMinutes: v.optional(v.number()), // sum across lessons
    coverImageStorageId: v.optional(v.id("_storage")),
    status: v.string(), // "draft" | "published" | "archived"
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_instructor", ["instructorId"])
    .index("by_status_published", ["status", "publishedAt"])
    .index("by_category_status", ["category", "status"]),

  academyLessons: defineTable({
    courseId: v.id("academyCourses"),
    order: v.number(),
    title: v.string(),
    kind: v.string(), // "video" | "article"
    videoUrl: v.optional(v.string()), // YouTube / Vimeo embed URL
    articleMarkdown: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_course_order", ["courseId", "order"]),

  academyEnrollments: defineTable({
    userId: v.id("users"),
    courseId: v.id("academyCourses"),
    completedLessonIds: v.array(v.id("academyLessons")),
    enrolledAt: v.number(),
    lastViewedLessonId: v.optional(v.id("academyLessons")),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_course", ["userId", "courseId"])
    .index("by_course", ["courseId"]),

  // ---------- LinkedIn-parity social primitives ----------

  // Asymmetric follow (one-way). Distinct from connections (two-way).
  // Lets thought-leader alumni broadcast without needing reciprocation.
  follows: defineTable({
    followerId: v.id("users"),
    followeeId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_follower", ["followerId"])
    .index("by_followee", ["followeeId"])
    .index("by_pair", ["followerId", "followeeId"]),

  // Skill endorsements — peers endorse a named skill on someone's profile.
  // One row per (endorser, profile, skill); endorser can only endorse once
  // per skill on a given profile.
  endorsements: defineTable({
    profileUserId: v.id("users"), // owner of the profile being endorsed
    endorserId: v.id("users"),
    skill: v.string(),
    createdAt: v.number(),
  })
    .index("by_profile_skill", ["profileUserId", "skill"])
    .index("by_endorser", ["endorserId"]),

  // Peer recommendations — long-form testimonials shown on profile.
  // status flow: "pending" (author wrote, awaiting subject approval) →
  // "published" (subject approved) or "rejected" (subject declined).
  recommendations: defineTable({
    subjectUserId: v.id("users"), // recommendation is about this person
    authorId: v.id("users"),
    relationship: v.string(), // "manager" | "report" | "peer" | "client" | "classmate" | "mentor" | …
    body: v.string(),
    status: v.string(), // "pending" | "published" | "rejected"
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index("by_subject_status", ["subjectUserId", "status"])
    .index("by_author", ["authorId"]),

  // Single-use password-reset tokens (30-min TTL). `usedAt` set when consumed
  // so the token can't be replayed.
  passwordResetTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),
});
